import { supabase } from './supabase';

// ── Types ────────────────────────────────────────────────────────────────────
export interface TQTeam { id: string; name: string; short_name: string | null; flag_url: string | null; }
export interface TQPlayer { id: string; name: string; team_id: string | null; photo: string | null; }
export interface TQGroup { id: string; name: string; sort_order: number; qualified_count: number; teams: TQTeam[]; }
export interface TQMatch {
  id: string; team_a: TQTeam | null; team_b: TQTeam | null; start_time: string | null;
  status: string; is_official_quest_match: boolean; score_a: number | null; score_b: number | null;
  odds_home: number | null; odds_draw: number | null; odds_away: number | null;
  first_scorer_team_id: string | null; knockout_round: string | null;
}
export interface TQFormat {
  groups_count: number; teams_count: number; teams_per_group: number;
  knockout_participants: number; knockout_rounds: string[]; best_thirds: number; third_place_match: boolean;
}
export interface TQLongTerm { champion_team_id: string | null; finalist_team_id: string | null; top_scorer_player_id: string | null; total_goals_prediction: number | null; points_awarded: number; }
export interface TQGroupPick { group_id: string; predicted_team_id: string; predicted_position: number; points_awarded: number; }
export interface TQDailyPick { match_id: string; predicted_result: string | null; locked_odds: number | null; predicted_goal_diff_bucket: string | null; predicted_first_scorer_team_id: string | null; predicted_score_a: number | null; predicted_score_b: number | null; points_awarded: number; }
export interface TQBracketPick { round_key: string; predicted_winner_team_id: string; points_awarded: number; }
export interface TQEntry {
  id: string; total_score: number; long_term_score: number; group_score: number; daily_score: number; bracket_score: number;
  longTerm: TQLongTerm | null; groupPicks: TQGroupPick[]; dailyPicks: TQDailyPick[]; bracketPicks: TQBracketPick[];
}
export interface TQCompetition {
  id: string; name: string; slug: string; status: string; start_date: string | null; end_date: string | null;
  config: any; format: TQFormat; groups: TQGroup[]; officialMatches: TQMatch[]; knockoutMatches: TQMatch[];
  players: TQPlayer[]; phaseState: Record<string, { state: string; locks_at: string | null }>;
}
export interface TQLeaderboardRow { rank: number; total_score: number; tiebreak_delta: number | null; username: string | null; avatar: string | null; user_id: string; }

// ── Catalog (surface competitions in the games list) ─────────────────────────
export async function getTournamentCatalogGames(): Promise<any[]> {
  // Include 'resolved' (finished) so completed tournaments still surface (as RESULTS)
  // instead of vanishing from the list.
  const { data, error } = await supabase
    .from('tq_competitions')
    .select('id, name, start_date, end_date, status, entry_cost')
    .in('status', ['open', 'running', 'resolved']);
  if (error || !data) return [];

  // One query for all participant counts (was an N+1 loop).
  const ids = (data as any[]).map(c => c.id);
  const counts: Record<string, number> = {};
  if (ids.length) {
    const { data: entryRows } = await supabase.from('tq_entries').select('competition_id').in('competition_id', ids);
    (entryRows ?? []).forEach((r: any) => { counts[r.competition_id] = (counts[r.competition_id] ?? 0) + 1; });
  }

  return (data as any[]).map(c => ({
    id: c.id, name: c.name, game_type: 'tournament',
    start_date: c.start_date, end_date: c.end_date,
    entry_cost: c.entry_cost ?? 0, tier: 'amateur',
    status: c.status === 'resolved' ? 'Finished' : 'Open', format: 'tournament',
    sport: 'football', totalPlayers: counts[c.id] ?? 0, participants: [], rewards: [],
    minimum_level: 'Rookie', requires_subscription: false,
  }));
}

// ── Full competition (groups, teams, official matches, format, phases) ───────
export async function getTournament(competitionId: string): Promise<TQCompetition | null> {
  const { data: comp } = await supabase.from('tq_competitions').select('*').eq('id', competitionId).single();
  if (!comp) return null;

  const teamJoin = '*, team_a:team_a_id(id,name,short_name,flag_url), team_b:team_b_id(id,name,short_name,flag_url)';
  const [{ data: fmt }, { data: groupRows }, { data: gtRows }, { data: matchRows }, { data: koRows }, { data: windows }, { data: playerRows }] = await Promise.all([
    supabase.rpc('tq_detect_format', { p_competition_id: competitionId }),
    supabase.from('tq_groups').select('*').eq('competition_id', competitionId).order('sort_order'),
    supabase.from('tq_group_teams').select('group_id, seed_order, team:tq_teams(id, name, short_name, flag_url)').order('seed_order'),
    supabase.from('tq_matches').select(teamJoin).eq('competition_id', competitionId).eq('is_official_quest_match', true).order('start_time'),
    supabase.from('tq_matches').select(teamJoin).eq('competition_id', competitionId).not('knockout_round', 'is', null).order('bracket_slot'),
    supabase.from('tq_phase_windows').select('phase_key, state, locks_at').eq('competition_id', competitionId),
    supabase.from('tq_players').select('id, name, team_id, photo').eq('competition_id', competitionId).order('name'),
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

  // Guard against a null/malformed format from the RPC (a mis-configured competition
  // must never crash the screen). Always expose a valid shape with an array of rounds.
  const rawFmt = fmt as any;
  const format: TQFormat = {
    groups_count: rawFmt?.groups_count ?? groups.length,
    teams_count: rawFmt?.teams_count ?? 0,
    teams_per_group: rawFmt?.teams_per_group ?? 0,
    knockout_participants: rawFmt?.knockout_participants ?? 0,
    knockout_rounds: Array.isArray(rawFmt?.knockout_rounds) ? rawFmt.knockout_rounds : [],
    best_thirds: rawFmt?.best_thirds ?? 0,
    third_place_match: rawFmt?.third_place_match ?? false,
  };

  return {
    id: comp.id, name: comp.name, slug: comp.slug, status: comp.status,
    start_date: comp.start_date, end_date: comp.end_date, config: comp.config_json,
    format, groups, officialMatches: (matchRows ?? []) as any[],
    knockoutMatches: (koRows ?? []) as any[], players: (playerRows ?? []) as any[], phaseState,
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

/**
 * Pending action for a joined Tournament Quest: a still-upcoming match (kickoff in
 * the future) the user hasn't predicted yet — the recurring, points-rich pick they
 * might forget. Long-term/group/bracket are one-time and excluded here.
 */
export async function tournamentHasPendingPicks(competitionId: string, userId: string, now: number = Date.now()): Promise<boolean> {
  const [comp, entry] = await Promise.all([
    getTournament(competitionId),
    getMyTournamentEntry(competitionId, userId),
  ]);
  if (!comp || comp.status === 'resolved') return false;
  const picked = new Set((entry?.dailyPicks ?? []).map(p => p.match_id));
  const matches = [...comp.officialMatches, ...comp.knockoutMatches];
  return matches.some(m => m.start_time && new Date(m.start_time).getTime() > now && !picked.has(m.id));
}

export async function getTournamentLeaderboard(competitionId: string): Promise<TQLeaderboardRow[]> {
  const { data } = await supabase.from('tq_leaderboard').select('rank, total_score, tiebreak_delta, username, avatar, user_id').eq('competition_id', competitionId).order('rank');
  return (data as any) ?? [];
}

// ── Mutations (RPCs enforce phase locks) ─────────────────────────────────────
export async function joinTournament(userId: string, competitionId: string) {
  return supabase.rpc('tq_join_competition', { p_user_id: userId, p_competition_id: competitionId });
}
export async function saveLongTerm(competitionId: string, championId: string | null, finalistId: string | null, totalGoals: number | null, topScorer: string | null = null) {
  return supabase.rpc('tq_save_long_term', { p_comp: competitionId, p_champion: championId, p_finalist: finalistId, p_top_scorer: topScorer, p_total_goals: totalGoals, p_extras: {} });
}
export async function saveGroupPrediction(competitionId: string, groupId: string, picks: { team_id: string; position: number }[]) {
  return supabase.rpc('tq_save_group_prediction', { p_comp: competitionId, p_group_id: groupId, p_picks: picks });
}
export async function saveDailyPrediction(competitionId: string, matchId: string, result: 'A' | 'B' | 'draw') {
  return supabase.rpc('tq_save_daily_prediction', { p_comp: competitionId, p_match_id: matchId, p_result: result });
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
