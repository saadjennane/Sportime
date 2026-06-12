// Create a Live Fantasy game for a fixture from its official lineup. Body: { fixture_id }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const API_KEY = Deno.env.get('API_FOOTBALL_KEY') ?? Deno.env.get('API_SPORTS_KEY')!;
const API_HOST = 'v3.football.api-sports.io';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const photo = (id: number) => `https://media.api-sports.io/football/players/${id}.png`;
const POS: Record<string, string> = { G: 'GK', D: 'D', M: 'M', F: 'A' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { fixture_id } = await req.json();
    const db = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: fx } = await db.from('fb_fixtures').select('id,api_id,date,home_team_id(id,api_id),away_team_id(id,api_id)').eq('id', fixture_id).single();
    if (!fx) return new Response(JSON.stringify({ ok: false, error: 'fixture not found' }), { status: 404, headers: cors });
    const home = (fx as any).home_team_id, away = (fx as any).away_team_id;

    const r = await fetch(`https://${API_HOST}/fixtures/lineups?fixture=${fx.api_id}`, { headers: { 'x-rapidapi-key': API_KEY, 'x-rapidapi-host': API_HOST } });
    const lu = await r.json();
    const resp = lu?.response;
    if (!Array.isArray(resp) || resp.length < 2) return new Response(JSON.stringify({ ok: false, error: 'no lineup yet' }), { headers: cors });

    // upsert players to get uuids
    const POSWORD: Record<string, string> = { G: 'Goalkeeper', D: 'Defender', M: 'Midfielder', F: 'Attacker' };
    const all: any[] = [];
    for (const e of resp) for (const it of (e.startXI ?? [])) { const p = it.player; if (p?.id) all.push({ api_id: p.id, name: p.name, pos: p.pos }); }
    await db.from('players').upsert(all.map(p => {
      const parts = String(p.name || 'Unknown').trim().split(/\s+/);
      return { api_id: p.api_id, name: p.name, first_name: parts[0] || 'Unknown', last_name: parts.slice(1).join(' ') || parts[0] || 'Unknown',
        photo: photo(p.api_id), photo_url: photo(p.api_id), nationality: 'Unknown', birthdate: '2000-01-01', position: POSWORD[p.pos] ?? 'Midfielder' };
    }), { onConflict: 'api_id', ignoreDuplicates: true });
    const { data: prows } = await db.from('players').select('id,api_id').in('api_id', all.map(p => p.api_id));
    const uuidByApi = new Map((prows ?? []).map((p: any) => [p.api_id, p.id]));

    // create the game
    const { data: g } = await db.from('lf_games').upsert({ fixture_id: fx.id, status: 'open', lock_at: fx.date }, { onConflict: 'fixture_id' }).select('id').single();
    const gid = g!.id;
    await db.from('lf_game_players').delete().eq('game_id', gid);

    const rows: any[] = [];
    for (const e of resp) {
      const teamApi = e.team?.id;
      const side = teamApi === home.api_id ? 'home' : teamApi === away.api_id ? 'away' : null;
      const teamUuid = side === 'home' ? home.id : away.id;
      if (!side) continue;
      for (const it of (e.startXI ?? [])) {
        const p = it.player; if (!p?.id || !uuidByApi.has(p.id)) continue;
        rows.push({ game_id: gid, player_id: uuidByApi.get(p.id), api_id: p.id, team_id: teamUuid, side, position: POS[p.pos] ?? 'M', name: p.name, photo: photo(p.id), shirt_no: p.number, is_starter: true, available: true, on_pitch: true });
      }
    }
    await db.from('lf_game_players').insert(rows);
    return new Response(JSON.stringify({ ok: true, game_id: gid, pool: rows.length }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
