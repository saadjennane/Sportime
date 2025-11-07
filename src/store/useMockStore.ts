import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { grantPremiumBonus } from '../services/coinService';
import {
  SportimeGame,
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
  UserTicket,
  UserStreak,
  TournamentType,
  ChallengeStatus,
  GameRewardTier,
  CelebrationEvent,
  RewardItem,
  UserChallengeEntry,
  UserSwipeEntry,
  ActiveSession,
  Notification,
  PlayerGraph,
  FunZoneState,
  FreeSpinReward,
} from '../types';
import { isToday, addDays, isBefore, parseISO, differenceInHours, differenceInDays } from 'date-fns';
import { DAILY_STREAK_REWARDS, STREAK_RESET_THRESHOLD_HOURS, TICKET_RULES } from '../config/constants';
import { processGameWeek } from '../services/fantasyService';

// Import mock data
import { mockGames } from '../data/mockGames';
import { mockUserLeagues } from '../data/mockUserLeagues';
import { mockLeagueMembers } from '../data/mockLeagueMembers';
import { mockLeagueGames } from '../data/mockLeagueGames';
import { mockScores } from '../data/mockLeaderboardScores';
import { mockLiveGames } from '../data/mockLiveGames';
import { mockFantasyPlayers, mockUserFantasyTeams } from '../data/mockFantasy.tsx';
import { mockPreMatchMarkets } from '../data/mockLiveGameMarkets';
import { marketTemplates } from '../data/marketTemplates';
import { mockUsers } from '../data/mockUsers';
import { mockFantasyLiveBoosters } from '../data/mockFantasyLive.tsx';
import { mockUserTickets } from '../data/mockTickets';
import { mockLevelsConfig, mockBadges } from '../data/mockProgression';
import { mockUserChallengeEntries } from '../data/mockUserChallengeEntries';
import { mockUserSwipeEntries } from '../data/mockUserSwipeEntries';
import { mockPlayerGameWeekStats } from '../data/mockPlayerStats';
import { BASE_REWARD_PACKS } from '../config/rewardPacks';
import { mockChallengeMatches } from '../data/mockChallenges';
import { mockNotifications } from '../data/mockNotifications';
import { mockPlayerGraph } from '../data/mockPlayerGraph';
import { FREE_SPIN_REWARDS } from '../data/mockFunZone';
import { COIN_PACKS } from '../config/coinPacks';
import { useSpinStore } from './useSpinStore';

interface MockDataState {
  games: SportimeGame[];
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
  userChallengeEntries: UserChallengeEntry[];
  userSwipeEntries: UserSwipeEntry[];
  allUsers: Profile[];
  userTickets: UserTicket[];
  userStreaks: UserStreak[];
  levels: typeof mockLevelsConfig;
  badges: typeof mockBadges;
  rewardPacks: typeof BASE_REWARD_PACKS;
  celebrations: CelebrationEvent[];
  activeSessions: ActiveSession[];
  notifications: Notification[];
  playerGraph: PlayerGraph;
  funzone: FunZoneState;
  isTestMode: boolean;
  showOnboardingTest: boolean;
  currentUserId: string | null;
}

interface MockDataActions {
  createGame: (config: Omit<SportimeGame, 'id' | 'status' | 'totalPlayers' | 'participants'>) => void;
  updateGame: (gameId: string, updates: Partial<SportimeGame>) => void;
  updateGameRewards: (gameId: string, rewards: GameRewardTier[]) => void;
  deleteGame: (gameId: string) => void;
  cancelGame: (gameId: string) => void;
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
  celebrateSeasonalWinners: (gameId: string, period: { start: string; end: string }, topN: number, reward: RewardItem, message: string) => void;
  toggleFeedPostLike: (postId: string, userId: string) => void;
  createPrivateLeagueGame: (leagueId: string, config: PrivateLeagueGameConfig) => { success: boolean, error?: string };
  distributePrizes: (args: { tournamentId: string; players: { id: string; rank: number; }[]; prizePool: number; rewardTier: "Rookie" | "Pro" | "Elite"; participationBonus: number; }) => void;
  createLiveGame: (leagueId: string, match: Match, mode: 'prediction' | 'betting' | 'fantasy-live') => void;
  submitLiveGamePrediction: (gameId: string, userId: string, prediction: Omit<LiveGamePlayerEntry, 'user_id' | 'submitted_at'>) => void;
  editLiveGamePrediction: (gameId: string, userId: string, newScore: { home: number; away: number }) => void;
  placeLiveBet: (gameId: string, userId: string, marketId: string, option: string, amount: number, odds: number) => void;
  tickLiveGame: (gameId: string) => void;
  tickFantasyGame: (gameWeekId: string, userId: string) => void;
  updateUserFantasyTeam: (team: UserFantasyTeam) => void;
  joinChallenge: (challengeId: string, userId: string, method: 'coins' | 'ticket') => { success: boolean; message: string; method?: 'ticket' | 'coins' | 'none' };
  joinSwipeGame: (gameId: string, userId: string) => { success: boolean; message: string };
  checkDailyStreak: (userId: string) => { isAvailable: boolean; streakDay: number };
  claimDailyStreak: (userId: string) => { reward: { coins?: number; ticket?: TournamentType }; streakDay: number };
  processChallengeStart: (challengeId: string) => { success: boolean, message: string };
  addTicket: (userId: string, type: TournamentType) => void;
  addXp: (userId: string, amount: number) => void;
  grantPremium: (userId: string, days: number) => void;
  setCoinBalance: (userId: string, newBalance: number) => void;
  setTestMode: (enabled: boolean) => void;
  resetTestUsers: () => void;
  openOnboardingTest: () => void;
  closeOnboardingTest: () => void;
  updateBasePack: (tier: TournamentType, format: string, updatedPack: GameRewardTier[]) => void;
  setCurrentUserId: (userId: string | null) => void;
  updateUser: (userId: string, updates: Partial<Profile>) => void;
  ensureUserExists: (user: Profile) => void;
  checkUsernameAvailability: (username: string, currentUserId?: string) => Promise<boolean>;
  joinLeague: (inviteCode: string, userId: string, callback: (league: UserLeague | null) => void) => void;
  handleSwipePrediction: (matchDayId: string, userId: string, matchId: string, prediction: any) => void;
  updateSwipePrediction: (matchDayId: string, userId: string, matchId: string, prediction: any) => void;
  createLiveSession: (matchId: string, gameTypeId: string, leagueId?: string) => ActiveSession;
  joinLiveSession: (pin: string) => ActiveSession | null;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'isRead'>) => void;
  markNotificationAsRead: (notificationId: string) => void;
  markAllNotificationsAsRead: () => void;
  incrementInteraction: (user1Id: string, user2Id: string) => void;
  performFreeSpin: (userId: string) => FreeSpinReward | null;
  purchaseCoinPack: (packId: string, userId: string) => void;
  subscribeToPremium: (userId: string, plan: 'monthly' | 'seasonal') => void;
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

export const sendGiftCardMock = (userId: string, amount: number) => {
  console.log(
    `%c[Mock Email] Sent €${amount.toFixed(2)} Gift Card to user ${userId} 🎁`,
    "color: #90EE90; font-weight: bold;"
  );
};

export const useMockStore = create<MockDataState & MockDataActions>((set, get) => ({
  // ... initial state
  games: mockGames,
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
  userChallengeEntries: mockUserChallengeEntries,
  userSwipeEntries: mockUserSwipeEntries,
  allUsers: mockUsers,
  userTickets: mockUserTickets,
  userStreaks: [{ user_id: 'user-1', current_day: 3, last_claimed_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), total_cycles_completed: 0 }],
  levels: mockLevelsConfig,
  badges: mockBadges,
  rewardPacks: BASE_REWARD_PACKS,
  celebrations: [],
  activeSessions: [],
  notifications: mockNotifications,
  playerGraph: mockPlayerGraph,
  funzone: {
    userProgress: 42,
    dailySpinLastUsed: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
    availableGames: [
      { id: "guess-player", name: "Guess the Player", description: "Can you identify the player from his career path?", isPlayable: false, logic: { rules: '', winCondition: ''} },
      { id: "guess-score", name: "Guess the Score", description: "Predict the final score in 10 seconds!", isPlayable: false, logic: { rules: '', winCondition: ''} },
      { id: "tic-tac-foot", name: "Tic-Tac-Foot", description: "A football twist on the classic Tic-Tac-Toe.", isPlayable: false, logic: { rules: '', winCondition: ''} }
    ]
  },
  isTestMode: false,
  showOnboardingTest: false,
  currentUserId: null,

  // --- ACTIONS ---

  distributePrizes: ({ tournamentId, players = [], prizePool = 0, rewardTier = "Rookie", participationBonus = 0 }) => {
    const { users } = get();
    const { addSpins } = useSpinStore.getState();
  
    if (!players?.length) {
      console.warn(`[Sportime] No players found for tournament ${tournamentId}`);
      return;
    }
  
    const validTiers = ["Amateur", "Master", "Apex"];
    const tier = validTiers.includes(rewardTier) ? rewardTier : "Amateur";

    const tierRewards = {
      Amateur: { ticket: "amateur" as TournamentType, spin: "amateur" as SpinTier },
      Master: { ticket: "master" as TournamentType, spin: "master" as SpinTier },
      Apex: { ticket: "apex" as TournamentType, spin: "apex" as SpinTier },
    };
  
    const firstPrize = parseFloat((prizePool * 0.55).toFixed(2));
    const secondPrize = parseFloat((prizePool * 0.3).toFixed(2));
    const thirdPrize = parseFloat((prizePool * 0.15).toFixed(2));
  
    const newUsers = users.map((u) => {
      const participant = players.find((p) => p.id === u.id);
      if (!participant) return u;
  
      const updated = { ...u };
      updated.coins_balance = (updated.coins_balance || 0) + participationBonus;
  
      updated.tickets = updated.tickets || [];
      updated.spins = updated.spins || [];
      updated.giftCards = updated.giftCards || [];
  
      switch (participant.rank) {
        case 1:
          get().addTicket(u.id, tierRewards[tier].ticket);
          addSpins(u.id, tierRewards[tier].spin, 1);
          updated.giftCards.push({ amount: firstPrize.toFixed(2), provider: "Amazon", status: "Mock" });
          sendGiftCardMock(u.id, firstPrize);
          break;
  
        case 2:
          get().addTicket(u.id, tierRewards[tier].ticket);
          addSpins(u.id, tierRewards[tier].spin, 1);
          updated.giftCards.push({ amount: secondPrize.toFixed(2), provider: "Amazon", status: "Mock" });
          sendGiftCardMock(u.id, secondPrize);
          break;
  
        case 3:
          addSpins(u.id, tierRewards[tier].spin, 1);
          updated.giftCards.push({ amount: thirdPrize.toFixed(2), provider: "Amazon", status: "Mock" });
          sendGiftCardMock(u.id, thirdPrize);
          break;
  
        default:
          break;
      }
      return updated;
    });
  
    set({ allUsers: newUsers });
  
    console.log(
      `%c[Sportime] Rewards distributed for tournament ${tournamentId}`,
      "color: #FFD700; font-weight: bold;"
    );
  },

  createPrivateLeagueGame: (leagueId, config) => {
    const { privateLeagueGames, leagueGames, allUsers, currentUserId } = get();
    const admin = allUsers.find(u => u.id === currentUserId);

    if (!admin) {
      return { success: false, error: 'Admin user not found.' };
    }

    if (config.isPaid) {
      if ((admin.activePaidTournaments || 0) >= 2) {
        return { success: false, error: 'active_limit' };
      }
      if ((admin.paidTournamentsCreatedThisMonth || 0) >= 5) {
        return { success: false, error: 'monthly_limit' };
      }
    }
    
    const newPrivateGame: PrivateLeagueGame = {
      id: uuidv4(),
      league_id: leagueId,
      config: config,
      created_at: new Date().toISOString(),
    };

    const newLeagueGame: LeagueGame = {
      id: `lg-${uuidv4()}`,
      league_id: leagueId,
      game_id: newPrivateGame.id,
      game_name: `Private: ${config.format_type.replace('_', ' + ').replace(/\b\w/g, l => l.toUpperCase())}`,
      type: 'Private',
      members_joined: 1,
      members_total: config.player_count,
      user_rank_in_league: 1,
      user_rank_global: 0,
      total_players_global: config.player_count,
      linked_at: new Date().toISOString(),
      leaderboard_period: null,
    };

    const updatedAdmin: Partial<Profile> = {};
    if (config.isPaid) {
      updatedAdmin.activePaidTournaments = (admin.activePaidTournaments || 0) + 1;
      updatedAdmin.paidTournamentsCreatedThisMonth = (admin.paidTournamentsCreatedThisMonth || 0) + 1;
    }

    set({
      privateLeagueGames: [...privateLeagueGames, newPrivateGame],
      leagueGames: [...leagueGames, newLeagueGame],
      allUsers: allUsers.map(u => u.id === admin.id ? { ...u, ...updatedAdmin } : u)
    });

    return { success: true };
  },

  // ... other actions
  subscribeToPremium: async (userId, plan) => {
    const { allUsers } = get();
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;

    const days = plan === 'monthly' ? 30 : 180;
    const now = new Date();
    const currentExpiry = user.subscription_expires_at ? new Date(user.subscription_expires_at) : now;
    const newExpiry = addDays(isBefore(currentExpiry, now) ? now : currentExpiry, days);

    const wasAlreadyPremium = user.is_subscriber;

    const updatedUser: Partial<Profile> = {
      is_subscriber: true,
      subscription_expires_at: newExpiry.toISOString(),
    };

    // Add welcome bonus only on first subscription via Supabase
    if (!wasAlreadyPremium) {
      try {
        await grantPremiumBonus(userId);
      } catch (error) {
        console.error('[subscribeToPremium] Failed to grant bonus:', error);
      }
    }

    set(state => ({
      allUsers: state.allUsers.map(u => u.id === userId ? { ...u, ...updatedUser } : u)
    }));
  },

  purchaseCoinPack: (packId, userId) => {
    const pack = COIN_PACKS.find(p => p.id === packId);
    if (!pack) return;

    set(state => ({
      allUsers: state.allUsers.map(u => {
        if (u.id === userId) {
          return {
            ...u,
            coins_balance: u.coins_balance + pack.coins,
            total_spent_eur: (u.total_spent_eur || 0) + pack.priceEUR,
            purchases_count: (u.purchases_count || 0) + 1,
          };
        }
        return u;
      })
    }));
  },

  performFreeSpin: (userId) => {
    const { funzone, setCoinBalance, addXp } = get();
    if (funzone.dailySpinLastUsed && differenceInHours(new Date(), new Date(funzone.dailySpinLastUsed)) < 24) {
      return null; // Already spun today
    }

    let random = Math.random();
    let selectedReward: FreeSpinReward | null = null;
    for (const reward of FREE_SPIN_REWARDS) {
      if (random < reward.probability) {
        selectedReward = reward;
        break;
      }
      random -= reward.probability;
    }
    if (!selectedReward) selectedReward = FREE_SPIN_REWARDS[FREE_SPIN_REWARDS.length - 1];

    if (selectedReward.type === 'coins') {
      const user = get().allUsers.find(u => u.id === userId);
      if (user) setCoinBalance(userId, user.coins_balance + selectedReward.value);
    } else if (selectedReward.type === 'xp') {
      addXp(userId, selectedReward.value);
    }

    set(state => ({
      funzone: { ...state.funzone, dailySpinLastUsed: new Date().toISOString() }
    }));
    
    return selectedReward;
  },

  createLiveSession: (matchId, gameTypeId, leagueId) => {
    const { currentUserId } = get();
    const pin = Math.floor(10000 + Math.random() * 90000).toString();
    const now = Date.now();
    const newSession: ActiveSession = {
        id: uuidv4(),
        pin,
        matchId,
        gameTypeId,
        leagueId,
        createdAt: now,
        expiresAt: now + 5 * 60 * 1000, // 5 minutes expiry
        participants: currentUserId ? [currentUserId] : [],
    };
    set(state => ({ activeSessions: [...state.activeSessions, newSession] }));
    return newSession;
  },

  joinLiveSession: (pin) => {
    const { activeSessions, currentUserId, incrementInteraction } = get();
    if (!currentUserId) return null;
    
    const now = Date.now();
    let sessionToJoin: ActiveSession | null = null;
    let sessionIndex = -1;

    activeSessions.forEach((s, index) => {
      if (s.pin === pin && s.expiresAt > now) {
        sessionToJoin = s;
        sessionIndex = index;
      }
    });

    if (sessionToJoin && sessionIndex > -1) {
      if (!sessionToJoin.participants.includes(currentUserId)) {
        sessionToJoin.participants.forEach(existingParticipantId => {
          incrementInteraction(currentUserId, existingParticipantId);
        });
        const updatedSession = { ...sessionToJoin, participants: [...sessionToJoin.participants, currentUserId] };
        const updatedSessions = [...activeSessions];
        updatedSessions[sessionIndex] = updatedSession;
        set({ activeSessions: updatedSessions });
        return updatedSession;
      }
      return sessionToJoin;
    }
    return null;
  },

  setCurrentUserId: (userId) => set({ currentUserId: userId }),

  updateUser: (userId, updates) => {
    set(state => ({
      allUsers: state.allUsers.map(u => 
        u.id === userId ? { ...u, ...updates } : u
      )
    }));
  },
  
  checkUsernameAvailability: async (username, currentUserId) => {
    const { allUsers } = get();
    return allUsers.some(u => u.username.toLowerCase() === username.toLowerCase() && u.id !== currentUserId);
  },

  ensureUserExists: (user) => {
    set(state => {
      const userExists = state.allUsers.some(u => u.id === user.id);
      if (userExists) {
        return {
          allUsers: state.allUsers.map(u => u.id === user.id ? { ...u, ...user } : u)
        };
      }
      return { allUsers: [...state.allUsers, user] };
    });
  },
  
  updateBasePack: (tier, format, updatedPack) => {
    set(state => {
      const newRewardPacks = { ...state.rewardPacks };
      if (newRewardPacks[tier]) {
        newRewardPacks[tier][format] = updatedPack;
      }
      return { rewardPacks: newRewardPacks };
    });
  },

  openOnboardingTest: () => set({ showOnboardingTest: true }),
  closeOnboardingTest: () => set({ showOnboardingTest: false }),

  setTestMode: (enabled) => {
    set({ isTestMode: enabled });
    localStorage.setItem('sportime_test_mode', JSON.stringify(enabled));
  },

  resetTestUsers: () => {
    set({ 
      allUsers: [...mockUsers], 
      userStreaks: [{ user_id: 'user-1', current_day: 3, last_claimed_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), total_cycles_completed: 0 }],
      userTickets: [...mockUserTickets], 
      userChallengeEntries: [...mockUserChallengeEntries], 
      userSwipeEntries: [...mockUserSwipeEntries] 
    });
    console.log("Test users have been reset.");
  },

  checkDailyStreak: (userId) => {
    const userStreak = get().userStreaks.find(s => s.user_id === userId);
    const now = new Date();

    // Si aucun streak n'existe, c'est la première fois
    if (!userStreak) {
      return {
        isAvailable: true,
        streakDay: 1,
        isFirstTime: true
      };
    }

    // Définir le "jour streak" : de 8h00 aujourd'hui à 7h59 demain
    const currentStreakDay = new Date(now);
    if (now.getHours() < 8) {
      // Avant 8h, on est encore dans le "jour streak" d'hier
      currentStreakDay.setDate(currentStreakDay.getDate() - 1);
    }
    currentStreakDay.setHours(8, 0, 0, 0);

    const lastClaimed = parseISO(userStreak.last_claimed_at);
    const lastClaimedStreakDay = new Date(lastClaimed);
    if (lastClaimedStreakDay.getHours() < 8) {
      lastClaimedStreakDay.setDate(lastClaimedStreakDay.getDate() - 1);
    }
    lastClaimedStreakDay.setHours(8, 0, 0, 0);

    const daysDifference = differenceInDays(currentStreakDay, lastClaimedStreakDay);

    // Déjà claimé aujourd'hui
    if (daysDifference === 0) {
      return {
        isAvailable: false,
        streakDay: 0,
        isFirstTime: false
      };
    }

    // Peut claim aujourd'hui - streak continue
    if (daysDifference === 1) {
      const currentDay = userStreak.current_day || 0;
      const newDay = (currentDay % 7) + 1;
      return {
        isAvailable: true,
        streakDay: newDay,
        isFirstTime: false
      };
    }

    // Plus d'un jour d'inactivité - streak reset
    return {
      isAvailable: true,
      streakDay: 1,
      isFirstTime: false
    };
  },

  claimDailyStreak: (userId) => {
    const { userStreaks, allUsers, addTicket, setCoinBalance } = get();
    const userStreak = userStreaks.find(s => s.user_id === userId);
    const now = new Date();

    // Calculer le "jour streak" actuel (8h00-23h59)
    const currentStreakDay = new Date(now);
    if (now.getHours() < 8) {
      currentStreakDay.setDate(currentStreakDay.getDate() - 1);
    }
    currentStreakDay.setHours(8, 0, 0, 0);

    let newDay = 1;
    if (userStreak) {
      const lastClaimed = parseISO(userStreak.last_claimed_at);
      const lastClaimedStreakDay = new Date(lastClaimed);
      if (lastClaimedStreakDay.getHours() < 8) {
        lastClaimedStreakDay.setDate(lastClaimedStreakDay.getDate() - 1);
      }
      lastClaimedStreakDay.setHours(8, 0, 0, 0);

      const daysDifference = differenceInDays(currentStreakDay, lastClaimedStreakDay);

      if (daysDifference === 1) {
        // Streak continue
        const currentDay = userStreak.current_day || 0;
        newDay = (currentDay % 7) + 1;
      }
      // sinon daysDifference > 1 → reset à Day 1 (déjà initialisé)
    }

    const reward = DAILY_STREAK_REWARDS[newDay as keyof typeof DAILY_STREAK_REWARDS];

    if (reward.coins) {
        const user = allUsers.find(u => u.id === userId);
        if (user) setCoinBalance(userId, user.coins_balance + reward.coins);
    }
    if (reward.ticket) {
        addTicket(userId, reward.ticket as TournamentType);
    }

    const updatedStreak: UserStreak = {
        user_id: userId,
        current_day: newDay,
        last_claimed_at: now.toISOString(),
        total_cycles_completed: newDay === 7 ? (userStreak?.total_cycles_completed || 0) + 1 : (userStreak?.total_cycles_completed || 0)
    };

    set({
        userStreaks: userStreaks.some(s => s.user_id === userId)
            ? userStreaks.map(s => s.user_id === userId ? updatedStreak : s)
            : [...userStreaks, updatedStreak],
    });

    return { reward, streakDay: newDay };
  },

  // ... other actions
  createGame: (config) => {
    const { rewardPacks } = get();
    const durationKey = config.duration_type ?? 'flash';
    const baseRewards = rewardPacks[config.tier]?.[durationKey] || [];

    const newGame: SportimeGame = {
      ...config,
      id: `game-${uuidv4()}`,
      status: 'Upcoming',
      totalPlayers: 0,
      participants: [],
      rewards: JSON.parse(JSON.stringify(baseRewards)), // Deep copy
    };
    set(state => ({ games: [newGame, ...state.games] }));
  },

  updateGame: (gameId, updates) => {
    set(state => ({
      games: state.games.map(g => g.id === gameId ? { ...g, ...updates } : g)
    }));
  },
  
  updateGameRewards: (gameId, rewards) => {
    set(state => ({
      games: state.games.map(g => g.id === gameId ? { ...g, rewards } : g)
    }));
  },

  deleteGame: (gameId) => {
    set(state => ({
      games: state.games.filter(g => g.id !== gameId)
    }));
  },

  cancelGame: (gameId) => {
    set(state => ({
      games: state.games.map(g => g.id === gameId ? { ...g, status: 'Cancelled' as ChallengeStatus } : g)
    }));
  },

  joinChallenge: (challengeId, userId, method) => {
    const { games, userTickets, allUsers, userChallengeEntries } = get();
    const challenge = games.find(c => c.id === challengeId);
    const user = allUsers.find(u => u.id === userId);

    if (!challenge || !user) {
      return { success: false, message: 'Challenge or user not found.' };
    }

    // Access Validation
    if (challenge.requires_subscription && !user.is_subscriber) {
      return { success: false, message: "This challenge is only available to subscribers." };
    }
    const userLevelIndex = mockLevelsConfig.findIndex(l => l.level_name === user.level);
    const requiredLevelIndex = mockLevelsConfig.findIndex(l => l.level_name === challenge.minimum_level);
    if (challenge.minimum_level && userLevelIndex < requiredLevelIndex) {
      return { success: false, message: `Your level is too low. Requires level ${challenge.minimum_level}.` };
    }
    if (challenge.required_badges && challenge.required_badges.length > 0) {
      const hasAllBadges = challenge.required_badges.every(b => user.badges?.includes(b));
      if (!hasAllBadges) {
        return { success: false, message: "You don't have the required badge(s) to join." };
      }
    }

    // Player Limit Validation
    if (challenge.maximum_players > 0 && challenge.participants.length >= challenge.maximum_players) {
      return { success: false, message: "This challenge is full." };
    }

    let ticketId: string | undefined = undefined;

    if (method === 'ticket') {
      const validTicketIndex = userTickets.findIndex(ticket => 
        ticket.user_id === userId &&
        ticket.type === challenge.tier &&
        !ticket.is_used &&
        isBefore(new Date(), parseISO(ticket.expires_at))
      );

      if (validTicketIndex > -1) {
        const newTickets = [...userTickets];
        ticketId = newTickets[validTicketIndex].id;
        newTickets[validTicketIndex] = { ...newTickets[validTicketIndex], is_used: true, used_at: new Date().toISOString() };
        set({ userTickets: newTickets });
      } else {
        return { success: false, message: "No valid ticket found." };
      }
    } else if (method === 'coins') {
      if (user.coins_balance >= challenge.entry_cost) {
        const newBalance = user.coins_balance - challenge.entry_cost;
        const updatedUsers = allUsers.map(u => u.id === userId ? { ...u, coins_balance: newBalance } : u);
        set({ allUsers: updatedUsers });
      } else {
        return { success: false, message: "Not enough coins." };
      }
    }

    const updatedGames = games.map(c => 
      c.id === challengeId ? { ...c, participants: [...c.participants, userId] } : c
    );
    
    const challengeMatches = mockChallengeMatches.filter(m => m.challengeId === challengeId);
    const uniqueDays = [...new Set(challengeMatches.map(m => m.day))];

    const newUserEntry: UserChallengeEntry = {
      user_id: userId,
      challengeId: challengeId,
      dailyEntries: uniqueDays.map(day => ({
        day: day,
        bets: [],
      })),
      entryMethod: method,
      ticketId: ticketId,
    };

    set({ 
      games: updatedGames,
      userChallengeEntries: [...userChallengeEntries, newUserEntry]
    });

    return { success: true, message: `Successfully joined with ${method}!`, method };
  },

  joinSwipeGame: (gameId, userId) => {
    const { games, userSwipeEntries, allUsers } = get();
    const game = games.find(g => g.id === gameId);
    const user = allUsers.find(u => u.id === userId);
  
    if (!game || !user) {
      return { success: false, message: "Game or user not found." };
    }
  
    const hasJoined = userSwipeEntries.some(e => e.matchDayId === gameId && e.user_id === userId);
    if (hasJoined) {
      return { success: true, message: "Already joined." };
    }
  
    const newUserEntry: UserSwipeEntry = {
      user_id: userId,
      matchDayId: gameId,
      predictions: [],
      submitted_at: null,
    };
  
    set({ userSwipeEntries: [...userSwipeEntries, newUserEntry] });
    return { success: true, message: "Successfully joined swipe game." };
  },

  processChallengeStart: (challengeId) => {
    const { games, allUsers, userTickets, userChallengeEntries } = get();
    const challenge = games.find(c => c.id === challengeId);

    if (!challenge) {
      return { success: false, message: "Challenge not found." };
    }

    if (challenge.minimum_players > 0 && challenge.participants.length < challenge.minimum_players) {
      // Cancel challenge and refund
      const updatedGames = games.map(c => c.id === challengeId ? { ...c, status: 'Cancelled' as ChallengeStatus } : c);
      
      let updatedUsers = [...allUsers];
      let updatedTickets = [...userTickets];

      challenge.participants.forEach(participantId => {
        const entry = userChallengeEntries.find(e => e.challengeId === challengeId && e.user_id === participantId);
        if (entry?.entryMethod === 'coins') {
          updatedUsers = updatedUsers.map(u => u.id === participantId ? { ...u, coins_balance: u.coins_balance + challenge.entry_cost } : u);
        } else if (entry?.entryMethod === 'ticket' && entry.ticketId) {
          updatedTickets = updatedTickets.map(t => t.id === entry.ticketId ? { ...t, is_used: false, used_at: undefined } : t);
        }
      });

      set({ games: updatedGames, allUsers: updatedUsers, userTickets: updatedTickets });
      return { success: true, message: `Challenge "${challenge.name}" canceled. Not enough players. Entries refunded.` };
    } else {
      // Start challenge
      const updatedGames = games.map(c => c.id === challengeId ? { ...c, status: 'Ongoing' as ChallengeStatus } : c);
      set({ games: updatedGames });
      return { success: true, message: `Challenge "${challenge.name}" has started!` };
    }
  },

  addTicket: (userId, type) => {
    const { userTickets } = get();
    const now = new Date();
    const userTicketsOfType = userTickets.filter(
      t => t.user_id === userId && t.type === type && !t.is_used && isBefore(now, parseISO(t.expires_at))
    );
    const ticketRule = TICKET_RULES[type];

    if (userTicketsOfType.length >= ticketRule.max_quantity) {
      console.warn(`Ticket limit reached for user ${userId}, type ${type}`);
      return;
    }

    const newTicket: UserTicket = {
      id: uuidv4(),
      user_id: userId,
      type: type,
      is_used: false,
      created_at: now.toISOString(),
      expires_at: addDays(now, ticketRule.expiry_days).toISOString(),
    };

    set({ userTickets: [...userTickets, newTicket] });
  },

  addXp: (userId, amount) => {
    set(state => {
      const updatedUsers = state.allUsers.map(user => {
        if (user.id === userId) {
          const newXp = (user.xp || 0) + amount;
          let finalLevelName = user.level || 'Amateur';

          for (let i = mockLevelsConfig.length - 1; i >= 0; i--) {
            if (newXp >= mockLevelsConfig[i].min_xp) {
              finalLevelName = mockLevelsConfig[i].level_name;
              break;
            }
          }
          
          return { ...user, xp: newXp, level: finalLevelName };
        }
        return user;
      });
      return { allUsers: updatedUsers };
    });
  },

  grantPremium: (userId, days) => {
    set(state => ({
      allUsers: state.allUsers.map(user => {
        if (user.id === userId) {
          const now = new Date();
          const currentExpiry = user.subscription_expires_at ? new Date(user.subscription_expires_at) : now;
          const newExpiry = addDays(isBefore(currentExpiry, now) ? now : currentExpiry, days);

          return {
            ...user,
            is_subscriber: true,
            subscription_expires_at: newExpiry.toISOString(),
          };
        }
        return user;
      })
    }));
  },

  setCoinBalance: (userId, newBalance) => {
    set(state => ({
      allUsers: state.allUsers.map(u => u.id === userId ? { ...u, coins_balance: newBalance } : u)
    }));
  },

  // ... other actions
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

  joinLeague: (inviteCode, userId, callback) => {
    const { userLeagues, leagueMembers } = get();
    const leagueToJoin = userLeagues.find(l => l.invite_code === inviteCode);
    if (!leagueToJoin) {
      callback(null);
      return;
    }
    const isMember = leagueMembers.some(m => m.league_id === leagueToJoin.id && m.user_id === userId);
    if (isMember) {
      callback(leagueToJoin);
      return;
    }
    const newMember: LeagueMember = {
      id: uuidv4(),
      league_id: leagueToJoin.id,
      user_id: userId,
      role: 'member',
      joined_at: new Date().toISOString(),
    };
    set({ leagueMembers: [...leagueMembers, newMember] });
    callback(leagueToJoin);
  },

  handleSwipePrediction: (matchDayId, userId, matchId, prediction) => {
    set(state => {
      let entry = state.userSwipeEntries.find(e => e.matchDayId === matchDayId && e.user_id === userId);
      if (entry) {
        const newPredictions = [...entry.predictions, { matchId, prediction }];
        return {
          userSwipeEntries: state.userSwipeEntries.map(e => e.matchDayId === matchDayId && e.user_id === userId ? { ...e, predictions: newPredictions } : e)
        };
      }
      // This part might need adjustment if users can predict without joining first
      return state;
    });
  },

  updateSwipePrediction: (matchDayId, userId, matchId, prediction) => {
    set(state => ({
      userSwipeEntries: state.userSwipeEntries.map(e => {
        if (e.matchDayId === matchDayId && e.user_id === userId) {
          return {
            ...e,
            predictions: e.predictions.map(p => p.matchId === matchId ? { ...p, prediction } : p)
          };
        }
        return e;
      })
    }));
  },

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
        type: game.game_type === 'betting' ? 'Betting' : game.game_type === 'prediction' ? 'Prediction' : 'Fantasy',
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

  createLeagueAndLink: (name, description, gameToLink, profile) => {
    const { createLeague, linkGameToLeagues } = get();
    const newLeague = createLeague(name, description, profile);
    if (newLeague) {
      linkGameToLeagues(gameToLink, [newLeague.id]);
    }
  },

  unlinkGameFromLeague: (gameId, leagueId) => {
    set((state) => ({
      leagueGames: state.leagueGames.filter(
        (lg) => !(lg.game_id === gameId && lg.league_id === leagueId)
      ),
    }));
  },

  updateLeagueGameLeaderboardPeriod: (leagueGameId, period) => {
    set((state) => ({
      leagueGames: state.leagueGames.map(lg => 
        lg.id === leagueGameId ? { ...lg, leaderboard_period: period } : lg
      ),
    }));
  },

  celebrateWinners: (leagueId, game, leaderboard, period, message, adminId) => {
    const { leagueFeed, leaderboardSnapshots } = get();

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
      game_type: game.game_type,
      created_at: new Date().toISOString(),
      created_by: adminId,
      data: leaderboard,
      message,
      start_date: period.start_date,
      end_date: period.end_date,
    };

    const topPlayers = leaderboard.slice(0, 3).map(p => ({
      name: p.username,
      score: 'points' in p ? p.points : ('totalPoints' in p ? p.totalPoints : 0),
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
      leagueFeed: [newFeedPost, ...leagueFeed],
    });

    return { success: true };
  },

  celebrateSeasonalWinners: (gameId, period, topN, reward, message) => {
    const { games, allUsers, leaderboardScores, addXp, setCoinBalance, addTicket } = get();
    const game = games.find(g => g.id === gameId);
    if (!game || game.duration_type !== 'season' || !game.gameWeeks) return;

    const periodStart = new Date(period.start);
    const periodEnd = new Date(period.end);

    const relevantGameWeeks = game.gameWeeks.filter(gw => {
        const gwDate = new Date(gw.startDate);
        return gwDate >= periodStart && gwDate <= periodEnd;
    });
    const relevantGameWeekIds = new Set(relevantGameWeeks.map(gw => gw.id));

    const playerScores = allUsers.map(user => {
        let totalScore = 0;
        const userScores = leaderboardScores[game.id]?.[user.id];
        if (userScores) {
            for (const gwId in userScores) {
                if (relevantGameWeekIds.has(gwId)) {
                    totalScore += userScores[gwId];
                }
            }
        }
        return { userId: user.id, username: user.username || 'Player', score: totalScore };
    });

    const winners = playerScores.sort((a, b) => b.score - a.score).slice(0, topN);

    // Dispatch rewards
    winners.forEach(winner => {
        switch (reward.type) {
            case 'coins':
                setCoinBalance(winner.userId, (allUsers.find(u => u.id === winner.userId)?.coins_balance || 0) + (reward.value as number));
                break;
            case 'xp':
                addXp(winner.userId, reward.value as number);
                break;
            case 'ticket':
                addTicket(winner.userId, reward.tier as TournamentType);
                break;
        }
    });

    const newEvent: CelebrationEvent = {
        id: uuidv4(),
        gameId,
        gameName: game.name,
        type: 'season',
        period,
        topPlayers: winners.map((winner, index) => ({
            userId: winner.userId,
            username: winner.username,
            rank: index + 1,
            reward: { ...reward, id: uuidv4() }
        })),
        createdAt: new Date().toISOString(),
        message,
    };

    set(state => ({ celebrations: [newEvent, ...state.celebrations] }));
  },

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

        const events = [
          { minute: 25, score: { teamA: 1, teamB: 0 }, trigger: 'goal_event' },
          { minute: 60, score: { teamA: 1, teamB: 1 }, trigger: 'equalizer_event' },
          { minute: 88, score: { teamA: 2, teamB: 1 }, trigger: 'goal_event' },
        ];
        
        const event = events.find(e => newMinute >= e.minute && lastKnownState.minute < e.minute);
        if (event) {
            newScore = { teamA: event.score.teamA, teamB: event.score.teamB };
        }

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
        
        const hasActiveMarket = newMarkets.some(m => m.status === 'open');
        if (!hasActiveMarket) {
            const getEmotionFactor = () => (newMinute > 70 ? 1.3 : 1.0);
            const trigger = event?.trigger || (newMinute > 70 ? 'tension_builds' : null);
            const template = trigger ? marketTemplates[trigger as keyof typeof marketTemplates] : null;
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

  tickFantasyGame: (gameWeekId, userId) => {
    set(state => {
      const userTeam = state.userFantasyTeams.find(t => t.gameWeekId === gameWeekId && t.userId === userId);
      if (!userTeam) return state;

      const { updatedTeam } = processGameWeek(userTeam, mockFantasyPlayers, mockPlayerGameWeekStats);

      return {
        userFantasyTeams: state.userFantasyTeams.map(t =>
          (t.gameWeekId === gameWeekId && t.userId === userId) ? updatedTeam : t
        )
      };
    });
  },

  updateUserFantasyTeam: (team) => {
    set(state => ({
      userFantasyTeams: state.userFantasyTeams.map(t => 
        t.gameWeekId === team.gameWeekId && t.userId === team.userId ? team : t
      ),
    }));
  },

  addNotification: (notification) => {
    const newNotification: Notification = {
      ...notification,
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      isRead: false,
    };
    set(state => ({ notifications: [newNotification, ...state.notifications] }));
  },

  markNotificationAsRead: (notificationId) => {
    set(state => ({
      notifications: state.notifications.map(n => 
        n.id === notificationId ? { ...n, isRead: true } : n
      )
    }));
  },

  markAllNotificationsAsRead: () => {
    set(state => ({
      notifications: state.notifications.map(n => ({ ...n, isRead: true }))
    }));
  },

  incrementInteraction: (user1Id, user2Id) => {
    set(state => {
      const { allUsers } = get();
      const newGraph = { ...state.playerGraph };
      
      const updateUserInteraction = (mainUserId: string, otherUserId: string) => {
        const otherUser = allUsers.find(u => u.id === otherUserId);
        if (!otherUser) return;

        if (newGraph[mainUserId]) {
          newGraph[mainUserId].interactions += 1;
          newGraph[mainUserId].lastInteraction = new Date().toISOString();
        } else {
          newGraph[mainUserId] = {
            playerId: otherUserId,
            username: otherUser.username || 'Player',
            interactions: 1,
            lastInteraction: new Date().toISOString(),
          };
        }
      };

      updateUserInteraction(user1Id, user2Id);
      updateUserInteraction(user2Id, user1Id);

      return { playerGraph: newGraph };
    });
  },
}));

function addMinutes(date: Date, minutes: number) {
    return new Date(date.getTime() + minutes * 60000);
}
