// On-demand Fan Pulse legends seeder. Resolves a club's Wikidata entity, pulls its
// all-time roster (P54) with positions (P413), photos (P18) and appearances (P1350),
// and inserts the notable ones into fan_pulse_legends. Idempotent per team.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const UA = 'SportimeFanPulse/1.0 (saadjennane@gmail.com)'

const bucket = (l: string): string | null => {
  l = (l || '').toLowerCase()
  if (/goalkeep|keeper|portero|gardien|torwart/.test(l)) return 'GK'
  if (/back|defend|defens|libero|sweeper|verteidig/.test(l)) return 'DEF'
  if (/midfield|centrocamp|milieu|playmaker|mittelfeld/.test(l)) return 'MID'
  if (/forward|strik|wing|delanter|attack|avant|stürmer|striker/.test(l)) return 'FWD'
  return null
}

// Resolve a club name to its Wikidata QID (prefer entities described as football clubs).
async function resolveClubQid(name: string): Promise<string | null> {
  const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&type=item&limit=8&search=${encodeURIComponent(name)}`
  const r = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!r.ok) return null
  const j = await r.json()
  const hits = j.search ?? []
  const football = hits.find((h: any) => /football|soccer|fútbol|futebol/i.test(h.description ?? ''))
  return (football ?? hits[0])?.id ?? null
}

async function fetchRoster(qid: string): Promise<{ key: string; name: string; pos: string | null; img: string | null; apps: number }[]> {
  const sparql = `SELECT ?p ?pLabel ?posLabel ?img (MAX(?app) AS ?apps) WHERE {
    ?p wdt:P54 wd:${qid} .
    OPTIONAL { ?p wdt:P413 ?pos . }
    OPTIONAL { ?p wdt:P18 ?img . }
    OPTIONAL { ?p p:P54 ?st . ?st ps:P54 wd:${qid} . ?st pq:P1350 ?app . }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en,es,ca,fr,pt,de,it". }
  } GROUP BY ?p ?pLabel ?posLabel ?img`
  const url = 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(sparql)
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' } })
  if (!r.ok) throw new Error(`SPARQL ${r.status}`)
  const j = await r.json()
  const m: Record<string, any> = {}
  for (const b of j.results.bindings) {
    const key = b.p.value.split('/').pop()
    const name = b.pLabel?.value || ''
    if (/^Q\d+$/.test(name)) continue
    const pos = bucket(b.posLabel?.value)
    const apps = b.apps ? Number(b.apps.value) : 0
    if (!m[key]) m[key] = { key, name, pos: null, img: null, apps: 0 }
    if (pos && !m[key].pos) m[key].pos = pos
    if (b.img?.value && !m[key].img) m[key].img = b.img.value
    if (apps > m[key].apps) m[key].apps = apps
  }
  return Object.values(m)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { team_id, team_name } = await req.json()
    if (!team_id || !team_name) throw new Error('team_id and team_name required')
    const db = createClient(SUPABASE_URL, SERVICE_KEY)

    // Already seeded? return early.
    const { count } = await db.from('fan_pulse_legends').select('id', { count: 'exact', head: true }).eq('team_id', team_id)
    if ((count ?? 0) > 0) return new Response(JSON.stringify({ ok: true, already: true, count }), { headers: { ...cors, 'Content-Type': 'application/json' } })

    const qid = await resolveClubQid(team_name)
    if (!qid) return new Response(JSON.stringify({ ok: true, count: 0, reason: 'no_wikidata_club' }), { headers: { ...cors, 'Content-Type': 'application/json' } })

    const roster = await fetchRoster(qid)
    // Notable: ≥40 appearances; if too few, fall back to the most-capped with a position.
    let notable = roster.filter(p => p.apps >= 40)
    if (notable.length < 22) notable = roster.filter(p => p.pos || p.apps > 0).sort((a, b) => b.apps - a.apps).slice(0, 120)
    notable.sort((a, b) => b.apps - a.apps)

    const rows = notable.map((p, i) => ({
      team_id, player_key: p.key, name: p.name,
      position: p.pos ?? 'MID', // unknown → outfield (still selectable for outfield slots)
      photo_url: p.img ?? null, sort_order: i,
    }))
    if (rows.length) await db.from('fan_pulse_legends').upsert(rows, { onConflict: 'team_id,player_key' })

    return new Response(JSON.stringify({ ok: true, qid, count: rows.length }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
