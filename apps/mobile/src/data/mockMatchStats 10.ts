/**
 * Mock Match Stats Data (Stub)
 *
 * NOTE: Match statistics are now fetched from API-Sports.
 * This stub file exists only for backward compatibility with mockStatsProvider.ts.
 */

export interface MatchStats {
  matchId: string;
  teamAStats: {
    possession: number;
    shots: number;
    shotsOnTarget: number;
    corners: number;
    fouls: number;
  };
  teamBStats: {
    possession: number;
    shots: number;
    shotsOnTarget: number;
    corners: number;
    fouls: number;
  };
}

export const mockMatchStats: MatchStats[] = [];
