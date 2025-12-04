import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncRequest {
  league_id: string;
  min_appearances?: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { league_id, min_appearances = 5 }: SyncRequest = await req.json()

    if (!league_id) {
      throw new Error('league_id is required')
    }

    console.log(`[sync-league-fantasy-players] Starting sync for league: ${league_id}`)

    // Get current season
    const currentYear = new Date().getFullYear()

    // Fetch player season stats for the league
    const { data: playerStats, error: fetchError } = await supabaseClient
      .from('player_season_stats')
      .select(`
        player_id,
        pgs,
        appearances,
        players:player_id (
          id,
          first_name,
          last_name,
          position,
          photo_url,
          birthdate
        )
      `)
      .eq('league_id', league_id)
      .eq('season', currentYear)
      .gte('appearances', min_appearances)
      .order('pgs', { ascending: false })

    if (fetchError) {
      console.error('[sync-league-fantasy-players] Error fetching player stats:', fetchError)
      throw fetchError
    }

    if (!playerStats || playerStats.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          synced: 0,
          message: `No players found for league ${league_id} with minimum ${min_appearances} appearances`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[sync-league-fantasy-players] Found ${playerStats.length} players to sync`)

    // Calculate status from PGS
    const calculateStatus = (pgs: number): 'Star' | 'Key' | 'Wild' => {
      if (pgs >= 7.5) return 'Star'
      if (pgs >= 6.0) return 'Key'
      return 'Wild'
    }

    // Prepare fantasy league players data
    const fantasyPlayers = playerStats
      .filter(stat => stat.players) // Ensure player exists
      .map(stat => ({
        league_id,
        player_id: stat.player_id,
        status: calculateStatus(stat.pgs || 0),
        pgs: stat.pgs || 0,
        is_available: true,
      }))

    // Upsert fantasy league players
    const { error: upsertError } = await supabaseClient
      .from('fantasy_league_players')
      .upsert(fantasyPlayers, {
        onConflict: 'league_id,player_id',
        ignoreDuplicates: false
      })

    if (upsertError) {
      console.error('[sync-league-fantasy-players] Error upserting players:', upsertError)
      throw upsertError
    }

    console.log(`[sync-league-fantasy-players] Successfully synced ${fantasyPlayers.length} players`)

    return new Response(
      JSON.stringify({
        success: true,
        synced: fantasyPlayers.length,
        message: `Successfully synced ${fantasyPlayers.length} players for league`,
        breakdown: {
          star: fantasyPlayers.filter(p => p.status === 'Star').length,
          key: fantasyPlayers.filter(p => p.status === 'Key').length,
          wild: fantasyPlayers.filter(p => p.status === 'Wild').length,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[sync-league-fantasy-players] Error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
