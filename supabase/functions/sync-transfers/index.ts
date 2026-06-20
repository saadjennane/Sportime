// Daily transfers sync — keeps team rosters current by applying recent moves from
// API-Football's /transfers endpoint on top of the imported squads.
// Cron-invoked (anon key passes the gateway); uses the service role for writes.
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
const splitName = (name: string) => {
  const parts = (name || '').trim().split(' ')
  return parts.length < 2 ? { first: parts[0] || 'Unknown', last: 'Unknown' } : { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] }
}

// Priority leagues (api-football ids) + the season to resolve their teams from.
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
    const recentDays: number = body.recent_days ?? 45
    const cutoff = new Date(Date.now() - recentDays * 86400000).toISOString().slice(0, 10)

    // 1. Resolve the priority leagues' teams (api id) → our fb_teams uuid.
    const teamApiIds = new Set<number>()
    for (const lg of leagues) {
      try {
        const tr = await api('/teams', { league: lg.id, season: lg.season })
        for (const t of (tr.response ?? [])) teamApiIds.add(t.team.id)
      } catch (_) { /* skip league on error */ }
    }
    const { data: teamRows } = await db.from('fb_teams').select('id, api_id').in('api_id', [...teamApiIds])
    const teamUuid = new Map<number, string>((teamRows ?? []).map((t: any) => [t.api_id, t.id]))

    let moves = 0, added = 0, removed = 0, newPlayers = 0

    const resolvePlayer = async (p: any): Promise<string | null> => {
      const { data: existing } = await db.from('fb_players').select('id').eq('api_id', p.id).maybeSingle()
      if (existing) return existing.id
      const { first, last } = splitName(p.name)
      const { data: ins } = await db.from('fb_players').upsert({
        api_id: p.id, name: p.name ?? 'Unknown', first_name: first, last_name: last,
        nationality: 'Unknown', birthdate: '2000-01-01', photo_url: '', photo: null, position: 'Unknown',
      }, { onConflict: 'api_id' }).select('id').single()
      if (ins) newPlayers++
      return ins?.id ?? null
    }

    // 2. Per team, apply the player's most-recent transfer if it's within the window.
    const teamList = [...teamUuid.entries()] // [apiId, uuid]
    const BATCH = 3
    for (let i = 0; i < teamList.length; i += BATCH) {
      if (i > 0) await sleep(700)
      await Promise.all(teamList.slice(i, i + BATCH).map(async ([apiId, uuid]) => {
        let tr: any
        try { tr = await api('/transfers', { team: apiId }) } catch (_) { return }
        for (const entry of (tr.response ?? [])) {
          const list = [...(entry.transfers ?? [])].sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''))
          const latest = list[0]
          if (!latest || (latest.date || '') < cutoff) continue
          const inId = latest.teams?.in?.id, outId = latest.teams?.out?.id
          if (inId !== apiId && outId !== apiId) continue
          const pid = await resolvePlayer(entry.player)
          if (!pid) continue
          moves++
          if (inId === apiId) {
            await db.from('fb_player_team_association').upsert({ player_id: pid, team_id: uuid, start_date: latest.date }, { onConflict: 'player_id,team_id' })
            added++
            const outUuid = outId ? teamUuid.get(outId) : null
            if (outUuid) await db.from('fb_player_team_association').delete().eq('player_id', pid).eq('team_id', outUuid)
          } else if (outId === apiId) {
            await db.from('fb_player_team_association').delete().eq('player_id', pid).eq('team_id', uuid)
            removed++
          }
        }
      }))
    }

    return new Response(JSON.stringify({ ok: true, teams: teamList.length, moves, added, removed, newPlayers, cutoff }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
