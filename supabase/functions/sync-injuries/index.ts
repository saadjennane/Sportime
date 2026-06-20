// Daily injuries sync — flags players as injured when API-Football lists them as
// missing an UPCOMING fixture. Fan Pulse "Upcoming match" marks them with a cross
// (still selectable). Cron-invoked (anon key passes the gateway); service role writes.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const API_KEY = Deno.env.get('API_FOOTBALL_KEY')!
const API_HOST = 'v3.football.api-sports.io'
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const api = async (path: string, params: Record<string, unknown>, attempt = 0): Promise<any> => {
  const url = new URL(`https://${API_HOST}${path}`)
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, String(v))
  const r = await fetch(url, { headers: { 'x-rapidapi-key': API_KEY, 'x-rapidapi-host': API_HOST } })
  if (r.status === 429 && attempt < 5) { await sleep(6000); return api(path, params, attempt + 1) }
  if (!r.ok) throw new Error(`${path} -> ${r.status}`)
  return await r.json()
}

const DEFAULT_LEAGUES = [
  { id: 39, season: 2025 }, { id: 140, season: 2025 }, { id: 135, season: 2025 }, { id: 78, season: 2025 }, { id: 61, season: 2025 },
  { id: 94, season: 2025 }, { id: 203, season: 2025 }, { id: 88, season: 2025 }, { id: 307, season: 2025 }, { id: 253, season: 2026 },
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const db = createClient(SUPABASE_URL, SERVICE_KEY)
    const body = await req.json().catch(() => ({} as any))
    const leagues: { id: number; season: number }[] = body.leagues ?? DEFAULT_LEAGUES
    const today = new Date().toISOString().slice(0, 10)

    // 1. Resolve priority leagues' team api ids.
    const teamApiIds = new Set<number>()
    for (const lg of leagues) {
      try { const tr = await api('/teams', { league: lg.id, season: lg.season }); for (const t of (tr.response ?? [])) teamApiIds.add(t.team.id) } catch (_) { /* skip */ }
    }

    // 2. Per team, collect players listed as missing an upcoming fixture.
    const injuredApi = new Set<number>()
    const teamList = [...teamApiIds]
    const season = leagues[0]?.season ?? 2025
    const BATCH = 3
    for (let i = 0; i < teamList.length; i += BATCH) {
      if (i > 0) await sleep(600)
      await Promise.all(teamList.slice(i, i + BATCH).map(async (apiId) => {
        let jr: any
        try { jr = await api('/injuries', { team: apiId, season }) } catch (_) { return }
        for (const rec of (jr.response ?? [])) {
          const date = rec.fixture?.date?.slice(0, 10)
          if (date && date >= today && rec.player?.id) injuredApi.add(rec.player.id)
        }
      }))
    }

    // 3. Apply: clear everyone, then flag the currently-injured.
    await db.from('fb_players').update({ injured: false }).eq('injured', true)
    const ids = [...injuredApi]
    for (let i = 0; i < ids.length; i += 500) {
      await db.from('fb_players').update({ injured: true }).in('api_id', ids.slice(i, i + 500))
    }

    return new Response(JSON.stringify({ ok: true, teams: teamList.length, injured: ids.length, today }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
