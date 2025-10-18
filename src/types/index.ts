export interface Match {
  id: string;
  leagueName: string;
  leagueLogo: string;
  teamA: {
    name: string;
    emoji: string;
  };
  teamB: {
    name:string;
    emoji: string;
  };
  kickoffTime: string;
  odds: {
    teamA: number;
    draw: number;
    teamB: number;
  };
  status: 'upcoming' | 'played';
  result?: 'teamA' | 'draw' | 'teamB';
  score?: {
    teamA: number;
    teamB: number;
  };
  hasLineup?: boolean;
}

export interface Bet {
  matchId: string;
  prediction: 'teamA' | 'draw' | 'teamB';
  amount: number;
  odds: number;
  status: 'pending' | 'won' | 'lost';
  winAmount?: number;
}

export type ChallengeStatus = 'Upcoming' | 'Ongoing' | 'Finished' | 'Cancelled' | 'Pending';
export type TournamentType = 'rookie' | 'pro' | 'elite';
export type DurationType = 'daily' | 'mini-series' | 'seasonal';
export type GameType = 'betting' | 'prediction' | 'fantasy' | 'fantasy-live';
export type GameFormat = 'leaderboard' | 'knockout' | 'championship' | 'battle_royale' | 'classic';
export type RewardTier = 'tier1' | 'tier2' | 'tier3';
export type ConditionsLogic = 'and' | 'or';

export interface RewardItem {
  id: string;
  type: "ticket" | "spin" | "xp" | "giftcard" | "masterpass" | "custom" | "premium_3d" | "premium_7d" | "coins";
  tier?: "rookie" | "pro" | "elite";
  value?: number | string;
  name?: string;
  logo?: string;
  description?: string;
  link?: string;
}

export interface GameRewardTier {
  id: string;
  positionType: 'rank' | 'range' | 'percent';
  start: number;
  end?: number;
  rewards: RewardItem[];
}

// Unified Game Type
export interface SportimeGame {
  id: string;
  name: string;
  description?: string;
  league_id?: string;
  start_date: string;
  end_date: string;
  game_type: GameType;
  tier: TournamentType;
  entry_cost: number;
  custom_entry_cost_enabled?: boolean;
  is_linkable: boolean;
  reward_tier?: RewardTier;
  format?: GameFormat;
  requires_subscription: boolean;
  minimum_level: string;
  required_badges: string[];
  conditions_logic?: ConditionsLogic;
  minimum_players: number;
  maximum_players: number;
  status: ChallengeStatus;
  totalPlayers: number;
  participants: string[];
  rewards: GameRewardTier[];

  // Game-specific fields
  // For betting
  challengeBalance?: number;
  duration_type?: DurationType;
  // For prediction
  matches?: SwipeMatch[];
  challengeId?: string;
  // For fantasy
  gameWeeks?: FantasyGameWeek[];
}

// --- DEPRECATED TYPES (to be removed) ---
export type Game = SportimeGame;
export type BettingChallenge = SportimeGame & { game_type: 'betting' };
export type PredictionGame = SportimeGame & { game_type: 'prediction' };
export type FantasyGame = SportimeGame & { game_type: 'fantasy' };
export type SwipeMatchDay = PredictionGame;
// --- END DEPRECATED ---


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
  finalPoints?: number;
  entryMethod: 'coins' | 'ticket';
  ticketId?: string;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  finalCoins: number;
  points: number;
  userId?: string;
}

export type SwipePredictionOutcome = 'teamA' | 'draw' | 'teamB';

export interface SwipeMatch {
  id: string;
  teamA: { name: string; emoji: string };
  teamB: { name: string; emoji: string };
  kickoffTime: string;
  odds: { teamA: number; draw: number; teamB: number };
  result?: SwipePredictionOutcome;
}

export interface UserSwipePrediction {
  matchId: string;
  prediction: SwipePredictionOutcome;
}

export interface UserSwipeEntry {
  user_id?: string;
  matchDayId: string;
  predictions: UserSwipePrediction[];
  submitted_at: string | null;
}

export interface SwipeLeaderboardEntry {
  rank: number;
  username: string;
  points: number;
  userId?: string;
  correct_picks: number;
  submission_timestamp?: number;
}

export interface PredictionChallenge {
  id: string;
  title: string;
  season?: string;
  leagueId?: string;
  matchDayIds: string[];
  createdAt: string;
}

export type PlayerCategory = 'Star' | 'Key' | 'Wild';
export type PlayerPosition = 'Goalkeeper' | 'Defender' | 'Midfielder' | 'Attacker';
export type PlayerLiveStatus = 'playing' | 'not_yet_played' | 'dnp' | 'finished';


export interface Booster {
  id: number;
  name: string;
  description: string;
  icon: React.ReactNode;
  used: boolean;
}

export interface FantasyPlayer {
  id: string;
  name: string;
  photo: string;
  position: PlayerPosition;
  fatigue: number;
  teamName: string;
  teamLogo: string;
  birthdate: string;
  pgs: number; 
  status: PlayerCategory;
  playtime_ratio?: number;
  liveStatus?: PlayerLiveStatus;
  isSubbedIn?: boolean;
  livePoints?: number;
  livePointsBreakdown?: Record<string, number>;
}

export interface UserFantasyTeam {
  userId: string;
  gameId: string;
  gameWeekId: string;
  starters: string[];
  substitutes: string[];
  captain_id: string;
  fatigue_state: Record<string, number>; 
  booster_used: number | null;
  booster_target_id?: string | null;
  booster_refunded?: boolean;
}

export interface GameWeekCondition {
  key: string;
  text: string;
  value: number | string;
}

export interface FantasyGameWeek {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  leagues: string[];
  status: 'upcoming' | 'live' | 'finished';
  conditions?: GameWeekCondition[];
  formationConstraint?: string;
  theme?: string;
}

export interface Profile {
  id: string;
  email: string | null;
  username: string | null;
  verified: boolean;
  is_guest: boolean;
  profile_picture_url?: string | null;
  level?: string;
  xp?: number;
  coins_balance: number;
  created_at: string;
  is_admin?: boolean;
  is_subscriber?: boolean;
  subscription_expires_at?: string;
  badges?: string[];
  favorite_club?: string;
  favorite_national_team?: string;
  sports_preferences?: {
    football?: {
      club?: string;
      national_team?: string;
    },
    nba?: { team?: string },
    f1?: { team?: string, driver?: string },
    tennis?: { player?: string }
  }
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

export interface LevelConfig {
  id: string;
  level_name: string;
  min_xp: number;
  max_xp: number;
  level_icon_url: string;
}

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
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

export type LeaderboardPeriodStartType = 'season_start' | 'link_date' | 'last_member_joined' | 'custom';
export type LeaderboardPeriodEndType = 'season_end' | 'custom';

export interface LeaderboardPeriod {
  start_type: LeaderboardPeriodStartType;
  end_type: LeaderboardPeriodEndType;
  start_date: string;
  end_date: string;
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
  leaderboard_period?: LeaderboardPeriod | null;
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
  type: 'celebration' | 'new_member' | 'game_linked';
  author_id: string;
  created_at: string;
  message: string;
  metadata: {
    snapshot_id?: string;
    game_name?: string;
    new_member_name?: string;
    top_players?: { name: string; score: number }[];
  };
  likes: string[];
}

export type PrivateGameFormat = 'championship' | 'championship_knockout' | 'knockout';
export type KnockoutType = 'single' | 'double';

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
}

export interface PrivateLeagueGame {
  id: string;
  league_id: string;
  config: PrivateLeagueGameConfig;
  created_at: string;
}

export interface FantasyLiveBooster {
  id: number;
  name: string;
  description: string;
  type: 'individual' | 'team';
  duration: number;
  effect: string;
  malus?: string;
  icon: React.ReactNode;
  used: boolean;
  active_until?: string;
}

export interface BonusQuestion {
  id: string;
  question: string;
  options?: string[];
  answer: string;
}

export interface LiveBet {
  market_id: string;
  option: string;
  amount: number;
  odds: number;
  phase: 'pre-match' | 'live';
  status: 'pending' | 'won' | 'lost';
  gain: number;
}

export interface LiveGamePlayerEntry {
  user_id: string;
  submitted_at: string;
  predicted_score?: { home: number; away: number };
  bonus_answers?: { question_id: string; choice: string }[];
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
  fantasy_team?: {
    players: FantasyPlayer[];
    captain_id: string;
  };
}

export interface LiveGameMarket {
  id: string;
  minute: number;
  type: string;
  title: string;
  emotion_factor: number;
  odds: { option: string; adjusted: number }[];
  expires_at: string;
  status: 'open' | 'closed' | 'resolved';
  winning_option?: string;
}

export interface LiveGame {
  id: string;
  league_id: string;
  match_id: string;
  match_details: Match;
  created_by: string;
  status: 'Upcoming' | 'Ongoing' | 'Finished';
  mode: 'prediction' | 'betting' | 'fantasy-live';
  last_known_state?: {
    minute: number;
    score: { home: number, away: number };
  };
  bonus_questions: BonusQuestion[];
  markets: LiveGameMarket[];
  simulated_minute: number;
  boosters?: FantasyLiveBooster[];
  players: LiveGamePlayerEntry[];
}

export interface ActiveSession {
  id: string;
  matchId: string;
  gameTypeId: string;
  leagueId?: string;
  pin?: string;
  createdAt: number;
  expiresAt: number;
}

export interface ApiFootballResponse<T> {
  get: string;
  parameters: Record<string, string>;
  errors: any[];
  results: number;
  paging: {
    current: number;
    total: number;
  };
  response: T[];
}

export interface ApiLeagueInfo {
  league: { id: number; name: string; type: string; logo: string; };
  country: { name: string; code: string; flag: string; };
  seasons: { year: number; start: string; end: string; current: boolean; }[];
}

export interface ApiTeamInfo {
  team: { id: number; name: string; country: string; logo: string; };
}

export interface ApiPlayerInfo {
  player: { id: number; name: string; firstname: string; lastname: string; age: number; birth: { date: string; place: string; country: string; }; nationality: string; height: string; weight: string; photo: string; };
  statistics: { team: { id: number; }; games: { position: string; }; }[];
}

export interface ApiFixtureInfo {
  fixture: { id: number; date: string; status: { long: string; short: string; elapsed: number; }; };
  league: { id: number; season: number; };
  teams: { home: { id: number; winner: boolean | null }; away: { id: number; winner: boolean | null }; };
  goals: { home: number | null; away: number | null; };
}

export interface ApiOddsInfo {
  fixture: { id: number; };
  bookmakers: { name: string; bets: { name: string; values: { value: string; odd: string; }[]; }[]; }[];
}

export interface ApiSyncConfig {
  id: string;
  frequency: string;
  last_sync_at: string | null;
}

export interface FantasyConfig {
  fatigue: { star: number; key: number; rest: number };
  bonuses: { no_star: number; crazy: number; vintage: number };
  boosters: { double_impact: number; golden_game: number };
  captain_passive: number;
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

export interface OnboardingSlide {
  slide_number: number;
  title: string;
  subtitle: string;
  visual_description: string;
  cta_text: string | { primary: string; secondary: string };
  emotion: string;
  progress_visual: string;
}

export interface UserStreak {
  user_id: string;
  current_day: number;
  last_claimed_at: string;
  total_cycles_completed: number;
}

export interface UserTicket {
  id: string;
  user_id: string;
  type: TournamentType;
  is_used: boolean;
  created_at: string;
  expires_at: string;
  used_at?: string;
}

// --- Spin Engine Types ---
export type SpinTier = 'rookie' | 'pro' | 'elite';

export interface SpinReward {
  id: string;
  label: string;
  baseChance: number;
  category: string;
}

export interface SpinResult {
  id: string;
  tier: SpinTier;
  rewardId: string;
  rewardLabel: string;
  timestamp: string;
  wasPity: boolean;
}

export interface UserSpinState {
  userId: string;
  adaptiveMultipliers: Record<string, { multiplier: number; expiresAt?: string }>;
  pityCounter: number;
  spinHistory: SpinResult[];
  availableSpins: Record<SpinTier, number>;
}

export interface SpinTelemetryLog {
  user_id: string;
  wheel_tier: SpinTier;
  outcome: string;
  rarity_flag: boolean;
  multipliers: Record<string, number>;
  pity_active: boolean;
  inventory_snapshot: any;
  timestamp: string;
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

export interface GameFilters {
  type: GameType | 'all';
  format: GameFormat | 'all';
  tier: TournamentType | 'all';
  duration: DurationType | 'all';
  eligibleOnly: boolean;
}

// --- Match Stats Drawer Types ---
export interface FormSummary {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  formString: string;
}

export interface FormMatch {
  date: string;
  competition: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  result: 'W' | 'D' | 'L';
}

export interface TeamStats {
  name: string;
  formSummary: FormSummary;
  formMatches: FormMatch[];
}

export interface H2HMatch {
  date: string;
  competition: string;
  homeTeam: string;
  awayTeam: string;
  score: string;
}

export interface LineupPlayer {
  name: string;
  position: string;
}

export interface Absentee {
  name: string;
  reason: string;
}

export interface Lineup {
  status: 'confirmed' | 'tbc';
  formation: string;
  lastUpdated: string;
  source: string;
  starters: LineupPlayer[];
  bench: LineupPlayer[];
  absentees: Absentee[];
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
