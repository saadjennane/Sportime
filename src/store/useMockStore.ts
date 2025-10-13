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
  LiveBet,
  LiveGameMarket,
  UserFantasyTeam,
  PredictionChallenge,
  FantasyLiveBooster,
} from '../types';
import { isToday, addMinutes } from 'date-fns';

// Import mock data
import { mockChallenges } from '../data/mockChallenges';
import { mockSwipeMatchDays } from '../data/mockSwipeGames';
import { mockFantasyGame, mockUserFantasyTeams } from '../data/mockFantasy.tsx';
import { mockUserLeagues } from '../data/mockUserLeagues';
import { mockLeagueMembers } from '../data/mockLeagueMembers';
import { mockLeagueGames } from '../data/mockLeagueGames';
import { mockScores } from '../data/mockLeaderboardScores';
import { mockLiveGames } from '../data/mockLiveGames';
import { mockFantasyPlayers } from '../data/mockFantasy.tsx';
import { mockPreMatchMarkets } from '../data/mockLiveGameMarkets';
import { marketTemplates } from '../data/marketTemplates';
import { mockUsers } from '../data/mockUsers';
import { mockFantasyLiveBoosters } from '../data/mockFantasyLive.tsx';

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
  predictionChallenges: PredictionChallenge[];
  userFantasyTeams: UserFantasyTeam[];
  allUsers: Profile[];
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
  createLiveGame: (leagueId: string, match: Match, mode: 'prediction' | 'betting' | 'fantasy-live') => void;
  submitLiveGamePrediction: (gameId: string, userId: string, prediction: Omit<LiveGamePlayerEntry, 'user_id' | 'submitted_at'>) => void;
  editLiveGamePrediction: (gameId: string, userId: string, newScore: { home: number; away: number }) => void;
  placeLiveBet: (gameId: string, userId: string, marketId: string, option: string, amount: number, odds: number) => void;
  tickLiveGame: (gameId: string) => void;
  // Fantasy Actions
  updateUserFantasyTeam: (team: UserFantasyTeam) => void;
}

export const generateBonusQuestions = (predictedScore: { home: number, away: number }): BonusQuestion[] => {
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
  predictionChallenges: [{
    id: 'pred-challenge-1',
    title: 'Match Day Challenge – Season (mock)',
    season: '2025/26',
    matchDayIds: ['swipe-1', 'swipe-2'],
    createdAt: new Date().toISOString(),
  }],
  userFantasyTeams: mockUserFantasyTeams,
  allUsers: mockUsers,

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
  createLiveGame: (leagueId, match, mode) => {
    const { liveGames } = get();
    let newLiveGame: LiveGame;

    if (mode === 'betting') {
      newLiveGame = {
        id: `live-${uuidv4()}`,
        league_id: leagueId,
        match_id: match.id,
        match_details: match,
        created_by: 'user-1',
        status: 'Upcoming',
        mode: 'betting',
        markets: mockPreMatchMarkets,
        simulated_minute: 0,
        bonus_questions: [],
        players: [],
      };
    } else if (mode === 'fantasy-live') {
      newLiveGame = {
        id: `live-${uuidv4()}`,
        league_id: leagueId,
        match_id: match.id,
        match_details: match,
        created_by: 'user-1',
        status: 'Upcoming',
        mode: 'fantasy-live',
        bonus_questions: [],
        markets: [],
        simulated_minute: 0,
        players: [],
        boosters: mockFantasyLiveBoosters,
      };
    } else { // prediction mode
      newLiveGame = {
        id: `live-${uuidv4()}`,
        league_id: leagueId,
        match_id: match.id,
        match_details: match,
        created_by: 'user-1',
        status: 'Upcoming',
        mode: 'prediction',
        bonus_questions: [],
        markets: [],
        simulated_minute: 0,
        players: [],
      };
    }
    
    set({ liveGames: [newLiveGame, ...liveGames] });
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
          const bonus_questions = game.bonus_questions.length > 0 ? game.bonus_questions : generateBonusQuestions(prediction.predicted_score!);
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
  
  placeLiveBet: (gameId, userId, marketId, option, amount, odds) => {
    set(state => ({
      liveGames: state.liveGames.map(game => {
        if (game.id !== gameId) return game;

        let playerExists = false;
        const updatedPlayers = game.players.map(p => {
          if (p.user_id !== userId) return p;
          
          playerExists = true;
          const newBet: LiveBet = { market_id: marketId, option, amount, odds, phase: game.status === 'Upcoming' ? 'pre-match' : 'live', status: 'pending', gain: 0 };
          
          const currentBettingState = p.betting_state || {
            pre_match_balance: 1000,
            live_balance: 1000,
            bets: [],
            total_gain: 0,
          };

          const newBalance = (game.status === 'Upcoming' ? currentBettingState.pre_match_balance : currentBettingState.live_balance) - amount;

          return {
            ...p,
            betting_state: {
              ...currentBettingState,
              pre_match_balance: game.status === 'Upcoming' ? newBalance : currentBettingState.pre_match_balance,
              live_balance: game.status !== 'Upcoming' ? newBalance : currentBettingState.live_balance,
              bets: [...currentBettingState.bets, newBet],
            },
          };
        });
        
        if (!playerExists) {
          const newBet: LiveBet = { market_id: marketId, option, amount, odds, phase: game.status === 'Upcoming' ? 'pre-match' : 'live', status: 'pending', gain: 0 };
          const newPlayerEntry: LiveGamePlayerEntry = {
            user_id: userId,
            submitted_at: new Date().toISOString(),
            betting_state: {
              pre_match_balance: game.status === 'Upcoming' ? 1000 - amount : 1000,
              live_balance: game.status !== 'Upcoming' ? 1000 - amount : 1000,
              bets: [newBet],
              total_gain: 0,
            }
          };
          updatedPlayers.push(newPlayerEntry);
        }

        return { ...game, players: updatedPlayers };
      }),
    }));
  },

  tickLiveGame: (gameId) => {
    set(state => ({
      liveGames: state.liveGames.map(game => {
        if (game.id !== gameId || game.status !== 'Ongoing') return game;

        const newMinute = game.simulated_minute + 5;
        let newScore = game.match_details.score || { teamA: 0, teamB: 0 };
        let lastKnownState = game.last_known_state || { minute: 0, score: { home: 0, away: 0 } };
        let newMarkets = [...game.markets];
        let updatedPlayers = [...game.players];

        // --- Event Simulation ---
        const events = [
          { minute: 25, score: { teamA: 1, teamB: 0 }, trigger: 'goal_event' },
          { minute: 60, score: { teamA: 1, teamB: 1 }, trigger: 'equalizer_event' },
          { minute: 88, score: { teamA: 2, teamB: 1 }, trigger: 'goal_event' },
        ];
        
        const event = events.find(e => newMinute >= e.minute && lastKnownState.minute < e.minute);
        if (event) {
            newScore = event.score;
        }

        // --- Market Resolution ---
        const marketsToResolve = newMarkets.filter(m => m.status === 'open' && new Date(m.expires_at) < new Date());
        const winningOptions: Record<string, string> = {
            'pre-mkt-1': 'E. Haaland',
            'pre-mkt-2': 'Draw',
            'live-mkt-1': event && event.trigger === 'goal_event' ? 'Yes' : 'No',
        };

        if (marketsToResolve.length > 0) {
            updatedPlayers = updatedPlayers.map(player => {
                let newBettingState = player.betting_state ? { ...player.betting_state } : undefined;
                if (newBettingState) {
                    marketsToResolve.forEach(market => {
                        const winningOption = winningOptions[market.id];
                        if (winningOption) {
                            const betIndex = newBettingState.bets.findIndex(b => b.market_id === market.id && b.status === 'pending');
                            if (betIndex > -1) {
                                const bet = newBettingState.bets[betIndex];
                                if (bet.option === winningOption) {
                                    const gain = Math.round(bet.amount * bet.odds);
                                    newBettingState.total_gain += gain;
                                    newBettingState.last_gain_time = new Date().toISOString();
                                    newBettingState.bets[betIndex] = { ...bet, status: 'won', gain };
                                } else {
                                    newBettingState.bets[betIndex] = { ...bet, status: 'lost', gain: 0 };
                                }
                            }
                        }
                    });
                }
                return { ...player, betting_state: newBettingState };
            });
            newMarkets = newMarkets.map(m => marketsToResolve.find(mr => mr.id === m.id) ? { ...m, status: 'resolved', winning_option: winningOptions[m.id] } : m);
        }
        
        // --- New Market Generation ---
        const hasActiveMarket = newMarkets.some(m => m.status === 'open');
        if (!hasActiveMarket) {
            const getEmotionFactor = () => (newMinute > 70 ? 1.3 : 1.0);
            const trigger = event?.trigger || (newMinute > 70 ? 'tension_builds' : null);
            const template = trigger ? marketTemplates[trigger] : null;
            if (template) {
                const newMarket: LiveGameMarket = {
                    id: `live-mkt-${newMinute}`,
                    minute: newMinute,
                    type: trigger!,
                    title: template.title,
                    emotion_factor: getEmotionFactor(),
                    odds: template.options.map(opt => ({ option: opt, adjusted: (Math.random() * 2 + 1.5) * getEmotionFactor() })),
                    expires_at: addMinutes(new Date(), 2).toISOString(),
                    status: 'open',
                };
                newMarkets.push(newMarket);
            }
        }

        return { 
          ...game, 
          simulated_minute: newMinute,
          match_details: { ...game.match_details, score: newScore },
          last_known_state: { minute: newMinute, score: { home: newScore.teamA, away: newScore.teamB } },
          markets: newMarkets,
          players: updatedPlayers,
        };
      }),
    }));
  },

  // --- Fantasy Actions ---
  updateUserFantasyTeam: (team) => {
    set(state => ({
      userFantasyTeams: state.userFantasyTeams.map(t => 
        t.gameWeekId === team.gameWeekId && t.userId === team.userId ? team : t
      ),
    }));
  },
}));
