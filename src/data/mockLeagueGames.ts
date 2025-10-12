import { LeagueGame } from '../types';

export const mockLeagueGames: LeagueGame[] = [
  {
    id: "lg_01",
    league_id: "l_001",
    game_id: "fantasy-1",
    game_name: "Sportime Fantasy",
    type: "Fantasy",
    members_joined: 2,
    members_total: 3,
    user_rank_in_league: 1,
    user_rank_global: 358,
    total_players_global: 25000
  },
  {
    id: "lg_02",
    league_id: "l_001",
    game_id: "swipe-1",
    game_name: "Match Day 1",
    type: "Prediction",
    members_joined: 3,
    members_total: 3,
    user_rank_in_league: 2,
    user_rank_global: 421,
    total_players_global: 8192
  },
  {
    id: "lg_03",
    league_id: "l_002",
    game_id: "fantasy-1",
    game_name: "Sportime Fantasy",
    type: "Fantasy",
    members_joined: 1,
    members_total: 2,
    user_rank_in_league: 2,
    user_rank_global: 358,
    total_players_global: 25000
  }
];
