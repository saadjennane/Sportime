/**
 * Sync Live Events Edge Function
 *
 * Fetches real-time match events (goals, cards, subs, VAR) from API-Football
 * and stores them in the live_match_events table.
 *
 * Also voids pending bets if an event occurs during the 8-second TV delay window.
 *
 * Endpoint: POST /functions/v1/sync-live-events
 * Body: { fixtureApiId?: number } - Optional, if not provided syncs all live games
 */

import 'jsr:@supabase/functions-js'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const API_FOOTBALL_KEY = Deno.env.get('API_FOOTBALL_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const TV_DELAY_SECONDS = 8 // Bets placed within this window of an event should be voided

interface MatchEvent {
  fixture_id: number
  api_event_id: number | null
  minute: number
  minute_extra: number | null
  team_id: number | null
  team_name: string | null
  player_id: number | null
  player_name: string | null
  assist_id: number | null
  assist_name: string | null
  event_type: string
  event_detail: string | null
  comments: string | null
}

function cors(req: Request) {
  const origin = req.headers.get('origin') ?? '*'
  return {
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': '*',
  }
}

function json(body: unknown, status = 200, req: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...cors(req) },
  })
}

Deno.serve(async (req) => {
  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors(req) })
  }

  if (!API_FOOTBALL_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Missing environment configuration' }, 500, req)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  try {
    let fixtureApiIds: number[] = []
    const body = await req.json().catch(() => ({}))

    if (body.fixtureApiId) {
      // Sync specific fixture
      fixtureApiIds = [body.fixtureApiId]
    } else {
      // Get all live games and their fixture API IDs
      const { data: liveGames, error: gamesError } = await supabase
        .from('live_games')
        .select(`
          id,
          fixture:fixture_id (
            api_id
          )
        `)
        .eq('status', 'live')

      if (gamesError) {
        console.error('[sync-live-events] Error fetching live games:', gamesError)
        return json({ error: 'Failed to fetch live games' }, 500, req)
      }

      fixtureApiIds = liveGames
        ?.filter((g: any) => g.fixture?.api_id)
        .map((g: any) => g.fixture.api_id) || []
    }

    if (fixtureApiIds.length === 0) {
      return json({ success: true, message: 'No live games to sync', eventsInserted: 0 }, 200, req)
    }

    console.log(`[sync-live-events] Syncing events for ${fixtureApiIds.length} fixtures: ${fixtureApiIds.join(', ')}`)

    let totalEventsInserted = 0
    let totalBetsVoided = 0

    for (const fixtureApiId of fixtureApiIds) {
      // Fetch events from API-Football
      const url = `https://v3.football.api-sports.io/fixtures/events?fixture=${fixtureApiId}`
      const response = await fetch(url, {
        headers: {
          'x-rapidapi-key': API_FOOTBALL_KEY,
          'x-rapidapi-host': 'v3.football.api-sports.io',
        },
      })

      if (!response.ok) {
        console.error(`[sync-live-events] API error for fixture ${fixtureApiId}: ${response.status}`)
        continue
      }

      const data = await response.json()

      if (data.errors && Object.keys(data.errors).length > 0) {
        console.error(`[sync-live-events] API errors for fixture ${fixtureApiId}:`, data.errors)
        continue
      }

      const events = data.response || []

      if (events.length === 0) {
        console.log(`[sync-live-events] No events for fixture ${fixtureApiId}`)
        continue
      }

      // Transform events to our format
      const matchEvents: MatchEvent[] = events
        .filter((e: any) => ['Goal', 'Card', 'subst', 'Var', 'Penalty'].includes(e.type))
        .map((e: any, index: number) => ({
          fixture_id: fixtureApiId,
          api_event_id: e.time?.elapsed ? e.time.elapsed * 1000 + index : index, // Create pseudo-unique ID
          minute: e.time?.elapsed || 0,
          minute_extra: e.time?.extra || null,
          team_id: e.team?.id || null,
          team_name: e.team?.name || null,
          player_id: e.player?.id || null,
          player_name: e.player?.name || null,
          assist_id: e.assist?.id || null,
          assist_name: e.assist?.name || null,
          event_type: e.type,
          event_detail: e.detail || null,
          comments: e.comments || null,
        }))

      // Insert events (upsert to handle duplicates)
      for (const event of matchEvents) {
        const { error: insertError } = await supabase
          .from('live_match_events')
          .upsert(event, {
            onConflict: 'fixture_id,event_type,minute,COALESCE(player_id, 0)',
            ignoreDuplicates: true,
          })

        if (!insertError) {
          totalEventsInserted++

          // Void pending bets placed within TV delay window of this event
          // Only for Goal and Card events (most impactful for betting)
          if (['Goal', 'Card', 'Penalty'].includes(event.event_type)) {
            const eventTime = new Date()
            const windowStart = new Date(eventTime.getTime() - TV_DELAY_SECONDS * 1000)

            // Find pending bets for this fixture placed in the TV delay window
            const { data: pendingBets, error: betsError } = await supabase
              .from('live_game_bets')
              .select(`
                id,
                amount,
                entry_id,
                entry:entry_id (
                  live_game:live_game_id (
                    fixture_id
                  )
                )
              `)
              .eq('status', 'pending')
              .gte('placed_at', windowStart.toISOString())

            if (!betsError && pendingBets) {
              for (const bet of pendingBets) {
                const betFixtureId = (bet as any).entry?.live_game?.fixture_id

                // Check if bet is for this fixture
                if (!betFixtureId) continue

                // Get the API ID for the bet's fixture
                const { data: fixtureData } = await supabase
                  .from('fb_fixtures')
                  .select('api_id')
                  .eq('id', betFixtureId)
                  .single()

                if (fixtureData?.api_id === fixtureApiId) {
                  // Void the bet
                  const { error: voidError } = await supabase
                    .from('live_game_bets')
                    .update({
                      status: 'voided',
                      void_reason: `${event.event_type} occurred during TV delay window`,
                    })
                    .eq('id', bet.id)

                  if (!voidError) {
                    // Refund the bet amount
                    await supabase.rpc('refund_voided_bet', {
                      p_entry_id: bet.entry_id,
                      p_amount: bet.amount,
                    })
                    totalBetsVoided++
                    console.log(`[sync-live-events] Voided bet ${bet.id} due to ${event.event_type} at ${event.minute}'`)
                  }
                }
              }
            }
          }
        }
      }

      console.log(`[sync-live-events] Inserted ${matchEvents.length} events for fixture ${fixtureApiId}`)
    }

    return json({
      success: true,
      fixturesProcessed: fixtureApiIds.length,
      eventsInserted: totalEventsInserted,
      betsVoided: totalBetsVoided,
    }, 200, req)

  } catch (e) {
    console.error('[sync-live-events] Error:', e)
    return json({ error: (e as Error).message }, 500, req)
  }
})
