// Box2Box grid generator: 3 rows + 3 cols of criteria, every cell (row∩col) solvable
// (≥1 valid player in the indexed pool). Body: { count, start_date, reset? }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
function shuffle<T>(a: T[]): T[] { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// marquee trophy -> clean label (shared with the client)
function trophyLabel(raw: string): string | null {
  const t = (raw || '').toLowerCase();
  if (t.includes('champions league winner')) return 'CHAMPIONS LEAGUE';
  if (t.includes("ballon d'or")) return "BALLON D'OR";
  if (t.includes('world cup winner') && !t.includes('club')) return 'WORLD CUP';
  if (t.includes('europa league')) return 'EUROPA LEAGUE';
  if (t.includes('spanish champion')) return 'LALIGA TITLE';
  if (t.includes('english champion') || t.includes('premier league')) return 'PREMIER LEAGUE';
  if (t.includes('italian champion') || t.includes('serie a')) return 'SERIE A TITLE';
  if (t.includes('german champion') || t.includes('bundesliga')) return 'BUNDESLIGA TITLE';
  if (t.includes('french champion') || t.includes('ligue 1')) return 'LIGUE 1 TITLE';
  return null;
}
type Player = { id: number; n: string; nat: string | null; by: number | null; cl: string[] | null; trClean: Set<string> };
function fits(p: Player, c: any): boolean {
  if (c.type === 'club') return !!p.cl?.includes(c.value);
  if (c.type === 'nat') return p.nat === c.value;
  if (c.type === 'born') return p.by != null && p.by >= c.value && p.by <= c.value + 9;
  if (c.type === 'trophy') return p.trClean.has(c.value);
  return false;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { count = 3, start_date, reset = false } = await req.json();
    const db = createClient(SUPABASE_URL, SERVICE_KEY);
    if (reset) await db.from('puzzle_games').delete().eq('game_type', 'grid').eq('level', 'daily');

    const { data: idx } = await db.rpc('puzzle_grid_index');
    const P: Player[] = (idx ?? []).map((p: any) => ({ id: p.id, n: p.n, nat: p.nat, by: p.by, cl: p.cl, trClean: new Set((p.tr ?? []).map(trophyLabel).filter(Boolean)) }));

    // build criteria
    type Crit = { type: string; value: any; label: string };
    const crits: Crit[] = [];
    const inc = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
    const clubM = new Map<string, number>(), natM = new Map<string, number>(), troM = new Map<string, number>();
    for (const p of P) { for (const c of (p.cl ?? [])) inc(clubM, c); if (p.nat && p.nat !== 'Unknown') inc(natM, p.nat); for (const t of p.trClean) inc(troM, t); }
    const MIN = 5;
    // only recognizable clubs become criteria (exact names as stored in tm_transfers)
    const CLUBS = new Set(['Barcelona', 'Real Madrid', 'Atlético', 'Valencia', 'Sevilla FC', 'Real Sociedad', 'Real Betis', 'Villarreal', 'Athletic Club', 'Celta de Vigo', 'Espanyol', 'Man City', 'AC Milan', 'Porto', 'Chelsea', 'Tottenham', 'Ajax', 'Man Utd', 'Monaco', 'Lyon', 'Marseille', 'Wolves', 'Inter', 'Juventus', 'Bayern Munich', 'Borussia Dortmund', 'Liverpool', 'Arsenal', 'Paris Saint-Germain', 'Napoli', 'Benfica', 'Sporting CP', 'RB Leipzig', 'Bayer 04 Leverkusen', 'Manchester City']);
    for (const [c, n] of clubM) if (n >= MIN && CLUBS.has(c)) crits.push({ type: 'club', value: c, label: c.toUpperCase() });
    for (const [c, n] of natM) if (n >= MIN) crits.push({ type: 'nat', value: c, label: c.toUpperCase() });
    for (const [c, n] of troM) if (n >= MIN) crits.push({ type: 'trophy', value: c, label: c });
    for (const dec of [1990, 2000]) { const n = P.filter(p => p.by != null && p.by >= dec && p.by <= dec + 9).length; if (n >= MIN) crits.push({ type: 'born', value: dec, label: `BORN IN THE ${dec}s` }); }

    const cellOk = (r: Crit, c: Crit) => P.some(p => fits(p, r) && fits(p, c));

    const sample: string[] = [];
    let made = 0;
    const { data: seqRow } = await db.from('puzzle_games').select('seq').eq('game_type', 'grid').eq('level', 'daily').order('seq', { ascending: false }).limit(1);
    let seq = seqRow?.[0]?.seq ?? 0;

    for (let g = 0; g < count; g++) {
      let grid = null;
      for (let attempt = 0; attempt < 600 && !grid; attempt++) {
        const six = shuffle([...crits]).slice(0, 6);
        const rows = six.slice(0, 3), cols = six.slice(3, 6);
        if (rows.some(r => cols.some(c => r.type === c.type && r.value === c.value))) continue;   // no identical r/c
        // at least one club axis (recognizable), and variety
        if (new Set(six.map(c => c.type)).size < 2) continue;
        let ok = true;
        for (const r of rows) { for (const c of cols) { if (!cellOk(r, c)) { ok = false; break; } } if (!ok) break; }
        if (ok) grid = { rows, cols };
      }
      if (!grid) continue;
      made++;
      const { data: gm, error: ge } = await db.from('puzzle_games').insert({
        game_type: 'grid', level: 'daily', puzzle_date: addDays(start_date, g), seq: seq + made, status: 'scheduled',
      }).select('id').single();
      if (ge || !gm) { sample.push('insert failed: ' + ge?.message); break; }
      await db.from('puzzle_rounds').insert({ game_id: gm.id, round_no: 1, payload: grid });
      sample.push('rows: ' + grid.rows.map(r => r.label).join(' / ') + ' || cols: ' + grid.cols.map(c => c.label).join(' / '));
    }
    return new Response(JSON.stringify({ ok: true, games: made, criteria: crits.length, pool: P.length, sample }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
function addDays(d: string, n: number): string { const dt = new Date(d + 'T00:00:00Z'); dt.setUTCDate(dt.getUTCDate() + n); return dt.toISOString().slice(0, 10); }
