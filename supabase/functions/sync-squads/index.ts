// Rolling squad refresh — re-reads API-Football current squads a slice of teams at a
// time and keeps fb_player_team_association + shirt_number current (which club a
// player is in, and their number). Cron-invoked; advances a rotating cursor so the
// whole pool is refreshed over a couple of days without ever blowing the worker limit.
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const db = createClient(SUPABASE_URL, SERVICE_KEY)
    const body = await req.json().catch(() => ({} as any))
    const limit: number = body.limit ?? 40

    // Rolling cursor over all teams that have a squad.
    const { data: st } = await db.from('fb_squad_sync').select('next_offset').eq('id', 1).maybeSingle()
    const offset = st?.next_offset ?? 0
    const { data: teams } = await db.rpc('fb_teams_with_squads', { p_offset: offset, p_limit: limit })
    const list: { id: string; api_id: number }[] = teams ?? []

    let squadUpserts = 0, numbersSet = 0
    for (const t of list) {
      let sr: any
      try { sr = await api('/players/squads', { team: t.api_id }) } catch (_) { continue }
      const squad = sr.response?.[0]?.players ?? []
      if (!squad.length) continue
      // Ensure players exist, then upsert associations with shirt numbers.
      for (const p of squad) {
        if (!p.id) continue
        let pid: string | null = null
        const { data: ex } = await db.from('fb_players').select('id').eq('api_id', p.id).maybeSingle()
        if (ex) pid = ex.id
        else {
          const { first, last } = splitName(p.name)
          const { data: ins } = await db.from('fb_players').upsert({ api_id: p.id, name: p.name ?? 'Unknown', first_name: first, last_name: last, nationality: 'Unknown', birthdate: '2000-01-01', photo_url: p.photo ?? '', photo: p.photo ?? null, position: p.position ?? 'Unknown' }, { onConflict: 'api_id' }).select('id').single()
          pid = ins?.id ?? null
        }
        if (!pid) continue
        await db.from('fb_player_team_association').upsert({ player_id: pid, team_id: t.id, start_date: '2025-07-01', shirt_number: p.number ?? null }, { onConflict: 'player_id,team_id' })
        squadUpserts++; if (p.number != null) numbersSet++
      }
    }

    const total = (await db.from('fb_teams').select('id', { count: 'exact', head: true })).count ?? 1
    const nextOffset = list.length < limit ? 0 : (offset + limit) % Math.max(total, 1)
    await db.from('fb_squad_sync').update({ next_offset: nextOffset }).eq('id', 1)

    return new Response(JSON.stringify({ ok: true, processed: list.length, offset, nextOffset, squadUpserts, numbersSet }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
