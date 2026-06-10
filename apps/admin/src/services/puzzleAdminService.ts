import { supabase } from './supabase';

export async function getPuzzleConfig() {
  const { data } = await supabase.from('puzzle_config').select('*').eq('id', 1).single();
  return data;
}
export async function updatePuzzleConfig(patch: any) {
  return supabase.from('puzzle_config').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', 1);
}

export async function listPopularity() {
  const { data } = await supabase.from('team_popularity').select('*').order('popularity', { ascending: false });
  return data ?? [];
}
export async function updatePopularity(teamApiId: number, popularity: number) {
  return supabase.from('team_popularity').update({ popularity, is_manual: true, updated_at: new Date().toISOString() }).eq('team_api_id', teamApiId);
}
export async function recomputePopularity() {
  return supabase.rpc('seed_team_popularity');
}

export async function listPuzzleGames(level: string) {
  const { data } = await supabase.from('puzzle_games')
    .select('id, level, puzzle_date, seq, difficulty_score, status')
    .eq('game_type', 'guess_score').eq('level', level).order('puzzle_date');
  return data ?? [];
}
export async function getPuzzleRounds(gameId: string) {
  const { data } = await supabase.from('puzzle_rounds')
    .select('round_no, home_name, away_name, answer_home, answer_away, season, competition_name, stage, match_date, difficulty_score, hints')
    .eq('game_id', gameId).order('round_no');
  return data ?? [];
}
export async function generatePuzzles(level: string, count: number, startDate: string) {
  return supabase.rpc('puzzle_generate_guess_score', { p_level: level, p_count: count, p_start_date: startDate });
}
export async function reschedulePuzzle(gameId: string, newDate: string) {
  return supabase.rpc('puzzle_reschedule', { p_game_id: gameId, p_new_date: newDate });
}
export async function deletePuzzleGame(gameId: string) {
  return supabase.from('puzzle_games').delete().eq('id', gameId);
}

export async function listDailyPrizes() {
  const { data } = await supabase.from('puzzle_daily_prizes').select('*').order('puzzle_date', { ascending: false }).limit(60);
  return data ?? [];
}
export async function setDailyPrize(level: string, puzzleDate: string, pot: number, topPct: number) {
  return supabase.from('puzzle_daily_prizes').upsert({ level, puzzle_date: puzzleDate, pot, top_pct: topPct }, { onConflict: 'level,puzzle_date' });
}
