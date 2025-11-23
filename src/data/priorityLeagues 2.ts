/**
 * Priority Leagues Configuration
 *
 * NOTE: This configuration is used by DataSyncAdmin for syncing league data.
 * Defines which leagues to prioritize for match data synchronization.
 */

export const PRIORITY_LEAGUES = [
  { id: 39, name: 'Premier League', country: 'England' },
  { id: 140, name: 'La Liga', country: 'Spain' },
  { id: 78, name: 'Bundesliga', country: 'Germany' },
  { id: 135, name: 'Serie A', country: 'Italy' },
  { id: 61, name: 'Ligue 1', country: 'France' },
  { id: 2, name: 'UEFA Champions League', country: 'World' },
];

export const ALL_AVAILABLE_LEAGUES = [
  ...PRIORITY_LEAGUES,
  { id: 94, name: 'Primeira Liga', country: 'Portugal' },
  { id: 88, name: 'Eredivisie', country: 'Netherlands' },
  { id: 203, name: 'Süper Lig', country: 'Turkey' },
  { id: 3, name: 'UEFA Europa League', country: 'World' },
];
