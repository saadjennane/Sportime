import React from 'react';

export interface Match {
  id: string;
  leagueName: string;
  leagueLogo: string | null;
  teamA: { name: string; emoji?: string; logo?: string | null };
  teamB: { name: string; emoji?: string; logo?: string | null };
  kickoffTime: string;
  odds: { teamA: number; draw: number; teamB: number };
  status: 'upcoming' | 'played';
  isLive?: boolean;
  result?: 'teamA' | 'draw' | 'teamB';
  score?: { teamA: number; teamB: number };
  hasLineup?: boolean;
  meta?: MatchMeta;
}

export interface MatchMeta {
  fixtureId: number;
  leagueId: string;
  apiLeagueId?: number | null;
  season?: string | number | null;
  homeTeamId: number;
  awayTeamId: number;
}

export interface Bet {
  matchId: string;
  prediction: 'teamA' | 'draw' | 'teamB';
  amount: number;
  odds: number;
  status: 'pending' | 'won' | 'lost';
  winAmount?: number;
}

export interface ChallengeMatch {
  id: string;
  challengeId: string;
  day: number;
  teamA: { name: string; emoji: string };
  teamB: { name: string; emoji: string };
  odds: { teamA: number; draw: number; teamB: number };
  status: 'upcoming' | 'played';
  result?: 'teamA' | 'draw' | 'teamB';
}

export interface ChallengeBet {
  challengeMatchId: string;
  prediction: 'teamA' | 'draw' | 'teamB';
  amount: number;
}

export interface BoosterSelection {
  type: 'x2' | 'x3';
  matchId: string;
}

export interface DailyChallengeEntry {
  day: number;
  bets: ChallengeBet[];
  booster?: BoosterSelection;
}

export interface UserChallengeEntry {
  user_id: string;
  challengeId: string;
  dailyEntries: DailyChallengeEntry[];
  entryMethod: 'coins' | 'ticket';
  ticketId?: string;
}

export interface Challenge {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  entryCost: number;
  challengeBalance: number;
  status: 'Upcoming' | 'Ongoing' | 'Finished';
  totalPlayers: number;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  finalCoins: number;
  points: number;
  userId?: string;
}

export interface Profile {
  id: string;
  username: string;
  display_name?: string;
  coins_balance: number;
  created_at: string;
  is_guest?: boolean;
  verified?: boolean;
  email: string | null;
  profile_picture_url?: string;
  level?: string;
  xp?: number;
  favorite_club?: string;
  favorite_national_team?: string;
  sports_preferences?: {
    football?: {
      club?: string;
      national_team?: string;
    }
  };
  is_subscriber?: boolean;
  subscription_expires_at?: string;
  badges?: string[];
  referralCode?: string;
  referralsSent?: number;
  referralsRewarded?: number;
  daily_games_played?: number;
  last_premium_prompt_at?: Record<string, string>;
  paidTournamentsCreatedThisMonth?: number;
  activePaidTournaments?: number;
  giftCards?: { amount: string; provider: string; status: 'Mock' }[];
}

export interface LevelConfig {
  id: string;
  level_name: string;
  min_xp: number;
  max_xp: number;
  level_icon_url: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon_url: string;
  condition_type: string;
  condition_value: any;
  created_at: string;
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_id: string;
  earned_at: string;
}

export interface OnboardingSlide {
  slide_number: number;
  title: string;
  subtitle: string;
  visual_description: string;
  cta_text: string | { primary: string; secondary: string };
  emotion: string;
  progress_visual: string;
}

export type PlayerPosition = 'Goalkeeper' | 'Defender' | 'Midfielder' | 'Attacker';
export type PlayerCategory = 'Star' | 'Key' | 'Wild';

export interface FantasyPlayer {
  id: string;
  name: string;
  photo: string;
  position: PlayerPosition;
  status: PlayerCategory;
  fatigue: number; // 0-100
  teamName: string;
  teamLogo: string;
  birthdate: string;
  pgs: number;
  playtime_ratio?: number;
  liveStatus?: PlayerLiveStatus;
  livePoints?: number;
  livePointsBreakdown?: Record<string, number>;
  isSubbedIn?: boolean;
}

export type PlayerLiveStatus = 'playing' | 'not_yet_played' | 'dnp' | 'finished';


export interface FantasyGameWeek {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  leagues: string[];
  status: 'upcoming' | 'live' | 'finished';
  conditions?: { key: string; text: string; value: string | number }[];
  formationConstraint?: string;
}

export interface UserFantasyTeam {
  userId: string;
  gameId: string;
  gameWeekId: string;
  starters: string[]; // Player IDs
  substitutes: string[]; // Player IDs
  captain_id: string;
  booster_used: number | null;
  booster_target_id?: string;
  fatigue_state: Record<string, number>;
}

export interface Booster {
  id: number;
  name: string;
  description: string;
  icon: React.ReactNode;
  used: boolean;
}

export interface FantasyLeaderboardEntry {
  rank: number;
  username: string;
  avatar: string;
  totalPoints: number;
  boosterUsed: number | null;
  userId: string;
}

export interface PlayerLast10Stats {
  rating: number;
  impact: number;
  consistency: number;
  minutes_played: number;
  total_possible_minutes: number;
}

export interface PlayerGameWeekStats {
  minutes_played: number;
  goals: number;
  assists: number;
  shots_on_target: number;
  saves: number;
  penalties_saved: number;
  penalties_scored: number;
  penalties_missed: number;
  yellow_cards: number;
  red_cards: number;
  goals_conceded: number;
  interceptions: number;
  tackles: number;
  duels_won: number;
  duels_lost: number;
  dribbles_succeeded: number;
  fouls_committed: number;
  fouls_suffered: number;
  rating: number;
  clean_sheet: boolean;
}

export interface FantasyConfig {
  fatigue: { star: number; key: number; rest: number; };
  bonuses: { no_star: number; crazy: number; vintage: number; };
  boosters: { double_impact: number; golden_game: number; };
  captain_passive: number;
}

export interface SwipeMatch {
  id: string;
  teamA: { name: string; emoji: string };
  teamB: { name: string; emoji: string };
  kickoffTime: string;
  odds: { teamA: number; draw: number; teamB: number };
  result?: SwipePredictionOutcome;
}

export type SwipePredictionOutcome = 'teamA' | 'draw' | 'teamB';

export interface SwipePrediction {
  matchId: string;
  prediction: SwipePredictionOutcome;
}

export interface UserSwipeEntry {
  user_id: string;
  matchDayId: string;
  predictions: SwipePrediction[];
  submitted_at: string | null;
}

export interface SwipeMatchDay extends Game {
  matches: SwipeMatch[];
  challengeId?: string;
}

export interface SwipeLeaderboardEntry {
  rank: number;
  username: string;
  points: number;
  userId: string;
  correct_picks: number;
  submission_timestamp: number;
}

export interface UserLeague {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  invite_code: string;
  created_by: string;
  created_at: string;
  season_start_date?: string;
  season_end_date?: string;
}

export interface LeagueMember {
  id: string;
  league_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
}

export interface LeagueGame {
  id: string;
  league_id: string;
  game_id: string;
  game_name: string;
  type: 'Fantasy' | 'Prediction' | 'Betting' | 'Private';
  members_joined: number;
  members_total: number;
  user_rank_in_league: number;
  user_rank_global: number;
  total_players_global: number;
  linked_at: string;
  leaderboard_period: LeaderboardPeriod | null;
}

export type LeaderboardPeriodStartType = 'season_start' | 'link_date' | 'last_member_joined' | 'custom';
export type LeaderboardPeriodEndType = 'season_end' | 'custom';

export interface LeaderboardPeriod {
  start_type: LeaderboardPeriodStartType;
  end_type: LeaderboardPeriodEndType;
  start_date: string;
  end_date: string;
}

export interface LeaderboardSnapshot {
  id: string;
  league_id: string;
  game_id: string;
  game_name: string;
  game_type: GameType;
  created_at: string;
  created_by: string;
  data: (LeaderboardEntry | SwipeLeaderboardEntry | FantasyLeaderboardEntry)[];
  message: string;
  start_date: string;
  end_date: string;
}

export interface LeagueFeedPost {
  id: string;
  league_id: string;
  type: 'celebration' | 'announcement' | 'game_linked';
  author_id: string;
  created_at: string;
  message: string;
  metadata: {
    snapshot_id?: string;
    top_players?: { name: string; score: number }[];
  };
  likes: string[];
}

export type KnockoutType = 'single' | 'double';
export type PrivateGameFormat = 'championship' | 'championship_knockout' | 'knockout';

export interface PrivateLeagueGameConfig {
  competition_id: string;
  format_type: PrivateGameFormat;
  player_count: number;
  selected_matchdays: number;
  knockout_type: KnockoutType | null;
  include_third_place: boolean;
  tie_advantage: 'higher_seed';
  honorary_title: boolean;
  auto_rest_week: boolean;
  pairing_rule: '1vs4_2vs3';
  isPaid?: boolean;
  entryFee?: number;
}

export interface PrivateLeagueGame {
  id: string;
  league_id: string;
  config: PrivateLeagueGameConfig;
  created_at: string;
}

export interface BonusQuestion {
  id: string;
  question: string;
  options: string[];
  answer?: string;
}

export interface BonusAnswer {
  question_id: string;
  choice: string;
}

export interface LiveBet {
  market_id: string;
  option: string;
  amount: number;
  odds: number;
  phase: 'pre-match' | 'live';
  status: 'pending' | 'won' | 'lost' | 'void';
  gain: number;
}

export interface LiveGameMarket {
  id: string;
  minute: number;
  type: string;
  title: string;
  emotion_factor: number;
  odds: { option: string; adjusted: number }[];
  expires_at: string;
  status: 'open' | 'resolved' | 'cancelled';
  winning_option?: string;
}

export interface LiveGamePlayerEntry {
  user_id: string;
  submitted_at: string;
  predicted_score?: { home: number; away: number };
  bonus_answers?: BonusAnswer[];
  midtime_edit?: boolean;
  result_points?: number;
  gd_points?: number;
  team_points?: number;
  exact_points?: number;
  score_final?: number;
  bonus_total?: number;
  total_points?: number;
  goal_diff_error?: number;
  betting_state?: {
    pre_match_balance: number;
    live_balance: number;
    bets: LiveBet[];
    total_gain: number;
    last_gain_time?: string;
  };
}

export interface LiveGame {
  id: string;
  league_id: string;
  match_id: string;
  match_details: Match;
  created_by: string;
  status: 'Upcoming' | 'Ongoing' | 'Finished';
  mode: 'prediction' | 'betting' | 'fantasy-live';
  bonus_questions: BonusQuestion[];
  markets: LiveGameMarket[];
  simulated_minute: number;
  last_known_state?: {
    minute: number;
    score: { home: number; away: number };
  };
  players: LiveGamePlayerEntry[];
  boosters?: FantasyLiveBooster[];
}

export interface FantasyLiveBooster {
  id: number;
  name: string;
  type: 'individual' | 'team';
  duration: number; // in minutes
  effect: string;
  malus?: string;
  icon: React.ReactNode;
  used: boolean;
}

export interface PredictionChallenge {
  id: string;
  title: string;
  season: string;
  matchDayIds: string[];
  createdAt: string;
}

export type TournamentType = 'rookie' | 'pro' | 'elite';

export interface UserTicket {
  id: string;
  user_id: string;
  type: TournamentType;
  is_used: boolean;
  created_at: string;
  expires_at: string;
  used_at?: string;
}

export interface UserStreak {
  user_id: string;
  current_day: number;
  last_claimed_at: string;
  total_cycles_completed: number;
}

export type GameType = 'betting' | 'prediction' | 'fantasy' | 'fantasy-live';
export type GameFormat = 'leaderboard' | 'championship' | 'knockout' | 'battle-royale';
export type RewardTier = 'tier1' | 'tier2' | 'tier3';
export type ConditionsLogic = 'and' | 'or';

export interface RewardItem {
  id: string;
  type: 'ticket' | 'spin' | 'xp' | 'giftcard' | 'masterpass' | 'custom' | 'premium_3d' | 'premium_7d' | 'coins';
  value?: number | string | Record<string, any>;
  tier?: TournamentType | SpinTier;
  name?: string;
  logo?: string;
}

export interface GameRewardTier {
  id: string;
  positionType: 'rank' | 'range' | 'percent';
  start: number;
  end?: number;
  rewards: RewardItem[];
}

export interface SportimeGame {
  id: string;
  name: string;
  description?: string;
  league_id?: string;
  start_date: string;
  end_date: string;
  game_type: GameType;
  tier?: TournamentType;
  duration_type?: 'daily' | 'mini-series' | 'seasonal';
  entry_cost: number;
  custom_entry_cost_enabled?: boolean;
  is_linkable?: boolean;
  reward_tier?: RewardTier;
  format?: GameFormat;
  requires_subscription?: boolean;
  minimum_level?: string;
  required_badges?: string[];
  conditions_logic?: ConditionsLogic;
  minimum_players: number;
  maximum_players: number;
  status: 'Upcoming' | 'Ongoing' | 'Finished' | 'Cancelled';
  totalPlayers: number;
  participants: string[];
  rewards: GameRewardTier[];
  challengeBalance?: number;
  matches?: SwipeMatch[];
  gameWeeks?: FantasyGameWeek[];
  challengeId?: string;
}

export interface CelebrationEvent {
  id: string;
  gameId: string;
  gameName: string;
  type: 'seasonal' | 'private_league';
  period: { start: string; end: string };
  topPlayers: { userId: string; username: string; rank: number; reward: RewardItem }[];
  createdAt: string;
  message: string;
}

export interface ActiveSession {
  id: string;
  pin: string;
  matchId: string;
  gameTypeId: string;
  leagueId?: string;
  createdAt: number;
  expiresAt: number;
  participants: string[];
}

export interface Notification {
  id: string;
  type: 'gameplay' | 'league' | 'squad' | 'premium' | 'reminder' | 'system';
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  action?: {
    label: string;
    link?: string;
  };
}

export interface PlayerInteraction {
  playerId: string;
  username: string;
  interactions: number;
  lastInteraction: string;
}

export type PlayerGraph = Record<string, Record<string, PlayerInteraction>>;

export interface FunZoneGame {
  id: string;
  name: string;
  description: string;
  isPlayable: boolean;
  logic: {
    rules: string;
    winCondition: string;
  }
}

export interface ProgressionMilestone {
  wins: number;
  rewards: { type: string; value: number | string }[];
}

export interface FreeSpinReward {
  label: string;
  type: 'coins' | 'xp' | 'none';
  value: number;
  probability: number;
}

export interface FunZoneState {
  userProgress: number;
  dailySpinLastUsed: string | null;
  availableGames: FunZoneGame[];
}

export interface CoinPack {
  id: string;
  name: string;
  priceEUR: number;
  coins: number;
  bonus: number;
  valuePerCoin: number;
  isBestValue?: boolean;
}

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export type SpinTier = 'free' | 'rookie' | 'pro' | 'elite' | 'premium';

export interface SpinReward {
  id: string;
  label: string;
  baseChance: number;
  category: string;
}

export interface UserSpinState {
  userId: string;
  adaptiveMultipliers: Record<string, { multiplier: number, expiresAt: string }>;
  pityCounter: number;
  spinHistory: SpinResult[];
  availableSpins: Record<SpinTier, number>;
}

export interface SpinResult {
  id: string;
  tier: SpinTier;
  rewardId: string;
  rewardLabel: string;
  timestamp: string;
  wasPity: boolean;
}

export interface SpinTelemetryLog {
  userId: string;
  tier: SpinTier;
  rewardId: string;
  wasPity: boolean;
  pityCounter: number;
  finalChances: Record<string, number>;
  timestamp: string;
}

export interface ApiFootballResponse<T> {
  get: string;
  parameters: Record<string, string>;
  errors: any[];
  results: number;
  paging: { current: number; total: number };
  response: T[];
}

export interface ApiLeagueInfo {
  league: { id: number; name: string; type: string; logo: string };
  country: { name: string; code: string; flag: string };
  seasons: { year: number; start: string; end: string; current: boolean }[];
}

export interface ApiTeamInfo {
  team: { id: number; name: string; country: string; logo: string };
  venue: { id: number; name: string; city: string };
}

export interface ApiPlayerInfo {
  player: { id: number; name: string; age: number; nationality: string; photo: string };
  statistics: { games: { position: string } }[];
}

export interface ApiFixtureInfo {
    fixture: { id: number; date: string; status: { short: string } };
    league: { id: number };
    teams: { home: { id: number }; away: { id: number } };
    goals: { home: number; away: number };
}

export interface ApiOddsInfo {
    fixture: { id: number };
    bookmakers: { name: string; bets: { name: string; values: { value: string; odd: string }[] }[] }[];
}

export interface ApiSyncConfig {
  id: string;
  frequency: string;
  last_sync_at: string;
}

export interface UserProfileStatsData {
  username: string;
  predictionsTotal: number;
  predictionsCorrect: number;

  hotPerformanceIndex: number;
  bestHotDay: {
    date: string;
    hpi: number;
    correct: number;
    total: number;
  };
  streak: number;
  averageBetCoins: number;
  riskIndex: number;
  gamesPlayed: number;
  podiums: {
    gold: number;
    silver: number;
    bronze: number;
  };
  trophies: number;
  badges: string[];
  mostPlayedLeague: string;
  mostPlayedTeam: string;
  favoriteGameType: string;
  last10DaysAccuracy: number;
}

export interface TeamStats {
  name: string;
  formSummary: {
    played: number;
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
    formString: string;
  };
  formMatches: {
    date: string;
    competition: string;
    homeTeam: string;
    awayTeam: string;
    homeScore: number;
    awayScore: number;
    result: 'W' | 'D' | 'L';
  }[];
}

export interface H2HMatch {
  date: string;
  competition: string;
  homeTeam: string;
  awayTeam: string;
  score: string;
}

export interface Lineup {
  status: 'confirmed' | 'tbc';
  formation: string;
  lastUpdated: string;
  source: string;
  starters: { name: string; position: string }[];
  bench: { name: string; position: string }[];
  absentees: { name: string; reason: string }[];
}

export interface MatchStats {
  matchId: string;
  teams: {
    home: TeamStats;
    away: TeamStats;
  };
  h2h: H2HMatch[];
  lineup?: Lineup;
}

export type ContextualPromptType = 'out_of_coins' | 'missed_streak' | 'heavy_player';
