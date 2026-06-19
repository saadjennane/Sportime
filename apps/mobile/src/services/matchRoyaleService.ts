import { supabase } from './supabase';

export interface MRGame {
  id: string; name: string; status: string; hearts: number; pot_amount: number | null;
  fixture_id: string; api_fixture_id: number;
}
export interface MRQuestion {
  id: string; seq: number; prompt: string; options: { key: string; label: string }[];
  status: string; phase: string; answer_type: string; is_tie_break: boolean; correct_key: string | null; half: number | null;
}

const LIVE_STATUSES = ['open', 'first_half', 'half_time', 'second_half'];

/** Match Royale games currently joinable/playable, with fixture + team info. */
export async function listAvailableMRGames() {
  const { data } = await supabase
    .from('mr_games')
    .select('id, name, status, hearts, pot_amount, fixture_id, api_fixture_id, fixture:fb_fixtures(date, status, goals_home, goals_away, home:fb_teams!fb_fixtures_home_team_id_fkey(name,logo_url), away:fb_teams!fb_fixtures_away_team_id_fkey(name,logo_url))')
    .in('status', LIVE_STATUSES)
    .order('created_at', { ascending: false }).limit(30);
  return data ?? [];
}

/** Match Royale games the user has joined (for the Live tab). */
export async function listMyMRGames(userId: string) {
  const { data } = await supabase.from('mr_participants')
    .select('game:mr_games(id, name, status, pot_amount, fixture_id, fixture:fb_fixtures(date, status, goals_home, goals_away, home:fb_teams!fb_fixtures_home_team_id_fkey(name,logo_url), away:fb_teams!fb_fixtures_away_team_id_fkey(name,logo_url)))')
    .eq('user_id', userId);
  // Return all of the user's MR games (the Live tab groups them by phase, incl. finished).
  return (data ?? []).map((r: any) => r.game).filter(Boolean);
}

/** Create (or no-op) a Match Royale game for a fixture, on demand. Returns the game id. */
export async function createMRGame(fixtureId: string, name: string) {
  const existing = await getMRGameByFixture(fixtureId);
  if (existing?.id) return existing.id;
  const { data, error } = await supabase.rpc('mr_create_game', { p_fixture_id: fixtureId, p_name: name });
  if (error) return null;
  return (data as any)?.id ?? data ?? null;
}

/** The active Match Royale game for a fixture (for the match's Play menu), if any. */
export async function getMRGameByFixture(fixtureId: string) {
  const { data } = await supabase.from('mr_games')
    .select('id, status, pot_amount')
    .eq('fixture_id', fixtureId).in('status', LIVE_STATUSES)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  return data;
}

export async function getMRGame(gameId: string) {
  const { data } = await supabase
    .from('mr_games')
    .select('id, name, status, hearts, pot_amount, fixture_id, api_fixture_id, fixture:fb_fixtures(date, status, goals_home, goals_away, home:fb_teams!fb_fixtures_home_team_id_fkey(name,logo_url), away:fb_teams!fb_fixtures_away_team_id_fkey(name,logo_url))')
    .eq('id', gameId).single();
  return data;
}

export async function getMyParticipant(gameId: string, userId: string) {
  const { data } = await supabase.from('mr_participants')
    .select('lives, status, is_winner, prize_amount').eq('game_id', gameId).eq('user_id', userId).maybeSingle();
  return data;
}

export async function joinMR(gameId: string) {
  const { data, error } = await supabase.rpc('mr_join', { p_game_id: gameId });
  if (error) return { ok: false, error: error.message };
  return data as any;
}

export async function listMRQuestions(gameId: string): Promise<MRQuestion[]> {
  const { data } = await supabase.from('mr_questions')
    .select('id, seq, prompt, options, status, phase, answer_type, is_tie_break, correct_key, half')
    .eq('game_id', gameId).order('seq');
  return (data ?? []) as any;
}

export async function getMyMRAnswers(gameId: string, userId: string): Promise<Record<string, string>> {
  const { data } = await supabase.from('mr_answers').select('question_id, option_key').eq('game_id', gameId).eq('user_id', userId);
  return Object.fromEntries((data ?? []).map((a: any) => [a.question_id, a.option_key]));
}

export async function answerMR(questionId: string, option: string) {
  const { data, error } = await supabase.rpc('mr_answer', { p_question_id: questionId, p_option: option });
  if (error) return { ok: false, error: error.message };
  return data as any;
}

export async function getMRQuestionStats(questionId: string): Promise<Record<string, number>> {
  const { data } = await supabase.rpc('mr_question_stats', { p_question_id: questionId });
  return (data ?? {}) as any;
}

export async function getMRGameCounts(gameId: string): Promise<{ total: number; alive: number }> {
  const { data } = await supabase.rpc('mr_game_counts', { p_game_id: gameId });
  return (data ?? { total: 0, alive: 0 }) as any;
}
