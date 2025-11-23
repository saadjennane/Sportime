import { PlayerLast10Stats, PlayerGameWeekStats } from '../types';

// Mock data for calculating PGS (Player Game Score)
export const mockPlayerLast10Stats: Record<string, PlayerLast10Stats> = {
  'p1': { rating: 8.1, impact: 8.5, consistency: 7.8, minutes_played: 850, total_possible_minutes: 900 }, // Messi
  'p2': { rating: 7.8, impact: 8.8, consistency: 7.5, minutes_played: 820, total_possible_minutes: 900 }, // KDB
  'p3': { rating: 7.2, impact: 7.0, consistency: 7.5, minutes_played: 900, total_possible_minutes: 900 }, // VVD
  'p4': { rating: 7.0, impact: 6.5, consistency: 7.2, minutes_played: 900, total_possible_minutes: 900 }, // Alisson
  'p5': { rating: 7.9, impact: 8.2, consistency: 7.7, minutes_played: 780, total_possible_minutes: 900 }, // Bellingham
  'p6': { rating: 8.3, impact: 9.0, consistency: 8.0, minutes_played: 880, total_possible_minutes: 900 }, // Haaland
  'p7': { rating: 7.1, impact: 7.5, consistency: 6.8, minutes_played: 750, total_possible_minutes: 900 }, // Davies
  'p8': { rating: 6.8, impact: 7.2, consistency: 6.5, minutes_played: 650, total_possible_minutes: 900 }, // Pedri
  'p9': { rating: 6.9, impact: 6.8, consistency: 7.0, minutes_played: 890, total_possible_minutes: 900 }, // Kounde
  'p10': { rating: 5.8, impact: 7.9, consistency: 5.5, minutes_played: 700, total_possible_minutes: 900 }, // Wirtz
  'p11': { rating: 7.3, impact: 7.8, consistency: 6.9, minutes_played: 810, total_possible_minutes: 900 }, // Leao
  'p12': { rating: 6.9, impact: 6.6, consistency: 7.1, minutes_played: 850, total_possible_minutes: 900 }, // Ter Stegen
  'p13': { rating: 5.9, impact: 7.2, consistency: 5.2, minutes_played: 400, total_possible_minutes: 900 }, // James
};

// Mock GameWeek stats for scoring calculation
export const mockPlayerGameWeekStats: Record<string, PlayerGameWeekStats> = {
  // Starters for GW2
  'p4': { minutes_played: 90, goals: 0, assists: 0, shots_on_target: 0, saves: 4, penalties_saved: 0, penalties_scored: 0, penalties_missed: 0, yellow_cards: 0, red_cards: 0, goals_conceded: 0, interceptions: 0, tackles: 0, duels_won: 2, duels_lost: 1, dribbles_succeeded: 0, fouls_committed: 0, fouls_suffered: 1, rating: 7.8, clean_sheet: true }, // Alisson (GK)
  'p3': { minutes_played: 90, goals: 1, assists: 0, shots_on_target: 1, saves: 0, penalties_saved: 0, penalties_scored: 0, penalties_missed: 0, yellow_cards: 0, red_cards: 0, goals_conceded: 0, interceptions: 3, tackles: 2, duels_won: 5, duels_lost: 2, dribbles_succeeded: 0, fouls_committed: 1, fouls_suffered: 1, rating: 8.5, clean_sheet: true }, // VVD (DEF)
  'p7': { minutes_played: 80, goals: 0, assists: 1, shots_on_target: 0, saves: 0, penalties_saved: 0, penalties_scored: 0, penalties_missed: 0, yellow_cards: 0, red_cards: 0, goals_conceded: 0, interceptions: 1, tackles: 1, duels_won: 3, duels_lost: 3, dribbles_succeeded: 2, fouls_committed: 0, fouls_suffered: 2, rating: 7.5, clean_sheet: true }, // Davies (DEF)
  'p9': { minutes_played: 90, goals: 0, assists: 0, shots_on_target: 0, saves: 0, penalties_saved: 0, penalties_scored: 0, penalties_missed: 0, yellow_cards: 1, red_cards: 0, goals_conceded: 0, interceptions: 2, tackles: 3, duels_won: 4, duels_lost: 1, dribbles_succeeded: 1, fouls_committed: 2, fouls_suffered: 0, rating: 7.2, clean_sheet: true }, // Kounde (DEF)
  'p2': { minutes_played: 85, goals: 1, assists: 2, shots_on_target: 3, saves: 0, penalties_saved: 0, penalties_scored: 0, penalties_missed: 0, yellow_cards: 0, red_cards: 0, goals_conceded: 1, interceptions: 1, tackles: 0, duels_won: 4, duels_lost: 2, dribbles_succeeded: 3, fouls_committed: 1, fouls_suffered: 3, rating: 9.2, clean_sheet: false }, // KDB (MID)
  'p5': { minutes_played: 90, goals: 0, assists: 0, shots_on_target: 2, saves: 0, penalties_saved: 0, penalties_scored: 0, penalties_missed: 0, yellow_cards: 0, red_cards: 0, goals_conceded: 2, interceptions: 2, tackles: 2, duels_won: 6, duels_lost: 4, dribbles_succeeded: 4, fouls_committed: 2, fouls_suffered: 4, rating: 7.9, clean_sheet: false }, // Bellingham (MID)
  'p6': { minutes_played: 90, goals: 2, assists: 0, shots_on_target: 4, saves: 0, penalties_saved: 0, penalties_scored: 1, penalties_missed: 0, yellow_cards: 0, red_cards: 0, goals_conceded: 1, interceptions: 0, tackles: 0, duels_won: 5, duels_lost: 2, dribbles_succeeded: 1, fouls_committed: 1, fouls_suffered: 2, rating: 9.5, clean_sheet: false }, // Haaland (FWD) - Captain
  // Subs
  'p11': { minutes_played: 0, goals: 0, assists: 0, shots_on_target: 0, saves: 0, penalties_saved: 0, penalties_scored: 0, penalties_missed: 0, yellow_cards: 0, red_cards: 0, goals_conceded: 0, interceptions: 0, tackles: 0, duels_won: 0, duels_lost: 0, dribbles_succeeded: 0, fouls_committed: 0, fouls_suffered: 0, rating: 0, clean_sheet: false }, // Leao
  'p8': { minutes_played: 0, goals: 0, assists: 0, shots_on_target: 0, saves: 0, penalties_saved: 0, penalties_scored: 0, penalties_missed: 0, yellow_cards: 0, red_cards: 0, goals_conceded: 0, interceptions: 0, tackles: 0, duels_won: 0, duels_lost: 0, dribbles_succeeded: 0, fouls_committed: 0, fouls_suffered: 0, rating: 0, clean_sheet: false }, // Pedri
};
