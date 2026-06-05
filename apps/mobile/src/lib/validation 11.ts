import { PrivateGameFormat, KnockoutType } from '../types';

interface ValidationResult {
  valid: boolean;
  error?: string;
  playoffDays?: number;
  restWeek?: boolean;
  requiredDays?: number;
}

export function validatePrivateLeagueConfig(
  format: PrivateGameFormat,
  players: number,
  matchdays: number,
  knockoutType: KnockoutType | null
): ValidationResult {
  if (format === "championship") {
    if (players < 3) {
      return { valid: false, error: "Championship format requires at least 3 players." };
    }
    return { valid: true, restWeek: players % 2 !== 0 };
  }

  if (format === "championship_knockout") {
    if (players < 4) {
      return { valid: false, error: "This format requires at least 4 players for the knockout stage." };
    }
    const requiredPlayoffDays = knockoutType === "double" ? 4 : 2; // Semis + Final
    if (matchdays <= requiredPlayoffDays) {
      return { valid: false, error: `You need more than ${requiredPlayoffDays} matchdays to include playoffs.` };
    }
    return {
      valid: true,
      playoffDays: requiredPlayoffDays,
      restWeek: players % 2 !== 0
    };
  }

  if (format === "knockout") {
    if (players < 2 || (players & (players - 1)) !== 0) {
        // Not a power of 2
        return { valid: false, error: "Knockout format works best with a power of 2 players (e.g., 4, 8, 16)." };
    }
    const rounds = Math.log2(players);
    const requiredDays = knockoutType === "double" ? rounds * 2 : rounds;
    if (matchdays < requiredDays) {
        return { valid: false, error: `This format requires at least ${requiredDays} matchdays for ${players} players.` };
    }
    return {
      valid: true,
      requiredDays
    };
  }

  return { valid: false, error: "Invalid format selected." };
}
