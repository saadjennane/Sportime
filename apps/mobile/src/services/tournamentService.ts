import { supabase } from './supabase';

// ── Types ────────────────────────────────────────────────────────────────────
export interface TQTeam { id: string; name: string; short_name: string | null; flag_url: string | null; }
export interface TQGroup { id: string; name: string; sort_order: number; qualified_count: number; teams: TQTeam[]; }
export interface TQMatch {
  id: string; team_a: TQTeam | null; team_b: TQTeam | null; start_time: string | null;
  status: string; is_official_quest_match: boolean; score_a: number | null; score_b: number | null;
  first_scorer_team_id: string | null; knockout_round: string | null;
}
export interface TQFormat {
  groups_count: number; teams_count: number; teams_per_group: number;
  knockout_participants: number; knockout_rounds: string[]; best_thirds: number; third_place_match: boolean;
}
export interface TQLongTerm { champion_team_id: string | null; finalist_team_id: string | null; top_scorer_player_id: number | null; total_goals_prediction: number | null; points_awarded: number; }
export interface TQGroupPick { group_id: string; predicted_team_id: string; predicted_position: number; points_awarded: number; }
export interface TQDailyPick { match_id: string; predicted_result: string | null; predicted_goal_diff_bucket: string | null; predicted_first_scorer_team_id: string | null; predicted_score_a: number | null; predicted_score_b: number | null; points_awarded: number; }
export interface TQBracketPick { round_key: string; predicted_winner_team_id: string; points_awarded: number; }
export interface TQEntry {
  id: string; total_score: number; long_term_score: number; group_score: number; daily_score: number; bracket_score: number;
  longTerm: TQLongTerm | null; groupPicks: TQGroupPick[]; dailyPicks: TQDailyPick[]; bracketPicks: TQBracketPick[];
}
export interface TQCompetition {
  id: string; name: string; slug: string; status: string; start_date: string | null; end_date: string | null;
  config: any; format: TQFormat; groups: TQGroup[]; officialMatches: TQMatch[]; knockoutMatches: TQMatch[];
  phaseState: Record<string, { state: string; locks_at: string | null }>;
}
export interface TQLeaderboardRow { rank: number; total_score: number; tiebreak_delta: number | null; username: string | null; avatar: string | null; user_id: string; }

// ── Catalog (surface competitions in the games list) ─────────────────────────
export async function getTournamentCatalogGames(): Promise<any[]> {
  const { data, error } = await supabase
    .from('tq_competitions')
    .select('id, name, start_date, end_date, status, entry_cost')
    .in('status', ['open', 'running']);
  if (error || !data) return [];
  const out: any[] = [];
  for (const c of data as any[]) {
    const { count } = await supabase.from('tq_entries').select('*', { count: 'exact', head: true }).eq('competition_id', c.id);
    out.push({
      id: c.id, name: c.name, game_type: 'tournament',
      start_date: c.start_date, end_date: c.end_date,
      entry_cost: c.entry_cost ?? 0, tier: 'amateur', status: 'Open', format: 'tournament',
      sport: 'football', totalPlayers: count ?? 0, participants: [], rewards: [],
      minimum_level: 'Rookie', requires_subscription: false,
    });
  }
  return out;
}

// ── Full competition (groups, teams, official matches, format, phases) ───────
export async function getTournament(competitionId: string): Promise<TQCompetition | null> {
  const { data: comp } = await supabase.from('tq_competitions').select('*').eq('id', competitionId).single();
  if (!comp) return null;

  const teamJoin = '*, team_a:team_a_id(id,name,short_name,flag_url), team_b:team_b_id(id,name,short_name,flag_url)';
  const [{ data: fmt }, { data: groupRows }, { data: gtRows }, { data: matchRows }, { data: koRows }, { data: windows }] = await Promise.all([
    supabase.rpc('tq_detect_format', { p_competition_id: competitionId }),
    supabase.from('tq_groups').select('*').eq('competition_id', competitionId).order('sort_order'),
    supabase.from('tq_group_teams').select('group_id, seed_order, team:tq_teams(id, name, short_name, flag_url)').order('seed_order'),
    supabase.from('tq_matches').select(teamJoin).eq('competition_id', competitionId).eq('is_official_quest_match', true).order('start_time'),
    supabase.from('tq_matches').select(teamJoin).eq('competition_id', competitionId).not('knockout_round', 'is', null).order('bracket_slot'),
    supabase.from('tq_phase_windows').select('phase_key, state, locks_at').eq('competition_id', competitionId),
  ]);

  const byGroup = new Map<string, TQTeam[]>();
  for (const r of (gtRows ?? []) as any[]) {
    if (!byGroup.has(r.group_id)) byGroup.set(r.group_id, []);
    if (r.team) byGroup.get(r.group_id)!.push(r.team);
  }
  const groups: TQGroup[] = (groupRows ?? []).map((g: any) => ({
    id: g.id, name: g.name, sort_order: g.sort_order, qualified_count: g.qualified_count, teams: byGroup.get(g.id) ?? [],
  }));
  const phaseState: Record<string, any> = {};
  for (const w of (windows ?? []) as any[]) phaseState[w.phase_key] = { state: w.state, locks_at: w.locks_at };

  return {
    id: comp.id, name: comp.name, slug: comp.slug, status: comp.status,
    start_date: comp.start_date, end_date: comp.end_date, config: comp.config_json,
    format: fmt as TQFormat, groups, officialMatches: (matchRows ?? []) as any[],
    knockoutMatches: (koRows ?? []) as any[], phaseState,
  };
}

// ── My entry + predictions ───────────────────────────────────────────────────
export async function getMyTournamentEntry(competitionId: string, userId: string): Promise<TQEntry | null> {
  const { data: entry } = await supabase.from('tq_entries').select('*').eq('competition_id', competitionId).eq('user_id', userId).maybeSingle();
  if (!entry) return null;
  const [{ data: lt }, { data: gp }, { data: dp }, { data: bp }] = await Promise.all([
    supabase.from('tq_long_term_predictions').select('*').eq('entry_id', entry.id).maybeSingle(),
    supabase.from('tq_group_predictions').select('*').eq('entry_id', entry.id),
    supabase.from('tq_daily_predictions').select('*').eq('entry_id', entry.id),
    supabase.from('tq_bracket_predictions').select('*').eq('entry_id', entry.id),
  ]);
  return {
    id: entry.id, total_score: entry.total_score, long_term_score: entry.long_term_score,
    group_score: entry.group_score, daily_score: entry.daily_score, bracket_score: entry.bracket_score,
    longTerm: (lt as any) ?? null, groupPicks: (gp as any) ?? [], dailyPicks: (dp as any) ?? [], bracketPicks: (bp as any) ?? [],
  };
}

export async function getTournamentLeaderboard(competitionId: string): Promise<TQLeaderboardRow[]> {
  const { data } = await supabase.from('tq_leaderboard').select('rank, total_score, tiebreak_delta, username, avatar, user_id').eq('competition_id', competitionId).order('rank');
  return (data as any) ?? [];
}

// ── Mutations (RPCs enforce phase locks) ─────────────────────────────────────
export async function joinTournament(userId: string, competitionId: string) {
  return supabase.rpc('tq_join_competition', { p_user_id: userId, p_competition_id: competitionId });
}
export async function saveLongTerm(competitionId: string, championId: string | null, finalistId: string | null, totalGoals: number | null, topScorer: number | null = null) {
  return supabase.rpc('tq_save_long_term', { p_comp: competitionId, p_champion: championId, p_finalist: finalistId, p_top_scorer: topScorer, p_total_goals: totalGoals, p_extras: {} });
}
export async function saveGroupPrediction(competitionId: string, groupId: string, picks: { team_id: string; position: number }[]) {
  return supabase.rpc('tq_save_group_prediction', { p_comp: competitionId, p_group_id: groupId, p_picks: picks });
}
export async function saveDailyPrediction(competitionId: string, matchId: string, result: string, bucket: string, firstScorer: string | null, scoreA: number | null, scoreB: number | null) {
  return supabase.rpc('tq_save_daily_prediction', { p_comp: competitionId, p_match_id: matchId, p_result: result, p_bucket: bucket, p_first_scorer: firstScorer, p_score_a: scoreA, p_score_b: scoreB });
}
export async function saveBracketPrediction(competitionId: string, roundKey: string, teamIds: string[]) {
  return supabase.rpc('tq_save_bracket_prediction', { p_comp: competitionId, p_round_key: roundKey, p_team_ids: teamIds });
}

export function isPhaseOpen(comp: TQCompetition, phaseKey: string): boolean {
  const w = comp.phaseState[phaseKey];
  if (!w) return true;
  if (w.state !== 'open') return false;
  if (w.locks_at && new Date(w.locks_at).getTime() <= Date.now()) return false;
  return true;
}
