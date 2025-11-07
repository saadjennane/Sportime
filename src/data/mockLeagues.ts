import { League } from '../types';

// Using actual UUIDs from Supabase leagues table (see supabase/migrations/20250627000009_seed_leagues_fixed.sql)
export const mockLeagues: League[] = [
  { id: '22222222-2222-2222-2222-222222222222', name: 'La Liga', logo: 'https://media.api-sports.io/football/leagues/140.png', remaining_matchdays: 12 },
  { id: '11111111-1111-1111-1111-111111111111', name: 'Premier League', logo: 'https://media.api-sports.io/football/leagues/39.png', remaining_matchdays: 10 },
  { id: '33333333-3333-3333-3333-333333333333', name: 'Serie A', logo: 'https://media.api-sports.io/football/leagues/135.png', remaining_matchdays: 14 },
  { id: '44444444-4444-4444-4444-444444444444', name: 'Bundesliga', logo: 'https://media.api-sports.io/football/leagues/78.png', remaining_matchdays: 8 },
  { id: '55555555-5555-5555-5555-555555555555', name: 'Ligue 1', logo: 'https://media.api-sports.io/football/leagues/61.png', remaining_matchdays: 11 },
];
