export const TOURNAMENT_COSTS = {
  rookie: { base: 2000, multipliers: { daily: 1, mini: 2, season: 5 } },
  pro: { base: 10000, multipliers: { daily: 1, mini: 2, season: 5 } },
  elite: { base: 20000, multipliers: { daily: 1, mini: 2, season: 5 } }
};

export const TICKET_LIMITS = {
  rookie: { max: 5, expires_days: 30 },
  pro: { max: 3, expires_days: 45 },
  elite: { max: 2, expires_days: 60 }
};
