// Football Connections generator: 4 groups of 4 players, mutually-exclusive categories
// (each of the 16 players satisfies exactly ONE of the 4 chosen categories -> unique solution).
// Body: { count?: number, start_date: 'YYYY-MM-DD', reset?: boolean }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const photoUrl = (id: number) => `https://media.api-sports.io/football/players/${id}.png`;
function shuffle<T>(a: T[]): T[] { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// marquee trophy -> clean category label (ignore the rest)
function trophyLabel(raw: string): string | null {
  const t = raw.toLowerCase();
  if (t.includes('champions league winner')) return 'WON THE CHAMPIONS LEAGUE';
  if (t.includes("ballon d'or")) return "WON THE BALLON D'OR";
  if (t.includes('world cup winner') && !t.includes('club')) return 'WON THE WORLD CUP';
  if (t.includes('europa league')) return 'WON THE EUROPA LEAGUE';
  if (t.includes('spanish champion')) return 'WON LALIGA';
  if (t.includes('english champion') || t.includes('premier league')) return 'WON THE PREMIER LEAGUE';
  if (t.includes('italian champion') || t.includes('serie a')) return 'WON SERIE A';
  if (t.includes('german champion') || t.includes('bundesliga')) return 'WON THE BUNDESLIGA';
  if (t.includes('french champion') || t.includes('ligue 1')) return 'WON LIGUE 1';
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { count = 3, start_date, reset = false } = await req.json();
    const db = createClient(SUPABASE_URL, SERVICE_KEY);
    if (reset) await db.from('puzzle_games').delete().eq('game_type', 'connections').eq('level', 'daily');

    // notable, recognizable players with a photo
    const { data: players } = await db.from('tm_players').select('player_id,name,nationality,current_market_value_eur')
      .not('name', 'is', null).order('current_market_value_eur', { ascending: false }).limit(700);
    const P = new Map<number, { name: string; nat: string | null; clubs: Set<string>; trophies: Set<string>; maxFee: number; val: number }>();
    for (const p of (players ?? [])) P.set(p.player_id, { name: p.name, nat: p.nationality, clubs: new Set(), trophies: new Set(), maxFee: 0, val: p.current_market_value_eur ?? 0 });

    // clubs from transfers
    const { data: tr } = await db.from('tm_transfers').select('player_id,from_club_name,to_club_name,fee_eur');
    for (const r of (tr ?? [])) { const e = P.get(r.player_id); if (!e) continue; if (r.from_club_name) e.clubs.add(r.from_club_name); if (r.to_club_name) e.clubs.add(r.to_club_name); if (r.fee_eur && r.fee_eur > e.maxFee) e.maxFee = r.fee_eur; }
    // trophies
    const { data: tro } = await db.from('tm_trophies').select('player_id,trophy');
    for (const r of (tro ?? [])) { const e = P.get(r.player_id); if (!e) continue; const lab = trophyLabel(r.trophy); if (lab) e.trophies.add(lab); }

    // build categories: { id, label, color-rank weight, test(pid), members[] }
    type Cat = { id: string; label: string; weight: number; test: (e: any) => boolean };
    const cats: Cat[] = [];
    const YOUTH = /(U1[5-9]|U2[0-3]|youth|yth|giov|reserve|castilla|without club|retired|career break|unknown|ablöse| B$| II$| C$)/i;
    // clubs (>=6 notable players)
    const clubCount = new Map<string, number>();
    for (const e of P.values()) for (const c of e.clubs) if (!YOUTH.test(c)) clubCount.set(c, (clubCount.get(c) ?? 0) + 1);
    for (const [club, n] of clubCount) if (n >= 6) cats.push({ id: 'club:' + club, label: 'PLAYED FOR ' + club.toUpperCase(), weight: n, test: (e) => e.clubs.has(club) });
    // nationalities (>=6)
    const natCount = new Map<string, number>();
    for (const e of P.values()) if (e.nat && e.nat !== 'Unknown') natCount.set(e.nat, (natCount.get(e.nat) ?? 0) + 1);
    for (const [nat, n] of natCount) if (n >= 6) cats.push({ id: 'nat:' + nat, label: 'FROM ' + nat.toUpperCase(), weight: n + 50, test: (e) => e.nat === nat });   // nat = easier
    // trophies (>=6)
    const troCount = new Map<string, number>();
    for (const e of P.values()) for (const t of e.trophies) troCount.set(t, (troCount.get(t) ?? 0) + 1);
    for (const [lab, n] of troCount) if (n >= 6) cats.push({ id: 'trophy:' + lab, label: lab, weight: n - 20, test: (e) => e.trophies.has(lab) });
    // fee thresholds
    for (const th of [100_000_000, 70_000_000]) {
      const lab = `€${th / 1_000_000}M+ TRANSFER`;
      const n = [...P.values()].filter(e => e.maxFee >= th).length;
      if (n >= 6) cats.push({ id: 'fee:' + th, label: lab, weight: n - 40, test: (e) => e.maxFee >= th });
    }

    const sample = [];
    let made = 0, seqBase = 0;
    const { data: seqRow } = await db.from('puzzle_games').select('seq').eq('game_type', 'connections').eq('level', 'daily').order('seq', { ascending: false }).limit(1);
    seqBase = seqRow?.[0]?.seq ?? 0;

    for (let g = 0; g < count; g++) {
      let built = null;
      for (let attempt = 0; attempt < 400 && !built; attempt++) {
        // varied pick: ≤1 nationality, ≤2 of any type, ≥3 distinct types
        const order = shuffle([...cats]); const pick: Cat[] = []; const tc: Record<string, number> = {};
        for (const c of order) { const t = c.id.split(':')[0]; const cap = t === 'nat' ? 1 : 2; if ((tc[t] ?? 0) >= cap) continue; pick.push(c); tc[t] = (tc[t] ?? 0) + 1; if (pick.length === 4) break; }
        if (pick.length < 4 || Object.keys(tc).length < 3) continue;
        // exclusive members per chosen category
        const groups: { cat: Cat; ids: number[] }[] = [];
        let ok = true;
        for (const c of pick) {
          const excl: { id: number; val: number }[] = [];
          for (const [pid, e] of P.entries()) {
            if (!c.test(e)) continue;
            if (pick.some(o => o.id !== c.id && o.test(e))) continue;   // ambiguous -> skip
            excl.push({ id: pid, val: e.val });
          }
          if (excl.length < 4) { ok = false; break; }
          excl.sort((a, b) => b.val - a.val);                          // prefer recognizable (high value)
          const top = shuffle(excl.slice(0, 12)).slice(0, 4);
          groups.push({ cat: c, ids: top.map(x => x.id) });
        }
        if (!ok) continue;
        built = groups;
      }
      if (!built) continue;
      // colors by difficulty (easiest = biggest weight = yellow)
      built.sort((a, b) => b.cat.weight - a.cat.weight);
      const colors = ['yellow', 'green', 'blue', 'purple'];
      const groupsOut = built.map((gr, i) => ({ key: gr.cat.id, label: gr.cat.label, color: colors[i], playerIds: gr.ids }));
      const playersOut = shuffle(built.flatMap(gr => gr.ids)).map(id => ({ id, name: P.get(id)!.name, photo: photoUrl(id) }));

      made++;
      const { data: gm, error: ge } = await db.from('puzzle_games').insert({
        game_type: 'connections', level: 'daily', puzzle_date: addDays(start_date, g), seq: seqBase + made, status: 'scheduled',
      }).select('id').single();
      if (ge || !gm) { sample.push('insert failed: ' + ge?.message); break; }
      await db.from('puzzle_rounds').insert({ game_id: gm.id, round_no: 1, payload: { players: playersOut, groups: groupsOut } });
      sample.push(groupsOut.map(x => `${x.color}:${x.label}`).join(' | '));
    }
    return new Response(JSON.stringify({ ok: true, games: made, categories: cats.length, sample }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
function addDays(d: string, n: number): string { const dt = new Date(d + 'T00:00:00Z'); dt.setUTCDate(dt.getUTCDate() + n); return dt.toISOString().slice(0, 10); }
