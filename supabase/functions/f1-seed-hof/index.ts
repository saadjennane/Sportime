// Seeds the F1 Hall of Fame candidate pool (drivers + constructors) from a curated
// iconic list, resolving photos via Wikidata (P18 for drivers, club logo via
// f1_constructors or Wikidata P154 for constructors). Idempotent. POST {} to run.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const UA = 'SportimeFanPulse/1.0 (contact@sportime.app)'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Curated, roughly by GOAT stature (drives the default sort).
const DRIVERS = [
  'Ayrton Senna', 'Michael Schumacher', 'Lewis Hamilton', 'Juan Manuel Fangio', 'Alain Prost',
  'Max Verstappen', 'Niki Lauda', 'Jackie Stewart', 'Jim Clark', 'Sebastian Vettel',
  'Fernando Alonso', 'Nelson Piquet', 'Nigel Mansell', 'Stirling Moss', 'Gilles Villeneuve',
  'Mika Häkkinen', 'Kimi Räikkönen', 'Jenson Button', 'Damon Hill', 'Emerson Fittipaldi',
  'Mario Andretti', 'Alberto Ascari', 'Jack Brabham', 'Graham Hill',
]
const CONSTRUCTORS = [
  'Ferrari', 'McLaren', 'Williams', 'Mercedes', 'Red Bull Racing', 'Lotus',
  'Brabham', 'Renault', 'Tyrrell', 'Benetton', 'Cooper', 'BRM',
]

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

async function searchQID(name: string, hint: string): Promise<string | null> {
  const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&type=item&limit=10&search=${encodeURIComponent(name)}`
  const r = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!r.ok) return null
  const j = await r.json()
  const results: any[] = j.search ?? []
  const best = results.find((x) => (x.description || '').toLowerCase().includes(hint)) ?? results[0]
  return best?.id ?? null
}
async function getImage(qid: string, props: string[]): Promise<string | null> {
  for (const p of props) {
    const url = `https://www.wikidata.org/w/api.php?action=wbgetclaims&format=json&entity=${qid}&property=${p}`
    const r = await fetch(url, { headers: { 'User-Agent': UA } })
    if (!r.ok) continue
    const j = await r.json()
    const file = j.claims?.[p]?.[0]?.mainsnak?.datavalue?.value
    if (typeof file === 'string' && file) return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=400`
  }
  return null
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 })
  const db = createClient(SUPABASE_URL, SERVICE_KEY)
  const out = { drivers: 0, constructors: 0, missing: [] as string[] }

  // Drivers — Wikidata photo
  const driverRows: any[] = []
  for (let i = 0; i < DRIVERS.length; i++) {
    const name = DRIVERS[i]
    const qid = await searchQID(name, 'racing driver')
    const img = qid ? await getImage(qid, ['P18']) : null
    if (!img) out.missing.push(name)
    driverRows.push({ kind: 'driver', key: slug(name), name, image: img, sort_order: i, meta: { qid } })
  }
  if (driverRows.length) { await db.from('f1_hof_candidates').upsert(driverRows, { onConflict: 'kind,key' }); out.drivers = driverRows.length }

  // Constructors — prefer our own logo (current teams), else Wikidata logo/photo
  const { data: teams } = await db.from('f1_constructors').select('name, logo')
  const teamLogo = (n: string): string | null => {
    const t = (teams ?? []).find((x: any) => (x.name || '').toLowerCase().includes(n.toLowerCase()))
    return t?.logo ?? null
  }
  const conRows: any[] = []
  for (let i = 0; i < CONSTRUCTORS.length; i++) {
    const name = CONSTRUCTORS[i]
    let img = teamLogo(name)
    if (!img) { const qid = await searchQID(`${name} Formula One`, 'formula one'); img = qid ? await getImage(qid, ['P154', 'P18']) : null }
    if (!img) out.missing.push(`(con) ${name}`)
    conRows.push({ kind: 'constructor', key: slug(name), name, image: img, sort_order: i, meta: {} })
  }
  if (conRows.length) { await db.from('f1_hof_candidates').upsert(conRows, { onConflict: 'kind,key' }); out.constructors = conRows.length }

  return new Response(JSON.stringify({ success: true, ...out }), { headers: { 'Content-Type': 'application/json' } })
})
