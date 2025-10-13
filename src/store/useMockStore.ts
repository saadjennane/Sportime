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
  LeaderboardSnapshot,
  LeagueFeedPost,
  LeaderboardEntry,
  SwipeLeaderboardEntry,
  FantasyLeaderboardEntry,
  PrivateLeagueGame,
  PrivateLeagueGameConfig,
  LiveGame,
  Match,
  BonusQuestion,
  LiveGamePlayerEntry,
} from '../types';
import { isToday } from 'date-fns';

// Import mock data
import { mockChallenges } from '../data/mockChallenges';
import { mockSwipeMatchDays } from '../data/mockSwipeGames';
import { mockFantasyGame } from '../data/mockFantasy.tsx';
import { mockUserLeagues } from '../data/mockUserLeagues';
import { mockLeagueMembers } from '../data/mockLeagueMembers';
import { mockLeagueGames } from '../data/mockLeagueGames';
import { mockScores } from '../data/mockLeaderboardScores';
import { mockLiveGames } from '../data/mockLiveGames';
import { mockFantasyPlayers } from '../data/mockFantasy.tsx';

interface MockDataState {
  challenges: BettingChallenge[];
  swipeMatchDays: SwipeMatchDay[];
  fantasyGames: FantasyGame[];
  userLeagues: UserLeague[];
  leagueMembers: LeagueMember[];
  leagueGames: LeagueGame[];
  leaderboardScores: typeof mockScores;
  leaderboardSnapshots: LeaderboardSnapshot[];
  leagueFeed: LeagueFeedPost[];
  privateLeagueGames: PrivateLeagueGame[];
  liveGames: LiveGame[];
}

interface MockDataActions {
  createLeague: (name: string, description: string, profile: Profile) => UserLeague;
  linkGameToLeagues: (game: Game, leagueIds: string[]) => { linkedLeagueNames: string[] };
  createLeagueAndLink: (name: string, description: string, gameToLink: Game, profile: Profile) => void;
  unlinkGameFromLeague: (gameId: string, leagueId: string) => void;
  updateLeagueGameLeaderboardPeriod: (leagueGameId: string, period: LeaderboardPeriod) => void;
  celebrateWinners: (
    leagueId: string, 
    game: Game, 
    leaderboard: (LeaderboardEntry | SwipeLeaderboardEntry | FantasyLeaderboardEntry)[], 
    period: LeaderboardPeriod, 
    message: string, 
    adminId: string
  ) => { success: boolean, error?: string };
  toggleFeedPostLike: (postId: string, userId: string) => void;
  createPrivateLeagueGame: (leagueId: string, config: PrivateLeagueGameConfig) => void;
  // Live Game Actions
  createLiveGame: (leagueId: string, match: Match) => void;
  submitLiveGamePrediction: (gameId: string, userId: string, prediction: Omit<LiveGamePlayerEntry, 'user_id' | 'submitted_at'>) => void;
  editLiveGamePrediction: (gameId: string, userId: string, newScore: { home: number; away: number }) => void;
}

const generateBonusQuestions = (predictedScore: { home: number, away: number }): BonusQuestion[] => {
    const totalGoals = predictedScore.home + predictedScore.away;
    const isDraw = predictedScore.home === predictedScore.away;

    if (isDraw && totalGoals === 0) { // 0-0
        return [
            { id: 'q1', question: 'Team with highest possession?', options: ['Team A', 'Team B'], answer: 'Team A' },
            { id: 'q2', question: 'Team with most shots on target?', options: ['Team A', 'Team B'], answer: 'Team B' },
            { id: 'q3', question: 'Over/Under 5 yellow cards?', options: ['Over', 'Under'], answer: 'Under' },
            { id: 'q4', question: 'Man of the Match?', options: mockFantasyPlayers.slice(0, 5).map(p => p.name), answer: 'L. Messi' },
        ];
    } else if (totalGoals < 3) { // Tight win
        return [
            { id: 'q1', question: 'Which team scores first?', options: ['Team A', 'Team B', 'No Goal'], answer: 'Team A' },
            { id: 'q2', question: 'Period of first goal?', options: ['1-30', '31-60', '61-90'], answer: '31-60' },
            { id: 'q3', question: 'First goal scorer?', options: mockFantasyPlayers.slice(0, 5).map(p => p.name), answer: 'K. De Bruyne' },
            { id: 'q4', question: 'Team with highest possession?', options: ['Team A', 'Team B'], answer: 'Team A' },
        ];
    } else { // High-scoring
        return [
            { id: 'q1', question: 'Which team opens the score?', options: ['Team A', 'Team B'], answer: 'Team B' },
            { id: 'q2', question: 'Minute of first goal?', options: ['1-15', '16-45', '46-75', '76-90'], answer: '16-45' },
            { id: 'q3', question: 'First goal scorer?', options: mockFantasyPlayers.slice(0, 5).map(p => p.name), answer: 'E. Haaland' },
            { id: 'q4', question: 'Team with most shots on target?', options: ['Team A', 'Team B'], answer: 'Team B' },
        ];
    }
};

export const useMockStore = create<MockDataState & MockDataActions>((set, get) => ({
  // Initial State from mock files
  challenges: mockChallenges,
  swipeMatchDays: mockSwipeMatchDays,
  fantasyGames: [mockFantasyGame],
  userLeagues: mockUserLeagues,
  leagueMembers: mockLeagueMembers,
  leagueGames: mockLeagueGames,
  leaderboardScores: mockScores,
  leaderboardSnapshots: [],
  leagueFeed: [],
  privateLeagueGames: [],
  liveGames: mockLiveGames,

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

  // Action to create a celebration snapshot and feed post
  celebrateWinners: (leagueId, game, leaderboard, period, message, adminId) => {
    const { leagueFeed, leaderboardSnapshots } = get();

    // Optional: Prevent more than one celebration per day per league
    const hasCelebratedToday = leagueFeed.some(
      post => post.league_id === leagueId && post.type === 'celebration' && isToday(new Date(post.created_at))
    );
    if (hasCelebratedToday) {
      return { success: false, error: 'You can only celebrate once per day for this league.' };
    }

    const snapshotId = uuidv4();
    const newSnapshot: LeaderboardSnapshot = {
      id: snapshotId,
      league_id: leagueId,
      game_id: game.id,
      game_name: game.name,
      game_type: game.gameType,
      created_at: new Date().toISOString(),
      created_by: adminId,
      data: leaderboard,
      message,
      start_date: period.start_date,
      end_date: period.end_date,
    };

    const topPlayers = leaderboard.slice(0, 3).map(p => ({
      name: p.username,
      score: 'points' in p ? p.points : p.totalPoints,
    }));

    const newFeedPost: LeagueFeedPost = {
      id: uuidv4(),
      league_id: leagueId,
      type: 'celebration',
      author_id: adminId,
      created_at: new Date().toISOString(),
      message,
      metadata: {
        snapshot_id: snapshotId,
        top_players: topPlayers,
      },
      likes: [],
    };

    set({
      leaderboardSnapshots: [...leaderboardSnapshots, newSnapshot],
      leagueFeed: [newFeedPost, ...leagueFeed], // Add to the top of the feed
    });

    return { success: true };
  },

  // Action to toggle a like on a feed post
  toggleFeedPostLike: (postId, userId) => {
    set(state => ({
      leagueFeed: state.leagueFeed.map(post => {
        if (post.id === postId) {
          const newLikes = new Set(post.likes);
          if (newLikes.has(userId)) {
            newLikes.delete(userId);
          } else {
            newLikes.add(userId);
          }
          return { ...post, likes: Array.from(newLikes) };
        }
        return post;
      }),
    }));
  },

  // Action to create a new private league game
  createPrivateLeagueGame: (leagueId, config) => {
    const { privateLeagueGames, leagueGames } = get();
    
    // 1. Create the detailed configuration object
    const newPrivateGame: PrivateLeagueGame = {
      id: uuidv4(),
      league_id: leagueId,
      config: config,
      created_at: new Date().toISOString(),
    };

    // 2. Create the summary/display object for the UI
    const newLeagueGame: LeagueGame = {
      id: `lg-${uuidv4()}`,
      league_id: leagueId,
      game_id: newPrivateGame.id, // Link to the private game config
      game_name: `Private: ${config.format_type.replace('_', ' + ').replace(/\b\w/g, l => l.toUpperCase())}`,
      type: 'Private',
      members_joined: 1, // The creator
      members_total: config.player_count,
      user_rank_in_league: 1, // Placeholder
      user_rank_global: 0, // Not applicable
      total_players_global: config.player_count,
      linked_at: new Date().toISOString(),
      leaderboard_period: null,
    };

    set({
      privateLeagueGames: [...privateLeagueGames, newPrivateGame],
      leagueGames: [...leagueGames, newLeagueGame],
    });
  },

  // --- Live Game Actions ---
  createLiveGame: (leagueId, match) => {
    const { liveGames } = get();
    const newLiveGame: LiveGame = {
      id: `live-${uuidv4()}`,
      league_id: leagueId,
      match_id: match.id,
      match_details: match,
      created_by: 'user-1', // Assuming current user is admin
      status: 'Upcoming',
      bonus_questions: [], // Generated on first prediction
      players: [],
    };
    set({ liveGames: [...liveGames, newLiveGame] });
  },

  submitLiveGamePrediction: (gameId, userId, prediction) => {
    set(state => ({
      liveGames: state.liveGames.map(game => {
        if (game.id === gameId) {
          const playerEntry: LiveGamePlayerEntry = {
            ...prediction,
            user_id: userId,
            submitted_at: new Date().toISOString(),
          };
          // Generate bonus questions based on the first player's prediction
          const bonus_questions = game.bonus_questions.length > 0 ? game.bonus_questions : generateBonusQuestions(prediction.predicted_score);
          return { ...game, players: [...game.players, playerEntry], bonus_questions };
        }
        return game;
      }),
    }));
  },

  editLiveGamePrediction: (gameId, userId, newScore) => {
    set(state => ({
      liveGames: state.liveGames.map(game => {
        if (game.id === gameId) {
          return {
            ...game,
            players: game.players.map(p =>
              p.user_id === userId
                ? { ...p, predicted_score: newScore, midtime_edit: true }
                : p
            ),
          };
        }
        return game;
      }),
    }));
  },
}));
