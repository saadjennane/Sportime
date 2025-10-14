export interface Match {
  id: string;
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
export type DurationType = 'daily' | 'mini' | 'season';

// --- GENERIC GAME TYPES ---
// Base interface for all game modes
export interface Game {
  id: string;
  name: string;
  status: ChallengeStatus;
  startDate: string;
  endDate: string;
  entryCost: number;
  totalPlayers: number;
  gameType: 'betting' | 'prediction' | 'fantasy';
  is_linkable?: boolean;
  tournament_type?: TournamentType;
}

export interface BettingChallenge extends Game {
  gameType: 'betting';
  challengeBalance: number;
  duration_type: DurationType;
  // V1.1 Fields
  minimum_players: number;
  maximum_players: number;
  requires_subscription: boolean;
  required_badges: string[];
  minimum_level: string;
  participants: UserChallengeEntry[];
  custom_entry_cost?: number;
}

export interface PredictionGame extends Game {
  gameType: 'prediction';
  matches: SwipeMatch[];
  challengeId?: string; // New: Link to parent challenge
}

// Deprecated types, will be removed later
export type Challenge = BettingChallenge;
export type SwipeMatchDay = PredictionGame;


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
  user_id: string; // Changed to mandatory
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

// --- Swipe Prediction Game Types ---
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
  submitted_at: string | null; // Changed from isFinalized
}

export interface SwipeLeaderboardEntry {
  rank: number;
  username: string;
  points: number;
  userId?: string;
  correct_picks: number;
  submission_timestamp?: number;
}

// New: Parent entity for multi-day prediction challenges
export interface PredictionChallenge {
  id: string;
  title: string;
  season?: string;
  leagueId?: string;
  matchDayIds: string[];
  createdAt: string;
}

// --- Fantasy Football Types ---
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
  // Live mode fields
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
  name: string; // e.g., "MatchDay 1"
  startDate: string;
  endDate: string;
  leagues: string[];
  status: 'upcoming' | 'live' | 'finished';
  conditions?: GameWeekCondition[];
  formationConstraint?: string;
  theme?: string;
}

export interface FantasyGame extends Game {
  gameType: 'fantasy';
  gameWeeks: FantasyGameWeek[];
}

export interface FantasyLeaderboardEntry {
  rank: number;
  username: string;
  avatar: string;
  totalPoints: number;
  boosterUsed: Booster['id'] | null;
  userId?: string;
}

export interface League {
  id: string;
  name: string;
  logo: string;
  remaining_matchdays: number;
}


// --- Supabase Profile Type ---
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
  is_subscriber?: boolean; // V1.1
  badges?: string[];
  favorite_club?: string; // club ID
  favorite_national_team?: string; // country name
  sports_preferences?: {
    football?: {
      club?: string; // club ID
      national_team?: string; // country name
    },
    nba?: { team?: string },
    f1?: { team?: string, driver?: string },
    tennis?: { player?: string }
  }
}

// --- Progression System Types ---
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

// --- Toast Notification Type ---
export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

// --- User-Created Leagues ---
export interface UserLeague {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  invite_code: string;
  created_by: string; // user id
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
  start_date: string; // ISO string
  end_date: string;   // ISO string
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

// --- League Feed & Snapshots ---
export interface LeaderboardSnapshot {
  id: string;
  league_id: string;
  game_id: string;
  game_name: string;
  game_type: Game['gameType'];
  created_at: string;
  created_by: string; // user id
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
  likes: string[]; // array of user ids
}

// --- Private League Game Wizard ---
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

// --- Fantasy Live Types ---
export interface FantasyLiveBooster {
  id: number;
  name: string;
  description: string;
  type: 'individual' | 'team';
  duration: number; // in minutes, 0 for instant
  effect: string;
  malus?: string;
  icon: React.ReactNode;
  used: boolean;
  active_until?: string;
}

// --- Live Game ---
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
  
  // Prediction Mode
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

  // Betting Mode
  betting_state?: {
    pre_match_balance: number;
    live_balance: number;
    bets: LiveBet[];
    total_gain: number;
    last_gain_time?: string;
  };

  // Fantasy Live Mode
  fantasy_team?: {
    players: FantasyPlayer[];
    captain_id: string;
  };
}

export interface LiveGameMarket {
  id: string;
  minute: number;
  type: string; // e.g., 'first_goal', 'drama_last_goal'
  title: string;
  emotion_factor: number;
  odds: { option: string; adjusted: number }[];
  expires_at: string; // ISO string
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
  
  // Prediction Mode
  bonus_questions: BonusQuestion[];
  
  // Betting Mode
  markets: LiveGameMarket[];
  simulated_minute: number;

  // Fantasy Live Mode
  boosters?: FantasyLiveBooster[];

  players: LiveGamePlayerEntry[];
}


// --- API Football Types ---
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
  league: {
    id: number;
    name: string;
    type: string;
    logo: string;
  };
  country: {
    name: string;
    code: string;
    flag: string;
  };
  seasons: {
    year: number;
    start: string;
    end: string;
    current: boolean;
  }[];
}

export interface ApiTeamInfo {
  team: {
    id: number;
    name: string;
    country: string;
    logo: string;
  };
}

export interface ApiPlayerInfo {
  player: {
    id: number;
    name: string;
    firstname: string;
    lastname: string;
    age: number;
    birth: {
      date: string;
      place: string;
      country: string;
    };
    nationality: string;
    height: string;
    weight: string;
    photo: string;
  };
  statistics: {
    team: {
      id: number;
    };
    games: {
      position: string;
    };
  }[];
}

export interface ApiFixtureInfo {
  fixture: {
    id: number;
    date: string;
    status: {
      long: string;
      short: string;
      elapsed: number;
    };
  };
  league: {
    id: number;
    season: number;
  };
  teams: {
    home: { id: number; winner: boolean | null };
    away: { id: number; winner: boolean | null };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
}

export interface ApiOddsInfo {
  fixture: {
    id: number;
  };
  bookmakers: {
    name: string;
    bets: {
      name: string; // "Match Winner"
      values: {
        value: string; // "Home", "Draw", "Away"
        odd: string;
      }[];
    }[];
  }[];
}

export interface ApiSyncConfig {
  id: string; // endpoint name e.g., 'fixtures'
  frequency: string;
  last_sync_at: string | null;
}

// --- FANTASY ENGINE V2 TYPES ---
export interface FantasyConfig {
  fatigue: { star: number; key: number; rest: number };
  bonuses: { no_star: number; crazy: number; vintage: number };
  boosters: { double_impact: number; golden_game: number };
  captain_passive: number;
}

export interface PlayerLast10Stats {
  rating: number; // avg
  impact: number; // avg
  consistency: number; // avg
  minutes_played: number; // total
  total_possible_minutes: number; // total
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

// --- Onboarding ---
export interface OnboardingSlide {
  slide_number: number;
  title: string;
  subtitle: string;
  visual_description: string;
  cta_text: string | { primary: string; secondary: string };
  emotion: string;
  progress_visual: string;
}

// --- V1.1 Economy Types ---
export interface UserStreak {
  user_id: string;
  current_day: number;
  last_claimed_at: string; // ISO string
  total_cycles_completed: number;
}

export interface UserTicket {
  id: string;
  user_id: string;
  type: TournamentType;
  is_used: boolean;
  created_at: string; // V1.2
  expires_at: string;
  used_at?: string;
}
