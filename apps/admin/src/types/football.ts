export interface League {
  id: string; // UUID
  name: string;
  country_or_region: string;
  logo_url?: string;
  logo?: string;
  type?: string;
  api_league_id?: number;
  api_id?: number;
  description?: string;
  created_by?: string;
  invite_code?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Team {
  id: string; // UUID
  name: string;
  logo_url?: string;
  logo?: string;
  country: string;
  code?: string;
  api_team_id?: number;
  api_id?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Player {
  id: string; // UUID
  first_name: string;
  last_name: string;
  name?: string;
  photo_url?: string;
  photo?: string;
  nationality: string;
  birthdate: string;
  position: string;
  height_cm?: number;
  weight_kg?: number;
  api_id?: number;
  stats?: any;
  pgs?: number;
  category?: 'Star' | 'Key' | 'Wild';
  fatigue?: number;
  created_at?: string;
  updated_at?: string;
}

export interface TeamLeagueParticipation {
  id?: string;
  team_id: string;
  league_id: string;
  season: string;
  group?: string;
  created_at?: string;
}

export interface PlayerTeamAssociation {
  id?: string;
  player_id: string;
  team_id: string;
  start_date: string;
  end_date?: string | null; // NULL = current team
  created_at?: string;
}

// Input types for creating/updating
export interface LeagueInput {
  name: string;
  country_or_region: string;
  logo_url?: string;
  logo?: string;
  type?: string;
  description?: string;
}

export interface TeamInput {
  name: string;
  logo_url?: string;
  logo?: string;
  country: string;
  code?: string;
}

export interface PlayerInput {
  first_name: string;
  last_name: string;
  name?: string;
  photo_url?: string;
  photo?: string;
  nationality: string;
  birthdate: string;
  position: string;
  height_cm?: number;
  weight_kg?: number;
  pgs?: number;
  category?: 'Star' | 'Key' | 'Wild';
  fatigue?: number;
}

// Extended types with relationships
export interface LeagueWithTeamCount extends League {
  team_count?: number;
}

export interface TeamWithCounts extends Team {
  league_count?: number;
  player_count?: number;
  leagues?: string; // Comma-separated league names
}

export interface PlayerWithTeam extends Player {
  team_name?: string;
  team_logo?: string;
  teams?: string; // Comma-separated team names
}
