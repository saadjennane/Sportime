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
    boosterStatus?: string;
    boosterRefunded?: boolean;
  };
}

/**
 * Simulates a full GameWeek calculation for a user's team.
 */
export function processGameWeek(
  userTeam: UserFantasyTeam,
  allPlayers: FantasyPlayer[],
  gameWeekStats: Record<string, PlayerGameWeekStats>
): { simulationResult: GameWeekSimulationResult, updatedTeam: UserFantasyTeam } {
  const playerResults: GameWeekSimulationResult['playerResults'] = {};
  const playerPoints: Record<string, number> = {};
  let boosterStatus: string | undefined = undefined;
  let boosterRefunded = false;
  
  let teamForProcessing = JSON.parse(JSON.stringify(userTeam));

  // 1. Handle Recovery Boost
  let fatigueState = { ...teamForProcessing.fatigue_state };
  if (teamForProcessing.booster_used === 3) { // 3 = Recovery Boost
    const targetId = teamForProcessing.booster_target_id;
    if (targetId) {
      const player = allPlayers.find(p => p.id === targetId);
      const stats = gameWeekStats[targetId];
      if (player && player.position !== 'Goalkeeper') {
        if (stats && stats.minutes_played > 0) {
          fatigueState[targetId] = 1.0;
          boosterStatus = `Recovery Boost applied to ${player.name}.`;
        } else {
          boosterStatus = `Recovery Boost refunded: ${player.name} did not play.`;
          teamForProcessing.booster_used = null;
          teamForProcessing.booster_target_id = null;
          boosterRefunded = true;
        }
      } else {
        boosterStatus = "Recovery Boost ignored: Target is a Goalkeeper or invalid.";
      }
    } else {
      boosterStatus = "Recovery Boost ignored: No target player selected.";
    }
  }

  // 2. Calculate points and new fatigue for each starter
  teamForProcessing.starters.forEach(playerId => {
    const player = allPlayers.find(p => p.id === playerId);
    const stats = gameWeekStats[playerId];
    if (!player || !stats) return;

    const initialFatigue = fatigueState[playerId] || 1.0;
    const isCaptain = player.id === teamForProcessing.captain_id;
    const isDoubleImpactActive = teamForProcessing.booster_used === 1; // 1 = Double Impact

    const { totalPoints, breakdown, basePoints } = computePlayerPoints(
      stats,
      player.position,
      initialFatigue,
      isCaptain,
      isDoubleImpactActive
    );
    
    playerPoints[playerId] = totalPoints;
    
    const finalFatigue = calculateFatigue(initialFatigue, player.status, stats.minutes_played > 0);
    fatigueState[playerId] = finalFatigue;

    playerResults[playerId] = {
      points: totalPoints,
      basePoints,
      breakdown,
      initialFatigue,
      finalFatigue,
    };
  });

  // 3. Update fatigue for subs (rested)
  teamForProcessing.substitutes.forEach(playerId => {
      const player = allPlayers.find(p => p.id === playerId);
      if (!player) return;

      const initialFatigue = fatigueState[playerId] || 1.0;
      const finalFatigue = calculateFatigue(initialFatigue, player.status, false);
      fatigueState[playerId] = finalFatigue;
      
      playerResults[playerId] = {
          points: 0,
          basePoints: 0,
          breakdown: {},
          initialFatigue,
          finalFatigue,
      }
  });

  // 4. Calculate final team score with bonuses
  const teamPlayers = teamForProcessing.starters.map(id => allPlayers.find(p => p.id === id)).filter(Boolean) as FantasyPlayer[];
  const isGoldenGameActive = teamForProcessing.booster_used === 2; // 2 = Golden Game
  const { finalScore, bonusApplied } = computeTeamTotal(
    teamPlayers,
    playerPoints,
    isGoldenGameActive
  );

  const updatedTeam = { ...teamForProcessing, fatigue_state: fatigueState };

  return {
    simulationResult: {
      playerResults,
      teamResult: {
        totalPoints: finalScore,
        bonusApplied,
        boosterStatus,
        boosterRefunded,
      },
    },
    updatedTeam,
  };
}
