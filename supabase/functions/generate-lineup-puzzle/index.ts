// Guess the Lineup generator: pick finished fixtures, fetch API-Football lineups,
// hide N random non-GK starters, store a client-side-playable round.
// Body: { scope: 'big'|'all', holes: 1|2|3, count: number, start_date: 'YYYY-MM-DD', rounds?: number }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const API_FOOTBALL_KEY = Deno.env.get('API_FOOTBALL_KEY')!;
const API_HOST = 'v3.football.api-sports.io';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const photoUrl = (id: number) => `https://media.api-sports.io/football/players/${id}.png`;

async function api(path: string, params: Record<string, string | number>) {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
  const r = await fetch(`https://${API_HOST}${path}?${qs}`, { headers: { 'x-rapidapi-key': API_FOOTBALL_KEY, 'x-rapidapi-host': API_HOST } });
  return await r.json();
}
function shuffle<T>(a: T[]): T[] { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { scope = 'big', holes = 1, count = 3, start_date, rounds = 5, reset = false } = await req.json();
    const db = createClient(SUPABASE_URL, SERVICE_KEY);
    const level = `${scope}_${holes}`;
    const POP_FLOOR = scope === 'big' ? 75 : 0;   // genuinely big clubs (top tier ~90+, mid ~45)
    if (reset) await db.from('puzzle_games').delete().eq('game_type', 'guess_lineup').eq('level', level);

    const { data: pops } = await db.from('team_popularity').select('team_api_id,popularity');
    const popMap = new Map((pops ?? []).map((p: any) => [p.team_api_id, p.popularity]));

    const { data: fixtures } = await db.from('fb_fixtures')
      .select('api_id,date,goals_home,goals_away,home_team_id(api_id,name,logo),away_team_id(api_id,name,logo),league_id(name)')
      .eq('status', 'FT').gte('date', '2018-08-01').order('date', { ascending: false }).limit(900);
    shuffle(fixtures ?? []);

    const { data: seqRow } = await db.from('puzzle_games').select('seq').eq('game_type', 'guess_lineup').eq('level', level).order('seq', { ascending: false }).limit(1);
    let seq = seqRow?.[0]?.seq ?? 0;

    let made = 0, rn = 0, gid: string | null = null, attempts = 0;
    const log: string[] = [];
    for (const fx of (fixtures ?? [])) {
      if (made >= count && rn === 0) break;
      if (attempts++ > 400) break;
      const home = (fx as any).home_team_id, away = (fx as any).away_team_id;
      if (!home?.api_id || !away?.api_id) continue;
      // scope pre-filter: at least one popular team for 'big'
      if (scope === 'big' && Math.max(popMap.get(home.api_id) ?? 0, popMap.get(away.api_id) ?? 0) < POP_FLOOR) continue;

      const lu = await api('/fixtures/lineups', { fixture: fx.api_id });
      const resp = lu?.response;
      if (!Array.isArray(resp) || resp.length < 2) continue;

      const entries = resp.map((e: any) => ({ teamId: e.team?.id, formation: e.formation, startXI: e.startXI ?? [] }))
        .filter((e: any) => e.formation && e.startXI.length >= 11);
      if (entries.length < 1) continue;
      // choose the team to show: most popular; require floor for 'big'
      entries.sort((a: any, b: any) => (popMap.get(b.teamId) ?? 0) - (popMap.get(a.teamId) ?? 0));
      const show = entries[0];
      if ((popMap.get(show.teamId) ?? 0) < POP_FLOOR) continue;

      const showIsHome = show.teamId === home.api_id;
      const showTeam = showIsHome ? home : away;
      const oppTeam = showIsHome ? away : home;
      const starters = show.startXI.map((s: any) => s.player).filter((p: any) => p?.id && p?.grid);
      const outfield = starters.filter((p: any) => p.pos !== 'G');
      if (outfield.length < holes) continue;

      const chosen = shuffle([...outfield]).slice(0, holes);
      const chosenIds = new Set(chosen.map((c: any) => c.id));
      const { data: fp } = await db.from('fb_players').select('api_id,nationality').in('api_id', chosen.map((c: any) => c.id));
      const natMap = new Map((fp ?? []).map((p: any) => [p.api_id, p.nationality]));

      const visible = starters.filter((p: any) => !chosenIds.has(p.id)).map((p: any) => ({ id: p.id, name: p.name, number: p.number, pos: p.pos, grid: p.grid, photo: photoUrl(p.id) }));
      const holesArr = chosen.map((c: any) => ({
        grid: c.grid,
        answer: { id: c.id, name: c.name, number: c.number, position: c.pos, photo: photoUrl(c.id), nationality: natMap.get(c.id) ?? null },
      }));

      const payload = {
        fixture_api_id: fx.api_id,
        team: { id: showTeam.api_id, name: showTeam.name, logo: showTeam.logo },
        opponent: { id: oppTeam.api_id, name: oppTeam.name, logo: oppTeam.logo },
        competition: (fx as any).league_id?.name ?? null,
        date: String(fx.date).slice(0, 10),
        score: { team: showIsHome ? fx.goals_home : fx.goals_away, opp: showIsHome ? fx.goals_away : fx.goals_home },
        formation: show.formation,
        starters: visible,
        holes: holesArr,
      };

      if (rn === 0) {
        seq++; made++;
        const { data: g, error: ge } = await db.from('puzzle_games').insert({
          game_type: 'guess_lineup', level, puzzle_date: addDays(start_date, made - 1), seq, status: 'scheduled',
        }).select('id').single();
        if (ge || !g) { log.push(`insert game failed: ${ge?.message}`); made--; seq--; break; }
        gid = g.id;
      }
      rn++;
      await db.from('puzzle_rounds').insert({ game_id: gid, round_no: rn, answer_player_id: holesArr[0].answer.id, payload });
      log.push(`${showTeam.name} vs ${oppTeam.name} (${payload.competition} ${payload.date}) holes=${holesArr.map((h: any) => h.answer.name).join(', ')}`);
      if (rn === rounds) rn = 0;
    }
    return new Response(JSON.stringify({ ok: true, games: made, level, sample: log.slice(0, 12) }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});

function addDays(d: string, n: number): string { const dt = new Date(d + 'T00:00:00Z'); dt.setUTCDate(dt.getUTCDate() + n); return dt.toISOString().slice(0, 10); }
