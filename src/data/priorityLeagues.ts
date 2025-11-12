// ============================================================================
// Priority Leagues Configuration for Fantasy Data Seeding
// Initial seeding: 3 leagues with full data (players, stats, transfers)
// Additional leagues can be selected via Admin UI
// ============================================================================

export interface PriorityLeague {
  api_id: number;
  name: string;
  country: string;
  priority: boolean;
}

// Initial 3 leagues for testing and first deployment
export const PRIORITY_LEAGUES: PriorityLeague[] = [
  { api_id: 2, name: 'UEFA Champions League', country: 'World', priority: true },
  { api_id: 39, name: 'Premier League', country: 'England', priority: true },
  { api_id: 140, name: 'La Liga', country: 'Spain', priority: true },
];

// All available leagues for reference (can be selected via Admin UI)
export const ALL_AVAILABLE_LEAGUES: PriorityLeague[] = [
  // Top 5 European Leagues
  { api_id: 39, name: 'Premier League', country: 'England', priority: true },
  { api_id: 140, name: 'La Liga', country: 'Spain', priority: true },
  { api_id: 135, name: 'Serie A', country: 'Italy', priority: true },
  { api_id: 78, name: 'Bundesliga', country: 'Germany', priority: true },
  { api_id: 61, name: 'Ligue 1', country: 'France', priority: true },

  // European Competitions
  { api_id: 2, name: 'UEFA Champions League', country: 'World', priority: true },
  { api_id: 3, name: 'UEFA Europa League', country: 'World', priority: true },

  // Major European Leagues
  { api_id: 94, name: 'Primeira Liga', country: 'Portugal', priority: true },
  { api_id: 88, name: 'Eredivisie', country: 'Netherlands', priority: true },
  { api_id: 144, name: 'Jupiler Pro League', country: 'Belgium', priority: true },
  { api_id: 203, name: 'Süper Lig', country: 'Turkey', priority: true },

  // South American Leagues
  { api_id: 71, name: 'Série A', country: 'Brazil', priority: true },
  { api_id: 128, name: 'Liga Profesional', country: 'Argentina', priority: true },

  // Other Major Leagues
  { api_id: 253, name: 'Major League Soccer', country: 'USA', priority: true },
  { api_id: 307, name: 'Saudi Pro League', country: 'Saudi Arabia', priority: true },

  // Championship & Second Divisions (competitive)
  { api_id: 40, name: 'Championship', country: 'England', priority: true },
  { api_id: 141, name: 'La Liga 2', country: 'Spain', priority: true },

  // Asian Leagues
  { api_id: 188, name: 'Ligue 1', country: 'Algeria', priority: true },
  { api_id: 235, name: 'Premier League', country: 'Russia', priority: true },
  { api_id: 106, name: 'Liga MX', country: 'Mexico', priority: true },
];

// Additional leagues that will only have basic data (name, logo, country)
export const BASIC_LEAGUES: PriorityLeague[] = [
  { api_id: 41, name: 'League One', country: 'England', priority: false },
  { api_id: 42, name: 'League Two', country: 'England', priority: false },
  { api_id: 79, name: '2. Bundesliga', country: 'Germany', priority: false },
  { api_id: 62, name: 'Ligue 2', country: 'France', priority: false },
  { api_id: 136, name: 'Serie B', country: 'Italy', priority: false },
  // Add more as needed
];

export const ALL_LEAGUES = [...ALL_AVAILABLE_LEAGUES, ...BASIC_LEAGUES];
