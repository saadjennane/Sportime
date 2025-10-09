import {
  FantasyPlayer,
  UserFantasyTeam,
  PlayerLast10Stats,
  PlayerGameWeekStats,
} from '../types';
import {
  computePGS,
  getPlayerCategoryFromPGS,
  calculateFatigue,
  computePlayerPoints,
  computeTeamTotal,
  FANTASY_CONFIG
} from '../lib/fantasy/engine';

/**
 * Pre-GameWeek function to update status for all players.
 * In a real app, this would be a backend process.
 */
export function updateAllPlayerStatuses(
  players: FantasyPlayer[],
  playerStats: Record<string, PlayerLast10Stats>
): FantasyPlayer[] {
  return players.map(player => {
    const stats = playerStats[player.id];
    if (!stats) return player;

    const { pgs, playtime_ratio } = computePGS(stats);
    const status = getPlayerCategoryFromPGS(pgs);

    return {
      ...player,
      pgs: parseFloat(pgs.toFixed(2)),
      status,
      playtime_ratio: parseFloat(playtime_ratio.toFixed(2)),
    };
  });
}

export interface GameWeekSimulationResult {
  playerResults: Record<string, {
    points: number;
    basePoints: number;
    breakdown: Record<string, number>;
    initialFatigue: number;
    finalFatigue: number;
  }>;
  teamResult: {
    totalPoints: number;
    bonusApplied: string | null;
  };
}

/**
 * Simulates a full GameWeek calculation for a user's team.
 */
export function processGameWeek(
  userTeam: UserFantasyTeam,
  allPlayers: FantasyPlayer[],
  gameWeekStats: Record<string, PlayerGameWeekStats>
): GameWeekSimulationResult {
  const playerResults: GameWeekSimulationResult['playerResults'] = {};
  const playerPoints: Record<string, number> = {};

  const teamPlayers = userTeam.starters.map(id => allPlayers.find(p => p.id === id)).filter(Boolean) as FantasyPlayer[];

  // 1. Handle Recovery Boost
  let fatigueState = { ...userTeam.fatigue_state };
  if (userTeam.booster_used === 3) { // 3 = Recovery Boost
    // In a real app, we'd need to know which player was chosen for the boost.
    // For this simulation, we'll assume it's the captain.
    fatigueState[userTeam.captain_id] = 1.0;
  }

  // 2. Calculate points and new fatigue for each starter
  userTeam.starters.forEach(playerId => {
    const player = allPlayers.find(p => p.id === playerId);
    const stats = gameWeekStats[playerId];
    if (!player || !stats) return;

    const initialFatigue = fatigueState[playerId] || 1.0;
    const isCaptain = player.id === userTeam.captain_id;
    const isDoubleImpactActive = userTeam.booster_used === 1; // 1 = Double Impact

    const { totalPoints, breakdown, basePoints } = computePlayerPoints(
      stats,
      player.position,
      initialFatigue,
      isCaptain,
      isDoubleImpactActive
    );
    
    playerPoints[playerId] = totalPoints;
    
    const finalFatigue = calculateFatigue(initialFatigue, player.status, true);

    playerResults[playerId] = {
      points: totalPoints,
      basePoints,
      breakdown,
      initialFatigue,
      finalFatigue,
    };
  });

  // 3. Update fatigue for subs (rested)
  userTeam.substitutes.forEach(playerId => {
      const player = allPlayers.find(p => p.id === playerId);
      if (!player) return;

      const initialFatigue = fatigueState[playerId] || 1.0;
      const finalFatigue = calculateFatigue(initialFatigue, player.status, false);
      
      playerResults[playerId] = {
          points: 0,
          basePoints: 0,
          breakdown: {},
          initialFatigue,
          finalFatigue,
      }
  });


  // 4. Calculate final team score with bonuses
  const isGoldenGameActive = userTeam.booster_used === 2; // 2 = Golden Game
  const { finalScore, bonusApplied } = computeTeamTotal(
    teamPlayers,
    playerPoints,
    isGoldenGameActive
  );

  return {
    playerResults,
    teamResult: {
      totalPoints: finalScore,
      bonusApplied,
    },
  };
}
