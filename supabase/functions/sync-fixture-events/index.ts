// Capture live match events + statistics into fb_fixture_events / fb_fixture_statistics.
// Auto-detects live fixtures (or takes explicit api_fixture_ids). Run frequently by cron.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const API_FOOTBALL_KEY = Deno.env.get('API_FOOTBALL_KEY')!
const API_HOST = 'v3.football.api-sports.io'
const LIVE = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'SUSP', 'INT', 'LIVE']
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

async function api(path: string, params: Record<string, unknown>) {
  const url = new URL(`https://${API_HOST}${path}`)
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, String(v))
  const r = await fetch(url, { headers: { 'x-rapidapi-key': API_FOOTBALL_KEY, 'x-rapidapi-host': API_HOST } })
  if (!r.ok) throw new Error(`API ${path} -> ${r.status}`)
  return await r.json()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const body = await req.json().catch(() => ({}))
    const db = createClient(SUPABASE_URL, SERVICE_KEY)

    // Which fixtures to capture: explicit ids, else all currently-live fixtures.
    let targets: { id: string; api_id: number }[] = []
    if (Array.isArray(body.api_fixture_ids) && body.api_fixture_ids.length) {
      const { data } = await db.from('fb_fixtures').select('id, api_id').in('api_id', body.api_fixture_ids)
      targets = (data ?? []) as any
    } else {
      const { data } = await db.from('fb_fixtures').select('id, api_id').in('status', LIVE).limit(50)
      targets = (data ?? []) as any
    }
    if (targets.length === 0) return new Response(JSON.stringify({ ok: true, fixtures: 0, note: 'no live fixtures' }), { headers: { ...cors, 'Content-Type': 'application/json' } })

    let evCount = 0, stCount = 0
    for (const fx of targets) {
      // Events — replace the fixture's set (idempotent).
      try {
        const ev = await api('/fixtures/events', { fixture: fx.api_id })
        const rows = (ev.response ?? []).map((e: any, i: number) => ({
          fixture_id: fx.id, api_fixture_id: fx.api_id, seq: i,
          elapsed: e.time?.elapsed ?? null, extra: e.time?.extra ?? null,
          team_api_id: e.team?.id ?? null, team_name: e.team?.name ?? null,
          player: e.player?.name ?? null, assist: e.assist?.name ?? null,
          type: e.type ?? null, detail: e.detail ?? null, comments: e.comments ?? null,
        }))
        await db.from('fb_fixture_events').delete().eq('api_fixture_id', fx.api_id)
        if (rows.length) { await db.from('fb_fixture_events').insert(rows); evCount += rows.length }
      } catch (e) { console.error('events', fx.api_id, String(e)) }

      // Statistics — upsert per team+type.
      try {
        const st = await api('/fixtures/statistics', { fixture: fx.api_id })
        const rows: any[] = []
        for (const t of (st.response ?? [])) for (const s of (t.statistics ?? []))
          rows.push({ fixture_id: fx.id, api_fixture_id: fx.api_id, team_api_id: t.team?.id ?? 0, team_name: t.team?.name ?? null, stat_type: s.type ?? '', stat_value: s.value == null ? null : String(s.value), updated_at: new Date().toISOString() })
        if (rows.length) { await db.from('fb_fixture_statistics').upsert(rows, { onConflict: 'api_fixture_id,team_api_id,stat_type' }); stCount += rows.length }
      } catch (e) { console.error('stats', fx.api_id, String(e)) }
    }

    return new Response(JSON.stringify({ ok: true, fixtures: targets.length, events: evCount, stats: stCount }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message ?? e) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
