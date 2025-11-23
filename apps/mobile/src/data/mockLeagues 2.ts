/**
 * Mock Leagues Data (Stub)
 *
 * NOTE: This is static data for league selection in wizards.
 * Maintained for backward compatibility with league creation wizards.
 */

export interface League {
  id: number;
  name: string;
  country: string;
  logo: string;
}

export const mockLeagues: League[] = [
  { id: 39, name: 'Premier League', country: 'England', logo: '⚽' },
  { id: 140, name: 'La Liga', country: 'Spain', logo: '⚽' },
  { id: 78, name: 'Bundesliga', country: 'Germany', logo: '⚽' },
  { id: 135, name: 'Serie A', country: 'Italy', logo: '⚽' },
  { id: 61, name: 'Ligue 1', country: 'France', logo: '⚽' },
  { id: 2, name: 'UEFA Champions League', country: 'Europe', logo: '⚽' },
];
