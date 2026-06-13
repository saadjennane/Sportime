// Live Fantasy autocreate: for activated upcoming matches whose official lineup is out,
// create the game + pool, and mark "notify me" subscribers. Runs on a cron.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const API_KEY = Deno.env.get('API_FOOTBALL_KEY') ?? Deno.env.get('API_SPORTS_KEY')!;
const API_HOST = 'v3.football.api-sports.io';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const photo = (id: number) => `https://media.api-sports.io/football/players/${id}.png`;
const POS: Record<string, string> = { G: 'GK', D: 'D', M: 'M', F: 'A' };
const POSWORD: Record<string, string> = { G: 'Goalkeeper', D: 'Defender', M: 'Midfielder', F: 'Attacker' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const db = createClient(SUPABASE_URL, SERVICE_KEY);
    // upcoming matches in the next ~2h
    const now = new Date(); const horizon = new Date(now.getTime() + 2 * 3600 * 1000);
    const { data: fixtures } = await db.from('fb_fixtures')
      .select('id,api_id,date,league_id,home_team_id(id,api_id),away_team_id(id,api_id)')
      .eq('status', 'NS').gte('date', now.toISOString()).lte('date', horizon.toISOString());

    // activation rules
    const { data: acts } = await db.from('lf_activation').select('scope,league_id,team_id,fixture_id,enabled');
    const globalOn = (acts ?? []).some((a: any) => a.scope === 'global' && a.enabled);
    const leagueOn = new Set((acts ?? []).filter((a: any) => a.scope === 'league' && a.enabled).map((a: any) => a.league_id));
    const teamOn = new Set((acts ?? []).filter((a: any) => a.scope === 'team' && a.enabled).map((a: any) => a.team_id));
    const matchOn = new Set((acts ?? []).filter((a: any) => a.scope === 'match' && a.enabled).map((a: any) => a.fixture_id));
    const matchOff = new Set((acts ?? []).filter((a: any) => a.scope === 'match' && !a.enabled).map((a: any) => a.fixture_id));
    const isActive = (fx: any) => !matchOff.has(fx.id) && (matchOn.has(fx.id) || teamOn.has(fx.home_team_id?.id) || teamOn.has(fx.away_team_id?.id) || leagueOn.has(fx.league_id) || globalOn);

    const { data: existing } = await db.from('lf_games').select('fixture_id');
    const hasGame = new Set((existing ?? []).map((g: any) => g.fixture_id));

    let created = 0;
    for (const fx of (fixtures ?? [])) {
      if (hasGame.has(fx.id) || !isActive(fx)) continue;
      const home = (fx as any).home_team_id, away = (fx as any).away_team_id;
      const r = await fetch(`https://${API_HOST}/fixtures/lineups?fixture=${fx.api_id}`, { headers: { 'x-rapidapi-key': API_KEY, 'x-rapidapi-host': API_HOST } });
      const lu = await r.json(); const resp = lu?.response;
      if (!Array.isArray(resp) || resp.length < 2) continue;   // lineup not out yet

      const all: any[] = [];
      for (const e of resp) for (const it of (e.startXI ?? [])) { const p = it.player; if (p?.id) all.push(p); }
      await db.from('players').upsert(all.map(p => { const parts = String(p.name || 'Unknown').trim().split(/\s+/); return { api_id: p.id, name: p.name, first_name: parts[0] || 'Unknown', last_name: parts.slice(1).join(' ') || parts[0] || 'Unknown', photo: photo(p.id), photo_url: photo(p.id), nationality: 'Unknown', birthdate: '2000-01-01', position: POSWORD[p.pos] ?? 'Midfielder' }; }), { onConflict: 'api_id', ignoreDuplicates: true });
      const { data: prows } = await db.from('players').select('id,api_id').in('api_id', all.map(p => p.id));
      const uuidByApi = new Map((prows ?? []).map((p: any) => [p.api_id, p.id]));

      const { data: g } = await db.from('lf_games').upsert({ fixture_id: fx.id, status: 'open', lock_at: fx.date }, { onConflict: 'fixture_id' }).select('id').single();
      const gid = g!.id; await db.from('lf_game_players').delete().eq('game_id', gid);
      const rows: any[] = [];
      for (const e of resp) {
        const side = e.team?.id === home.api_id ? 'home' : e.team?.id === away.api_id ? 'away' : null; if (!side) continue;
        const teamUuid = side === 'home' ? home.id : away.id;
        for (const it of (e.startXI ?? [])) { const p = it.player; if (!p?.id || !uuidByApi.has(p.id)) continue;
          rows.push({ game_id: gid, player_id: uuidByApi.get(p.id), api_id: p.id, team_id: teamUuid, side, position: POS[p.pos] ?? 'M', name: p.name, photo: photo(p.id), shirt_no: p.number, is_starter: true, available: true, on_pitch: true }); }
      }
      if (rows.length >= 14) { await db.from('lf_game_players').insert(rows); created++; await db.from('lf_notify').update({ notified: true }).eq('fixture_id', fx.id).eq('notified', false); }
      else { await db.from('lf_games').delete().eq('id', gid); }
    }
    return new Response(JSON.stringify({ ok: true, created }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
