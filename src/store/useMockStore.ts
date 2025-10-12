import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import {
  BettingChallenge,
  SwipeMatchDay,
  FantasyGame,
  UserLeague,
  LeagueMember,
  LeagueGame,
  Game,
  Profile,
  LeaderboardPeriod,
} from '../types';

// Import mock data
import { mockChallenges } from '../data/mockChallenges';
import { mockSwipeMatchDays } from '../data/mockSwipeGames';
import { mockFantasyGame } from '../data/mockFantasy.tsx';
import { mockUserLeagues } from '../data/mockUserLeagues';
import { mockLeagueMembers } from '../data/mockLeagueMembers';
import { mockLeagueGames } from '../data/mockLeagueGames';
import { mockScores } from '../data/mockLeaderboardScores';

interface MockDataState {
  challenges: BettingChallenge[];
  swipeMatchDays: SwipeMatchDay[];
  fantasyGames: FantasyGame[];
  userLeagues: UserLeague[];
  leagueMembers: LeagueMember[];
  leagueGames: LeagueGame[];
  leaderboardScores: typeof mockScores;
}

interface MockDataActions {
  createLeague: (name: string, description: string, profile: Profile) => UserLeague;
  linkGameToLeagues: (game: Game, leagueIds: string[]) => { linkedLeagueNames: string[] };
  createLeagueAndLink: (name: string, description: string, gameToLink: Game, profile: Profile) => void;
  unlinkGameFromLeague: (gameId: string, leagueId: string) => void;
  updateLeagueGameLeaderboardPeriod: (leagueGameId: string, period: LeaderboardPeriod) => void;
}

export const useMockStore = create<MockDataState & MockDataActions>((set, get) => ({
  // Initial State from mock files
  challenges: mockChallenges,
  swipeMatchDays: mockSwipeMatchDays,
  fantasyGames: [mockFantasyGame],
  userLeagues: mockUserLeagues,
  leagueMembers: mockLeagueMembers,
  leagueGames: mockLeagueGames,
  leaderboardScores: mockScores,

  // Action to create a new league
  createLeague: (name, description, profile) => {
    const { userLeagues, leagueMembers } = get();
    const invite_code = Math.random().toString(36).substring(2, 10).toUpperCase();
    
    const newLeague: UserLeague = {
      id: uuidv4(),
      name,
      description: description || undefined,
      image_url: undefined,
      invite_code,
      created_by: profile.id,
      created_at: new Date().toISOString(),
    };

    const newAdminMember: LeagueMember = {
      id: uuidv4(),
      league_id: newLeague.id,
      user_id: profile.id,
      role: 'admin',
      joined_at: new Date().toISOString(),
    };

    set({
      userLeagues: [...userLeagues, newLeague],
      leagueMembers: [...leagueMembers, newAdminMember],
    });

    return newLeague;
  },

  // Action to link a game to one or more leagues
  linkGameToLeagues: (game, leagueIds) => {
    const { leagueGames, leagueMembers, userLeagues } = get();
    const newLeagueGames: LeagueGame[] = [];
    const linkedLeagueNames: string[] = [];

    leagueIds.forEach(leagueId => {
      const alreadyLinked = leagueGames.some(lg => lg.league_id === leagueId && lg.game_id === game.id);
      if (alreadyLinked) return;

      const league = userLeagues.find(l => l.id === leagueId);
      if (!league) return;

      const membersOfLeague = leagueMembers.filter(m => m.league_id === leagueId);
      const newLinkedGame: LeagueGame = {
        id: `lg-${uuidv4()}`,
        league_id: leagueId,
        game_id: game.id,
        game_name: game.name,
        type: game.gameType === 'betting' ? 'Betting' : game.gameType === 'prediction' ? 'Prediction' : 'Fantasy',
        members_joined: 1,
        members_total: membersOfLeague.length,
        user_rank_in_league: 1, // Placeholder
        user_rank_global: game.totalPlayers + 1, // Placeholder
        total_players_global: game.totalPlayers + 1,
        linked_at: new Date().toISOString(),
        leaderboard_period: null,
      };
      newLeagueGames.push(newLinkedGame);
      linkedLeagueNames.push(league.name);
    });

    if (newLeagueGames.length > 0) {
      set({ leagueGames: [...leagueGames, ...newLeagueGames] });
    }
    
    return { linkedLeagueNames };
  },

  // Composite action to create a league and immediately link a game
  createLeagueAndLink: (name, description, gameToLink, profile) => {
    const { createLeague, linkGameToLeagues } = get();
    const newLeague = createLeague(name, description, profile);
    if (newLeague) {
      linkGameToLeagues(gameToLink, [newLeague.id]);
    }
  },

  // Action to unlink a game from a league
  unlinkGameFromLeague: (gameId, leagueId) => {
    set((state) => ({
      leagueGames: state.leagueGames.filter(
        (lg) => !(lg.game_id === gameId && lg.league_id === leagueId)
      ),
    }));
  },

  // Action to update the leaderboard period for a specific league-game link
  updateLeagueGameLeaderboardPeriod: (leagueGameId, period) => {
    set((state) => ({
      leagueGames: state.leagueGames.map(lg => 
        lg.id === leagueGameId ? { ...lg, leaderboard_period: period } : lg
      ),
    }));
  },
}));
