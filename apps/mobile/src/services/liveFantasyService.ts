import { supabase } from './supabase';

export async function listAvailableLFGames() {
  if (!supabase) return [];
  const { data } = await supabase.from('lf_games')
    .select('id, fixture_id, status, lock_at, pot_amount, fixture:fixture_id(id, date, goals_home, goals_away, home:home_team_id(name, logo_url), away:away_team_id(name, logo_url))')
    .in('status', ['open', 'locked', 'live']).order('lock_at', { ascending: true });
  return data ?? [];
}
export async function getLfGame(fixtureId: string) {
  const { data } = await supabase.rpc('lf_get_game', { p_fixture_id: fixtureId });
  return data as any;
}
export async function saveLfTeam(gameId: string, gk: string, outfield: string[], captain: string) {
  const { data, error } = await supabase.rpc('lf_save_team', { p_game_id: gameId, p_gk: gk, p_outfield: outfield, p_captain: captain });
  if (error) return { ok: false, error: error.message };
  return data as any;
}
export async function lfTransfer(gameId: string, out: string, inn: string) {
  const { data, error } = await supabase.rpc('lf_transfer', { p_game_id: gameId, p_out: out, p_in: inn });
  if (error) return { ok: false, error: error.message };
  return data as any;
}
export async function lfRecalc(gameId: string) {
  await supabase.rpc('lf_recalc', { p_game_id: gameId }).catch(() => {});
}
