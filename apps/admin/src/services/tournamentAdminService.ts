import { supabase } from './supabase';

export const TQ_DEFAULT_CONFIG = {
  format: { best_thirds_count: 0, third_place_match: true },
  scoring: {
    long_term: { champion_exact: 150, champion_finalist: 75, champion_semi: 30, finalist_exact: 100, finalist_semi: 40, top_scorer_exact: 100, top_scorer_top3: 40, top_scorer_top10: 15 },
    group: { qualified: 5, exact_position: 5 },
    daily: { result: 10, exact_score: 12, bonus: 8, cards_line: 3.5, distance: { '0': 15, '1': 10, '2': 5, '3': 2 } },
    bracket: { R32: 10, R16: 15, QF: 30, SF: 60, F: 120 },
  },
};

export async function listCompetitions() {
  const { data } = await supabase.from('tq_competitions').select('*').order('created_at', { ascending: false });
  return data ?? [];
}

export async function createCompetition(p: { name: string; slug: string; start_date: string | null; end_date: string | null; entry_cost: number }) {
  return supabase.from('tq_competitions').insert({ ...p, status: 'draft', config_json: TQ_DEFAULT_CONFIG }).select().single();
}

export async function updateCompetition(id: string, patch: any) {
  return supabase.from('tq_competitions').update(patch).eq('id', id);
}

export async function getCompetitionDetail(id: string) {
  const teamJoin = '*, team_a:team_a_id(id,name,short_name), team_b:team_b_id(id,name,short_name)';
  const [{ data: comp }, { data: fmt }, { data: groups }, { data: gt }, { data: matches }, { data: windows }] = await Promise.all([
    supabase.from('tq_competitions').select('*').eq('id', id).single(),
    supabase.rpc('tq_detect_format', { p_competition_id: id }),
    supabase.from('tq_groups').select('*').eq('competition_id', id).order('sort_order'),
    supabase.from('tq_group_teams').select('id, group_id, final_rank, seed_order, team:tq_teams(id,name,short_name)').order('seed_order'),
    supabase.from('tq_matches').select(teamJoin).eq('competition_id', id).order('knockout_round').order('bracket_slot'),
    supabase.from('tq_phase_windows').select('*').eq('competition_id', id),
  ]);
  return { comp, format: fmt, groups: groups ?? [], groupTeams: gt ?? [], matches: matches ?? [], windows: windows ?? [] };
}

export async function importGroups(competitionId: string, spec: any[]) {
  return supabase.rpc('tq_admin_import_groups', { p_comp: competitionId, p_spec: spec });
}
export async function setFinalRank(groupTeamId: string, rank: number | null) {
  return supabase.from('tq_group_teams').update({ final_rank: rank }).eq('id', groupTeamId);
}
export async function updateMatch(matchId: string, patch: any) {
  return supabase.from('tq_matches').update(patch).eq('id', matchId);
}
export async function setPhaseState(competitionId: string, phaseKey: string, state: string) {
  return supabase.from('tq_phase_windows').upsert({ competition_id: competitionId, phase_key: phaseKey, state }, { onConflict: 'competition_id,phase_key' });
}
export async function generateBracket(competitionId: string) {
  return supabase.rpc('tq_admin_generate_bracket', { p_comp: competitionId });
}
export async function advanceRound(competitionId: string, fromRound: string) {
  return supabase.rpc('tq_admin_advance_round', { p_comp: competitionId, p_from: fromRound });
}
export async function resolveCompetition(competitionId: string) {
  return supabase.rpc('tq_admin_resolve', { p_comp: competitionId });
}

// ── Game Builder ─────────────────────────────────────────────────────────────
export async function createFromLeague(p: any) {
  return supabase.functions.invoke('tq-create-from-league', { body: p });
}

export async function setStatus(id: string, status: string) {
  return supabase.from('tq_competitions').update({ status }).eq('id', id);
}

export async function getLeaderboard(competitionId: string) {
  const { data } = await supabase.from('tq_leaderboard')
    .select('rank, total_score, username').eq('competition_id', competitionId).order('rank').limit(50);
  return data ?? [];
}

export async function listAnnouncements(competitionId: string) {
  const { data } = await supabase.from('tq_announcements')
    .select('*').eq('competition_id', competitionId).order('created_at', { ascending: false });
  return data ?? [];
}
export async function createAnnouncement(p: { competition_id: string; title: string; body: string; phase_key: string | null; celebrate: boolean; publish: boolean }) {
  return supabase.from('tq_announcements').insert({
    competition_id: p.competition_id, title: p.title, body: p.body, phase_key: p.phase_key,
    celebrate: p.celebrate, published_at: p.publish ? new Date().toISOString() : null,
  });
}
export async function deleteAnnouncement(id: string) {
  return supabase.from('tq_announcements').delete().eq('id', id);
}

/** Leagues available as a Tournament Quest source (national-team cups have standings groups). */
export async function listSourceLeagues() {
  const { data } = await supabase.from('fb_leagues').select('api_id, name').order('name');
  return data ?? [];
}

// ── Match Day Challenge (game_type 'betting') ────────────────────────────────
export async function listLeaguesFull() {
  const { data } = await supabase.from('fb_leagues').select('id, name').order('name');
  return data ?? [];
}
export async function searchFixtures(leagueIds: string[], from: string, to: string) {
  if (leagueIds.length === 0) return [];
  let q = supabase.from('fb_fixtures')
    .select('id, date, round, home_team:fb_teams!fb_fixtures_home_team_id_fkey(name), away_team:fb_teams!fb_fixtures_away_team_id_fkey(name)')
    .in('league_id', leagueIds).order('date');
  if (from) q = q.gte('date', from);
  if (to) q = q.lte('date', to + 'T23:59:59');
  const { data } = await q.limit(300);
  return data ?? [];
}
export async function createMatchdayChallenge(p: any) {
  return supabase.functions.invoke('create-matchday-challenge', { body: p });
}
export async function createFantasyGame(p: any) {
  return supabase.functions.invoke('create-fantasy-game', { body: p });
}
export async function listChallenges() {
  const { data } = await supabase.from('challenges')
    .select('id, name, status, start_date, end_date, entry_cost, is_visible, rules, game_type, source_league_id')
    .in('game_type', ['betting', 'prediction']).order('created_at', { ascending: false });
  return data ?? [];
}
export async function listFantasyGames() {
  const { data } = await supabase.from('fantasy_games')
    .select('id, name, status, entry_cost, is_visible, min_players, max_players, tier, duration_type, source_league_id')
    .order('created_at', { ascending: false });
  return data ?? [];
}
export async function setFantasyStatus(id: string, status: string) {
  return supabase.from('fantasy_games').update({ status }).eq('id', id);
}
export async function setFantasyVisibility(id: string, isVisible: boolean) {
  return supabase.from('fantasy_games').update({ is_visible: isVisible }).eq('id', id);
}
export async function setChallengeStatus(id: string, status: string) {
  return supabase.from('challenges').update({ status }).eq('id', id);
}
export async function setChallengeVisibility(id: string, isVisible: boolean) {
  return supabase.from('challenges').update({ is_visible: isVisible }).eq('id', id);
}
