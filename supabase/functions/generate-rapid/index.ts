// Rapid Fire generator: a daily question = one criterion (club/nat/trophy/born).
// Answer set is derived client-side from the attribute index. Body: { count, start_date, reset? }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
function shuffle<T>(a: T[]): T[] { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
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
const CLUBS = new Set(['Barcelona', 'Real Madrid', 'Atlético', 'Valencia', 'Sevilla FC', 'Real Sociedad', 'Real Betis', 'Villarreal', 'Athletic Club', 'Celta de Vigo', 'Espanyol', 'Man City', 'AC Milan', 'Porto', 'Chelsea', 'Tottenham', 'Ajax', 'Man Utd', 'Monaco', 'Lyon', 'Marseille', 'Wolves', 'Inter', 'Juventus', 'Bayern Munich', 'Borussia Dortmund', 'Liverpool', 'Arsenal', 'Paris Saint-Germain', 'Napoli', 'Benfica', 'Sporting CP']);
const BIG_CLUBS = new Set(['Barcelona', 'Real Madrid', 'Atlético', 'Man City', 'Chelsea', 'Man Utd', 'Liverpool', 'Arsenal', 'Bayern Munich', 'Juventus', 'Inter', 'AC Milan', 'Paris Saint-Germain', 'Borussia Dortmund', 'Ajax']);
const BIG_NATIONS = new Set(['Brazil', 'France', 'Spain', 'Argentina', 'England', 'Germany', 'Italy', 'Portugal', 'Netherlands', 'Belgium']);
function difficultyOf(type: string, value: any, n: number): string {
  if (type === 'born') return 'easy';
  if (type === 'nat') return BIG_NATIONS.has(value) ? 'easy' : 'hard';
  if (type === 'club') return BIG_CLUBS.has(value) ? 'easy' : 'hard';   // mid/obscure clubs are hard to list
  if (type === 'trophy') return value === "BALLON D'OR" ? 'hard' : 'medium';
  return 'medium';
}

const TROPHY_PHRASE: Record<string, string> = {
  'CHAMPIONS LEAGUE': 'the Champions League', "BALLON D'OR": "the Ballon d'Or", 'WORLD CUP': 'the World Cup',
  'EUROPA LEAGUE': 'the Europa League', 'LALIGA TITLE': 'a LaLiga title', 'PREMIER LEAGUE': 'a Premier League title',
  'SERIE A TITLE': 'a Serie A title', 'BUNDESLIGA TITLE': 'a Bundesliga title', 'LIGUE 1 TITLE': 'a Ligue 1 title',
};
function question(type: string, value: any): string {
  if (type === 'club') return `Name players who have played for ${value}`;
  if (type === 'nat') return `Name players from ${value}`;
  if (type === 'trophy') return `Name players who have won ${TROPHY_PHRASE[value] ?? value}`;
  if (type === 'born') return `Name players born in the ${value}s`;
  return '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { count = 5, start_date, level = 'medium', reset = false } = await req.json();
    const db = createClient(SUPABASE_URL, SERVICE_KEY);
    if (reset) await db.from('puzzle_games').delete().eq('game_type', 'rapid').eq('level', level);

    const { data: idx } = await db.rpc('puzzle_grid_index');
    const P = (idx ?? []).map((p: any) => ({ nat: p.nat, by: p.by, cl: p.cl ?? [], tr: new Set((p.tr ?? []).map(trophyLabel).filter(Boolean)) }));

    // candidate criteria with answer-set size in [12, 120], tagged by difficulty
    type Crit = { type: string; value: any; n: number; diff: string };
    const cl = new Map<string, number>(), nat = new Map<string, number>(), tro = new Map<string, number>();
    for (const p of P) { for (const c of p.cl) if (CLUBS.has(c)) cl.set(c, (cl.get(c) ?? 0) + 1); if (p.nat && p.nat !== 'Unknown') nat.set(p.nat, (nat.get(p.nat) ?? 0) + 1); for (const t of p.tr) tro.set(t, (tro.get(t) ?? 0) + 1); }
    const crits: Crit[] = [];
    const add = (m: Map<string, number>, type: string) => { for (const [v, n] of m) if (n >= 20 && n <= 120) crits.push({ type, value: v, n, diff: difficultyOf(type, v, n) }); };
    add(cl, 'club'); add(nat, 'nat'); add(tro, 'trophy');
    for (const d of [1990, 2000]) { const n = P.filter((p: any) => p.by >= d && p.by <= d + 9).length; if (n >= 20 && n <= 120) crits.push({ type: 'born', value: d, n, diff: 'easy' }); }

    const pool = crits.filter(c => c.diff === level);
    const { data: seqRow } = await db.from('puzzle_games').select('seq').eq('game_type', 'rapid').eq('level', level).order('seq', { ascending: false }).limit(1);
    let seq = seqRow?.[0]?.seq ?? 0;
    const chosen = shuffle([...pool]).slice(0, count);
    const sample: string[] = [];
    let made = 0;
    for (const c of chosen) {
      made++;
      const payload = { type: c.type, value: c.value, label: question(c.type, c.value), total: c.n };
      const { data: gm, error: ge } = await db.from('puzzle_games').insert({
        game_type: 'rapid', level, puzzle_date: addDays(start_date, made - 1), seq: seq + made, status: 'scheduled',
      }).select('id').single();
      if (ge || !gm) { sample.push('insert failed: ' + ge?.message); break; }
      await db.from('puzzle_rounds').insert({ game_id: gm.id, round_no: 1, payload });
      sample.push(`${payload.label} (${c.n})`);
    }
    return new Response(JSON.stringify({ ok: true, games: made, candidates: crits.length, sample }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
function addDays(d: string, n: number): string { const dt = new Date(d + 'T00:00:00Z'); dt.setUTCDate(dt.getUTCDate() + n); return dt.toISOString().slice(0, 10); }
