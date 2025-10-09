import { differenceInYears, parseISO } from 'date-fns';
import {
  FantasyPlayer,
  PlayerPosition,
  PlayerCategory,
  PlayerLast10Stats,
  PlayerGameWeekStats,
  FantasyConfig,
  UserFantasyTeam,
} from '../../types';

export const FANTASY_CONFIG: FantasyConfig = {
  fatigue: { star: 0.2, key: 0.1, rest: 0.1 },
  bonuses: { no_star: 1.25, crazy: 1.4, vintage: 1.2 },
  boosters: { double_impact: 2.2, golden_game: 1.2 },
  captain_passive: 1.1,
};

const BASE_SCORING_TABLE: Record<keyof PlayerGameWeekStats, Record<PlayerPosition, number>> = {
  minutes_played: { Goalkeeper: 1, Defender: 1, Midfielder: 1, Attacker: 1 },
  clean_sheet: { Goalkeeper: 5, Defender: 4, Midfielder: 2, Attacker: 0 },
  goals: { Goalkeeper: 8, Defender: 6, Midfielder: 5, Attacker: 4 },
  assists: { Goalkeeper: 4, Defender: 4, Midfielder: 3, Attacker: 2 },
  shots_on_target: { Goalkeeper: 0.5, Defender: 0.5, Midfielder: 0.5, Attacker: 0.5 },
  saves: { Goalkeeper: 1 / 3, Defender: 0, Midfielder: 0, Attacker: 0 },
  penalties_saved: { Goalkeeper: 5, Defender: 0, Midfielder: 0, Attacker: 0 },
  penalties_scored: { Goalkeeper: 3, Defender: 3, Midfielder: 3, Attacker: 3 },
  penalties_missed: { Goalkeeper: -2, Defender: -2, Midfielder: -2, Attacker: -2 },
  yellow_cards: { Goalkeeper: -1, Defender: -1, Midfielder: -1, Attacker: -1 },
  red_cards: { Goalkeeper: -3, Defender: -3, Midfielder: -3, Attacker: -3 },
  goals_conceded: { Goalkeeper: -1, Defender: -0.5, Midfielder: 0, Attacker: 0 },
  interceptions: { Goalkeeper: 0.3, Defender: 0.5, Midfielder: 0.2, Attacker: 0 },
  tackles: { Goalkeeper: 0.3, Defender: 0.5, Midfielder: 0.2, Attacker: 0 },
  duels_won: { Goalkeeper: 0.2, Defender: 0.3, Midfielder: 0.3, Attacker: 0.2 },
  duels_lost: { Goalkeeper: -0.1, Defender: -0.1, Midfielder: -0.1, Attacker: -0.1 },
  dribbles_succeeded: { Goalkeeper: 0, Defender: 0.2, Midfielder: 0.3, Attacker: 0.3 },
  fouls_committed: { Goalkeeper: -0.3, Defender: -0.3, Midfielder: -0.3, Attacker: -0.3 },
  fouls_suffered: { Goalkeeper: 0.2, Defender: 0.2, Midfielder: 0.2, Attacker: 0.2 },
  rating: { Goalkeeper: 1.5, Defender: 1.3, Midfielder: 1.2, Attacker: 1.1 },
};

/**
 * Computes Player Game Score (PGS) including playtime adjustment.
 */
export function computePGS(stats: PlayerLast10Stats): { pgs: number, playtime_ratio: number } {
  const basePgs = (stats.rating * 0.5) + (stats.impact * 0.3) + (stats.consistency * 0.2);
  const playtime_ratio = stats.total_possible_minutes > 0 ? stats.minutes_played / stats.total_possible_minutes : 0;

  let playtimeAdjustment = 0.05;
  if (playtime_ratio >= 0.9) {
    playtimeAdjustment = 0.3;
  } else if (playtime_ratio >= 0.5) {
    playtimeAdjustment = 0.15;
  }

  return { pgs: basePgs + playtimeAdjustment, playtime_ratio };
}

/**
 * Determines a player's category based on their PGS.
 */
export function getPlayerCategoryFromPGS(pgs: number): PlayerCategory {
  if (pgs >= 7.5) return 'Star';
  if (pgs >= 6.0) return 'Key';
  return 'Wild';
}

/**
 * Calculates the new fatigue level for a player.
 */
export function calculateFatigue(
  currentFatigue: number,
  category: PlayerCategory,
  played: boolean
): number {
  if (!played) {
    return Math.min(1.0, currentFatigue + FANTASY_CONFIG.fatigue.rest);
  }

  let fatigueReduction = 0;
  if (category === 'Star') {
    fatigueReduction = FANTASY_CONFIG.fatigue.star;
  } else if (category === 'Key') {
    fatigueReduction = FANTASY_CONFIG.fatigue.key;
  }

  return currentFatigue - fatigueReduction;
}

/**
 * Computes the total points for a single player in a GameWeek.
 */
export function computePlayerPoints(
  stats: PlayerGameWeekStats,
  position: PlayerPosition,
  fatigue: number,
  isCaptain: boolean,
  isDoubleImpactActive: boolean
): { totalPoints: number, breakdown: Record<string, number> } {
  let basePoints = 0;
  const breakdown: Record<string, number> = {};

  // Minutes played bonus
  if (stats.minutes_played > 60) {
    const points = BASE_SCORING_TABLE.minutes_played[position];
    basePoints += points;
    breakdown['Minutes > 60'] = points;
  }

  // Clean sheet bonus
  if (stats.clean_sheet && stats.minutes_played > 60) {
    const points = BASE_SCORING_TABLE.clean_sheet[position];
    basePoints += points;
    if (points) breakdown['Clean Sheet'] = points;
  }

  // Action-based scoring
  (Object.keys(stats) as Array<keyof PlayerGameWeekStats>).forEach(action => {
    if (action === 'minutes_played' || action === 'clean_sheet' || action === 'rating') return;
    
    const value = stats[action];
    if (typeof value === 'number' && value > 0) {
      const pointsPerAction = BASE_SCORING_TABLE[action][position];
      if (pointsPerAction) {
          const totalActionPoints = pointsPerAction * value;
          basePoints += totalActionPoints;
          breakdown[action.replace(/_/g, ' ')] = totalActionPoints;
      }
    }
  });

  // Apply rating multiplier
  const ratingMultiplier = BASE_SCORING_TABLE.rating[position];
  const ratingPoints = basePoints * (ratingMultiplier - 1);
  basePoints += ratingPoints;
  if (ratingPoints) breakdown['Rating Bonus'] = ratingPoints;

  let finalPoints = basePoints;
  
  // Apply fatigue multiplier
  const fatigueEffect = finalPoints * (fatigue - 1);
  finalPoints += fatigueEffect;
  if (fatigueEffect) breakdown['Fatigue Effect'] = fatigueEffect;

  // Apply captain bonus
  if (isCaptain) {
    const captainPassiveBonus = finalPoints * (FANTASY_CONFIG.captain_passive - 1);
    finalPoints += captainPassiveBonus;
    if(captainPassiveBonus) breakdown['Captain Bonus'] = captainPassiveBonus;

    if (isDoubleImpactActive) {
      // The total multiplier is 2.2. We've already applied 1.1, so we apply the rest.
      const doubleImpactMultiplier = FANTASY_CONFIG.boosters.double_impact / FANTASY_CONFIG.captain_passive;
      const doubleImpactBonus = finalPoints * (doubleImpactMultiplier - 1);
      finalPoints += doubleImpactBonus;
      if(doubleImpactBonus) breakdown['Double Impact'] = doubleImpactBonus;
    }
  }

  return { totalPoints: finalPoints, breakdown };
}

/**
 * Computes the final team total after applying team-wide bonuses.
 */
export function computeTeamTotal(
  teamPlayers: FantasyPlayer[],
  playerPoints: Record<string, number>,
  isGoldenGameActive: boolean
): { finalScore: number; bonusApplied: string | null } {
  let totalPoints = Object.values(playerPoints).reduce((sum, points) => sum + points, 0);
  let bonusApplied: string | null = null;

  // Determine which team bonus is highest (they are exclusive)
  let bestBonusMultiplier = 1.0;

  const isNoStar = teamPlayers.every(p => p.status !== 'Star');
  if (isNoStar) {
    bestBonusMultiplier = Math.max(bestBonusMultiplier, FANTASY_CONFIG.bonuses.no_star);
    bonusApplied = `No Star Bonus (+${(FANTASY_CONFIG.bonuses.no_star - 1) * 100}%)`;
  }

  const isCrazy = teamPlayers.every(p => p.status === 'Wild');
  if (isCrazy && FANTASY_CONFIG.bonuses.crazy > bestBonusMultiplier) {
    bestBonusMultiplier = FANTASY_CONFIG.bonuses.crazy;
    bonusApplied = `Crazy Boost (+${(FANTASY_CONFIG.bonuses.crazy - 1) * 100}%)`;
  }

  const avgAge = teamPlayers.reduce((sum, p) => sum + differenceInYears(new Date(), parseISO(p.birthdate)), 0) / teamPlayers.length;
  if (avgAge >= 30 && FANTASY_CONFIG.bonuses.vintage > bestBonusMultiplier) {
    bestBonusMultiplier = FANTASY_CONFIG.bonuses.vintage;
    bonusApplied = `Vintage Boost (+${(FANTASY_CONFIG.bonuses.vintage - 1) * 100}%)`;
  }

  totalPoints *= bestBonusMultiplier;

  // Apply Golden Game booster
  if (isGoldenGameActive) {
    totalPoints *= FANTASY_CONFIG.boosters.golden_game;
    bonusApplied = bonusApplied 
      ? `${bonusApplied} & Golden Game (+20%)` 
      : 'Golden Game (+20%)';
  }

  return { finalScore: totalPoints, bonusApplied };
}
