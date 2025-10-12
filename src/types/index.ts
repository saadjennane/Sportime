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

export type ChallengeStatus = 'Upcoming' | 'Ongoing' | 'Finished';

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
}

export interface BettingChallenge extends Game {
  gameType: 'betting';
  challengeBalance: number;
}

export interface PredictionGame extends Game {
  gameType: 'prediction';
  matches: SwipeMatch[];
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
  user_id?: string;
  challengeId: string;
  dailyEntries: DailyChallengeEntry[];
  finalPoints?: number;
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
  isFinalized: boolean;
}

export interface SwipeLeaderboardEntry {
  rank: number;
  username: string;
  points: number;
  userId?: string;
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
  captain_id: string;
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
  type: 'Fantasy' | 'Prediction' | 'Betting';
  members_joined: number;
  members_total: number;
  user_rank_in_league: number;
  user_rank_global: number;
  total_players_global: number;
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
