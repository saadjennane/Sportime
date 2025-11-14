/**
 * Mock Teams Data (Stub)
 *
 * NOTE: This is static data for user profile settings.
 * This stub contains popular football clubs for favorite team selection.
 */

export interface Team {
  id: number;
  name: string;
  logo: string;
  league: string;
}

export const mockTeams: Team[] = [
  { id: 33, name: 'Manchester United', logo: '⚽', league: 'Premier League' },
  { id: 40, name: 'Liverpool', logo: '⚽', league: 'Premier League' },
  { id: 47, name: 'Chelsea', logo: '⚽', league: 'Premier League' },
  { id: 50, name: 'Manchester City', logo: '⚽', league: 'Premier League' },
  { id: 42, name: 'Arsenal', logo: '⚽', league: 'Premier League' },
  { id: 529, name: 'Barcelona', logo: '⚽', league: 'La Liga' },
  { id: 541, name: 'Real Madrid', logo: '⚽', league: 'La Liga' },
  { id: 157, name: 'Bayern Munich', logo: '⚽', league: 'Bundesliga' },
  { id: 489, name: 'Juventus', logo: '⚽', league: 'Serie A' },
  { id: 492, name: 'AC Milan', logo: '⚽', league: 'Serie A' },
];
