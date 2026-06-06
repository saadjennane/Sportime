import React, { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import { AuthApiError } from '@supabase/supabase-js';
import ErrorBoundary from './components/ErrorBoundary';
import { Header } from './components/Header';
import { BetModal } from './components/BetModal';
import { FooterNav } from './components/FooterNav';
import { mockMatches } from './data/mockMatches';
import { mockChallengeMatches } from './data/mockChallenges';
import { mockFantasyPlayers } from './data/mockFantasy.tsx';
import { Match, Bet, UserChallengeEntry, Profile, LevelConfig, Badge, UserBadge, UserFantasyTeam, UserTicket, SportimeGame, SpinTier, SwipeMatchDay, FantasyGame, ActiveSession, ContextualPromptType, DailyChallengeEntry, ChallengeMatch, ChallengeBet, Challenge } from './types';
const AdminPage = lazy(() => import('./pages/Admin'));
import GamesListPage from './pages/GamesListPage';
const ChallengeRoomPage = lazy(() => import('./pages/ChallengeRoomPage'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));
import { ChooseEntryMethodModal } from './components/ChooseEntryMethodModal';
const SwipeFlowPage = lazy(() => import('./pages/SwipeFlowPage').then(m => ({ default: m.SwipeFlowPage })));
import { JoinSwipeGameConfirmationModal } from './components/JoinSwipeGameConfirmationModal';
import { supabase } from './services/supabase';
import { hideSplash } from './native/initNative';
import { useToast } from './hooks/useToast';
import { useUserStreak } from './hooks/useUserStreak';
import { ToastContainer } from './components/Toast';
import ProfilePage from './pages/ProfilePage';
import { mockBadges, mockLevelsConfig, mockUserBadges } from './data/mockProgression';
import { getLevelBetLimit } from './config/constants';
import MatchesPage from './pages/MatchesPage';
const FantasyGameWeekPage = lazy(() => import('./pages/FantasyGameWeekPage').then(m => ({ default: m.FantasyGameWeekPage })));
import { USE_SUPABASE } from './config/env';
import { OnboardingPage, OnboardingCompletePayload } from './pages/OnboardingPage';
import { SignUpPromptModal } from './components/SignUpPromptModal';
import { SignUpStep } from './pages/onboarding/SignUpStep';
import LeaguesListPage from './pages/LeaguesListPage';
const LeaguePage = lazy(() => import('./pages/LeaguePage'));
const LeagueJoinPage = lazy(() => import('./pages/LeagueJoinPage'));
import { CreateLeagueModal } from './components/leagues/CreateLeagueModal';
import { ConfirmationModal } from './components/leagues/ConfirmationModal';
import { NoLeaguesModal } from './components/leagues/NoLeaguesModal';
import { MiniCreateLeagueModal } from './components/leagues/MiniCreateLeagueModal';
import { SelectLeaguesToLinkModal } from './components/leagues/SelectLeaguesToLinkModal';
import { useMockStore } from './store/useMockStore';
import { useSpinStore } from './store/useSpinStore';
import * as streakService from './services/streakService';
// Load diagnostic tools in dev mode
if (import.meta.env.DEV) {
  import('./utils/spinDiagnostic');
  import('./utils/spinTestHelper');
}
// Heavy, rarely-entry pages — lazy-loaded so they stay out of the initial bundle.
const LiveGameSetupPage = lazy(() => import('./pages/live-game/LiveGameSetupPage'));
const LiveGamePlayPage = lazy(() => import('./pages/live-game/LiveGamePlayPage'));
const LiveGameResultsPage = lazy(() => import('./pages/live-game/LiveGameResultsPage'));
const LiveGameBettingSetupPage = lazy(() => import('./pages/live-game/betting/LiveGameBettingSetupPage'));
const LiveGameBettingPlayPage = lazy(() => import('./pages/live-game/betting/LiveGameBettingPlayPage'));
const LiveGameBettingResultsPage = lazy(() => import('./pages/live-game/betting/LiveGameBettingResultsPage'));
const PredictionChallengeOverviewPage = lazy(() => import('./pages/prediction/PredictionChallengeOverviewPage'));
const FantasyLiveTeamSelectionPage = lazy(() => import('./pages/live-game/FantasyLiveTeamSelectionPage'));
const FantasyLiveGamePage = lazy(() => import('./pages/live-game/FantasyLiveGamePage'));
const LiveGameLobbyPage = lazy(() => import('./pages/live-game/LiveGameLobbyPage'));
import { OnboardingFlow } from './components/OnboardingFlow';
import { isBefore, parseISO, differenceInHours } from 'date-fns';
import { TicketWalletModal } from './components/TicketWalletModal';
import { SpinWheel } from './components/SpinWheel';
import { LiveGameModal } from './components/modals/LiveGameModal';
import { createLiveGame as createLiveGameSupabase } from './services/liveGameService';
import { NotificationCenter } from './components/notifications/NotificationCenter';
import FunZonePage from './pages/FunZonePage';
import { PremiumModal } from './components/premium/PremiumModal';
import { CoinShopModal } from './components/shop/CoinShopModal';
import { DailyStreakModal } from './components/streaks/DailyStreakModal';
import { ContextualPremiumPrompt } from './components/premium/ContextualPremiumPrompt';
import { useActivityTracker } from './hooks/useActivityTracker';
import { useAuth } from './contexts/AuthContext';
import { useChallengesCatalog } from './features/challenges/useChallengesCatalog';
import { useMatchBets } from './features/matches/useMatchBets';
import { useChallengeMatches } from './features/challenges/useChallengeMatches';
import { useUserTickets } from './hooks/useUserTickets';
import { completeGuestRegistration } from './services/userService';
import { updateUserProfile } from './services/profileService';
import { joinChallenge as joinChallengeOnSupabase } from './services/challengeService';
import { saveDailyEntry, ensureChallengeEntry } from './services/challengeEntryService';
import { initializeOneSignal, setupOneSignalForUser } from './services/oneSignalService';
import { useNotifications } from './hooks/useNotifications';
import { useTicket } from './services/ticketService';

function createEmptyChallengeEntry(challengeId: string, userId: string, matches: ChallengeMatch[]): UserChallengeEntry {
  const uniqueDays = Array.from(new Set(matches.map(match => match.day))).sort((a, b) => a - b);
  const dailyEntries: DailyChallengeEntry[] = uniqueDays.map(day => ({
    day,
    bets: [],
  }));

  if (dailyEntries.length === 0) {
    dailyEntries.push({ day: 1, bets: [] });
  }

  return {
    user_id: userId,
    challengeId,
    dailyEntries,
    entryMethod: 'coins',
  };
}


export type Page = 'challenges' | 'matches' | 'profile' | 'admin' | 'squads' | 'funzone';
type AuthFlowState = 'guest' | 'authenticated' | 'signing_up' | 'onboarding';

// Fallback shown while a lazy-loaded page chunk is being fetched.
function PageLoader() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-electric-blue/30 border-t-electric-blue rounded-full animate-spin" />
    </div>
  );
}

function App() {
  const [loading, setLoading] = useState(true);
  // True once the app has finished its first load — used to keep background
  // refreshes (e.g. on app resume) from re-showing the full-screen loader.
  const initialLoadDoneRef = useRef(false);

  // Hide the native splash only once the first real screen is ready, so the
  // user goes straight from splash to UI (no "Loading..." flash in between).
  useEffect(() => {
    if (!loading) hideSplash();
  }, [loading]);
  const { toasts, addToast, removeToast } = useToast();
  const [authFlow, setAuthFlow] = useState<AuthFlowState>('guest');
  const [pendingSignupEmail, setPendingSignupEmail] = useState<string | null>(null);
  const [pendingSignupMode, setPendingSignupMode] = useState<'upgrade' | 'signin' | null>(null);
  const [showSignUpPrompt, setShowSignUpPrompt] = useState(false);
  const [isTicketWalletOpen, setIsTicketWalletOpen] = useState(false);
  const [spinWheelState, setSpinWheelState] = useState<{ isOpen: boolean; tier: SpinTier | null }>({ isOpen: false, tier: null });
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  const [isPremiumModalOpen, setIsPremiumModalOpen] = useState(false);
  const [isCoinShopModalOpen, setIsCoinShopModalOpen] = useState(false);
  const [dailyStreakData, setDailyStreakData] = useState<{ isOpen: boolean; streakDay: number }>({ isOpen: false, streakDay: 0 });
  const [contextualPrompt, setContextualPrompt] = useState<{ type: ContextualPromptType; isOpen: boolean } | null>(null);

  const [page, setPage] = useState<Page>('matches');
  const [matches, setMatches] = useState<Match[]>(mockMatches);
  // `bets` now comes from useMatchBets (persisted); see below.
  const [modalState, setModalState] = useState<{ isOpen: boolean; match: Match | null; prediction: 'teamA' | 'draw' | 'teamB' | null; odds: number; }>({ isOpen: false, match: null, prediction: null, odds: 0 });

  // --- Game Modal States ---
  const [liveGameModalState, setLiveGameModalState] = useState<{ isOpen: boolean; matchId: string | null; matchName: string | null; isLoading: boolean; }>({ isOpen: false, matchId: null, matchName: null, isLoading: false });

  // --- Active Live Game (Supabase) ---
  const [activeLiveGameSupabase, setActiveLiveGameSupabase] = useState<{
    id: string;
    fixtureId: string;
    mode: 'free' | 'ranked';
  } | null>(null);

  // --- Store State ---
  const {
    currentUserId, setCurrentUserId, allUsers, ensureUserExists,
    games: mockGames, userChallengeEntries: mockUserChallengeEntries,
    userSwipeEntries: mockUserSwipeEntries,
    userFantasyTeams: mockUserFantasyTeams, userLeagues, leagueMembers, leagueGames, liveGames, predictionChallenges,
    userTickets: mockUserTickets, userStreaks, createLeague, linkGameToLeagues, createLeagueAndLink,
    createLiveGame, submitLiveGamePrediction, editLiveGamePrediction, placeLiveBet,
    tickLiveGame, joinChallenge: joinChallengeAction, subscribeToPremium,
  } = useMockStore();

  const { user: authUser, profile: authProfile, isLoading: authLoading, ensureGuest, signOut: supabaseSignOut, refreshProfile: reloadProfile, sendMagicLink } = useAuth();

  // Fetch user streak from Supabase (replaces mock store userStreaks)
  const { streak: supabaseStreak, isLoading: streakLoading, refetch: refetchStreak } = useUserStreak(authProfile?.id);

  useEffect(() => {
    if (authLoading) return;
    if (!USE_SUPABASE) {
      // In mock mode, use default user
      if (!currentUserId) {
        setCurrentUserId('user-1');
      }
      setLoading(false);
      return;
    }
    ensureGuest().catch(err => console.error('[App] Failed to ensure guest session', err));
  }, [authLoading, ensureGuest, currentUserId, setCurrentUserId]);

  useEffect(() => {
    if (!authProfile) return;

    const normalizedProfile: Profile = {
      ...authProfile,
      is_guest: authProfile.is_guest ?? authProfile.user_type === 'guest',
      level: authProfile.level ?? authProfile.current_level ?? authProfile.level,
    };

    ensureUserExists(normalizedProfile);
    setCurrentUserId(normalizedProfile.id);
  }, [authProfile, ensureUserExists, setCurrentUserId]);


  const storeProfile = useMemo(() => allUsers.find(u => u.id === currentUserId), [allUsers, currentUserId]);
  const profile = authProfile ?? storeProfile;
  const isGuest = profile ? (profile.is_guest ?? profile.user_type === 'guest') : true;

  const {
    games: supabaseGames,
    userChallengeEntries: supabaseChallengeEntries,
    userSwipeEntries: supabaseSwipeEntries,
    userFantasyTeams: supabaseFantasyTeams,
    joinedChallengeSet,
    isLoading: challengesLoading,
    hasError: challengesError,
    refresh: refreshChallenges,
    updateUserEntryBets,
  } = useChallengesCatalog(profile?.id ?? null, USE_SUPABASE);

  // Persisted match bets (Matches page) — replaces the old in-memory bets.
  const { bets, refresh: refreshMatchBets } = useMatchBets(profile?.id ?? null);

  const shouldUseSupabaseChallenges = USE_SUPABASE && !challengesError;

  const games = shouldUseSupabaseChallenges ? supabaseGames : mockGames;
  const userChallengeEntries = shouldUseSupabaseChallenges ? supabaseChallengeEntries : mockUserChallengeEntries;
  const userSwipeEntries = shouldUseSupabaseChallenges ? supabaseSwipeEntries : mockUserSwipeEntries;
  const userFantasyTeams = shouldUseSupabaseChallenges ? supabaseFantasyTeams : mockUserFantasyTeams;

  const {
    tickets: supabaseTickets,
    isLoading: ticketsLoading,
    error: ticketsError,
    refresh: refreshTickets,
  } = useUserTickets({
    userId: profile?.id ?? null,
    enabled: USE_SUPABASE,
  });

  const userTickets = USE_SUPABASE && !ticketsError ? supabaseTickets : mockUserTickets;

  useEffect(() => {
    if (!profile) return;

    const normalizedEmail = profile.email?.toLowerCase() ?? '';
    const matchesPendingEmail = pendingSignupEmail && normalizedEmail === pendingSignupEmail;
    const isGuestProfile = profile.user_type === 'guest' || profile.is_guest;
    const hasGuestUsername = profile.username?.startsWith('guest_') ?? false;
    const needsOnboarding = !profile.username || hasGuestUsername;

    // If user just verified OTP and needs onboarding, trigger it
    if (pendingSignupMode === 'signin' && matchesPendingEmail && needsOnboarding) {
      if (authFlow !== 'onboarding') {
        setAuthFlow('onboarding');
        setShowSignUpPrompt(false);
      }
      return;
    }

    // If authenticated user with guest username, force onboarding
    if (!isGuestProfile && needsOnboarding && !pendingSignupMode) {
      if (authFlow !== 'onboarding') {
        setAuthFlow('onboarding');
      }
      return;
    }

    // Legacy upgrade flow
    if (pendingSignupMode === 'upgrade' && matchesPendingEmail && isGuestProfile) {
      if (authFlow !== 'onboarding') {
        setAuthFlow('onboarding');
        setShowSignUpPrompt(false);
      }
      return;
    }

    // Clear pending state after successful authentication with complete profile
    if (pendingSignupMode === 'signin' && matchesPendingEmail && !needsOnboarding) {
      setPendingSignupEmail(null);
      setPendingSignupMode(null);
      setShowSignUpPrompt(false);
      if (authFlow !== 'authenticated') {
        setAuthFlow('authenticated');
      }
      return;
    }

    if (!isGuestProfile && !needsOnboarding && pendingSignupMode) {
      setPendingSignupEmail(null);
      setPendingSignupMode(null);
    }
  }, [profile, pendingSignupEmail, pendingSignupMode, authFlow]);

  // ✅ Auto-track user activity for XP calculation
  useActivityTracker(isGuest ? null : (profile?.id || null));

  // ✅ Initialize OneSignal on app load
  useEffect(() => {
    if (USE_SUPABASE) {
      initializeOneSignal().catch(err =>
        console.error('[App] Failed to initialize OneSignal:', err)
      );
    }
  }, []);

  // ✅ Setup OneSignal for authenticated users
  useEffect(() => {
    if (!USE_SUPABASE || !profile || isGuest) return;

    // Setup OneSignal when user is authenticated and not a guest
    setupOneSignalForUser(profile.id).catch(err =>
      console.error('[App] Failed to setup OneSignal for user:', err)
    );
  }, [profile?.id, isGuest]);

  // ✅ Get notifications unread count (only for authenticated users)
  const { unreadCount: supabaseUnreadCount } = useNotifications(
    USE_SUPABASE && !isGuest ? profile?.id : null
  );

  const { initializeUserSpinState } = useSpinStore();

  const [levelsConfig, setLevelsConfig] = useState<LevelConfig[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [userBadges, setUserBadges] = useState<UserBadge[]>(mockUserBadges);

  const [activeLeagueId, setActiveLeagueId] = useState<string | null>(null);
  const [joinLeagueCode, setJoinLeagueCode] = useState<string | null>(null);
  const [showCreateLeagueModal, setShowCreateLeagueModal] = useState(false);
  const [modalAction, setModalAction] = useState<{ type: 'leave' | 'delete', leagueId: string } | null>(null);

  const [activeChallengeId, setActiveChallengeId] = useState<string | null>(null);
  const [viewingLeaderboardFor, setViewingLeaderboardFor] = useState<string | null>(null);
  const [activeSwipeGameId, setActiveSwipeGameId] = useState<string | null>(null);
  const [viewingSwipeLeaderboardFor, setViewingSwipeLeaderboardFor] = useState<string | null>(null);
  const [activeFantasyGameId, setActiveFantasyGameId] = useState<string | null>(null);
  const [activeLiveGame, setActiveLiveGame] = useState<{ id: string; status: 'Upcoming' | 'Ongoing' | 'Finished' } | null>(null);
  const [boosterInfoPreferences, setBoosterInfoPreferences] = useState<{ x2: boolean, x3: boolean }>({ x2: false, x3: false });
  const [challengeToJoin, setChallengeToJoin] = useState<SportimeGame | null>(null);
  const [swipeGameToJoin, setSwipeGameToJoin] = useState<Game | null>(null);
  const [joinSwipeGameModalState, setJoinSwipeGameModalState] = useState<{ isOpen: boolean; game: Game | null; }>({ isOpen: false, game: null });
  const [hasSeenSwipeTutorial, setHasSeenSwipeTutorial] = useState(false);
  const [swipeGameViewMode, setSwipeGameViewMode] = useState<'swiping' | 'recap'>('swiping');
  const [leaderboardContext, setLeaderboardContext] = useState<{ leagueId: string; leagueName: string; fromLeague?: boolean } | null>(null);
  const [viewingPredictionChallenge, setViewingPredictionChallenge] = useState<string | null>(null);

  const [linkingGame, setLinkingGame] = useState<Game | null>(null);
  const [isLinkingLoading, setIsLinkingLoading] = useState(false);
  const [showNoLeaguesModal, setShowNoLeaguesModal] = useState(false);
  const [showSelectLeaguesModal, setShowSelectLeaguesModal] = useState(false);
  const [showMiniCreateLeagueModal, setShowMiniCreateLeagueModal] = useState(false);

  const {
    matches: activeChallengeMatches,
    isLoading: activeChallengeMatchesLoading,
    refresh: refreshActiveChallengeMatches,
  } = useChallengeMatches(activeChallengeId, shouldUseSupabaseChallenges && !!activeChallengeId);

  const {
    matches: leaderboardChallengeMatches,
    isLoading: leaderboardChallengeMatchesLoading,
  } = useChallengeMatches(viewingLeaderboardFor, shouldUseSupabaseChallenges && !!viewingLeaderboardFor);

  useEffect(() => {
    const fetchStaticData = async () => {
      setLevelsConfig(mockLevelsConfig);
      setBadges(mockBadges);
    };
    fetchStaticData();
  }, []);

  useEffect(() => {
      const path = window.location.pathname;
      const joinMatch = path.match(/\/join\/([a-zA-Z0-9]+)/);
      if (joinMatch && joinMatch[1]) {
          setJoinLeagueCode(joinMatch[1]);
          // Keep the base path (e.g., /mobile/) when replacing state
          const basePath = path.startsWith('/mobile') ? '/mobile/' : '/';
          window.history.replaceState({}, document.title, basePath);
      }
  }, []);

  const handleClaimStreak = async () => {
    if (!profile) return;

    try {
      const result = await streakService.claimDailyStreak(profile.id);

      // Refresh profile to get updated coins balance
      await reloadProfile();

      // Refresh streak data to update the display
      await refetchStreak();

      // Toast désactivé pour les streaks quotidiens
      setDailyStreakData({ isOpen: false, streakDay: 0 });
    } catch (error) {
      console.error('[App] Failed to claim streak:', error);
      addToast('Failed to claim daily streak', 'error');
    }
  };

  // Handle Live Game mode selection (Free or Stakes)
  const handleSelectLiveGameMode = async (mode: 'free' | 'ranked', entryCost?: number) => {
    if (!liveGameModalState.matchId) return;

    setLiveGameModalState(prev => ({ ...prev, isLoading: true }));

    try {
      const cost = mode === 'ranked' ? (entryCost ?? 1000) : 0;
      console.log('[App] Creating live game via Supabase:', { matchId: liveGameModalState.matchId, mode, entryCost: cost });
      const game = await createLiveGameSupabase({
        fixtureId: liveGameModalState.matchId,
        mode,
        entryCost: cost,
      });
      console.log('[App] Live game created:', game);

      if (game) {
        addToast(`${mode === 'free' ? 'Free' : 'Stakes'} game created!`, 'success');
        // Navigate to live game lobby
        setActiveLiveGameSupabase({
          id: game.id,
          fixtureId: game.fixtureId,
          mode: game.mode as 'free' | 'ranked',
        });
      } else {
        addToast('Failed to create game - no response', 'error');
      }
    } catch (error: any) {
      console.error('[App] Error creating live game:', error);
      addToast(error?.message || 'Failed to create game', 'error');
    } finally {
      setLiveGameModalState({ isOpen: false, matchId: null, matchName: null, isLoading: false });
    }
  };

  // Effect 2: React to profile changes to set up the rest of the app state
  useEffect(() => {
    if (!profile) {
      setLoading(true);
      return;
    }

    // Only block on the full-screen loader for the FIRST load. Later refreshes
    // (app resume, polling) update data silently without reloading the screen.
    if (shouldUseSupabaseChallenges && challengesLoading && !initialLoadDoneRef.current) {
      setLoading(true);
      return;
    }

    setAuthFlow(isGuest ? 'guest' : 'authenticated');

    initializeUserSpinState(profile.id);

    // DISABLED: Streak system temporarily disabled
    // if (!isGuest) {
    //   streakService.checkDailyStreak(profile.id)
    //     .then((result) => {
    //       if (result.is_available) {
    //         setDailyStreakData({ isOpen: true, streakDay: result.streak_day });
    //       }
    //     })
    //     .catch((error) => {
    //       console.error('[App] Failed to check daily streak:', error);
    //     });
    // }

    const seenTutorial = localStorage.getItem('sportime_seen_swipe_tutorial');
    if (seenTutorial) {
      setHasSeenSwipeTutorial(true);
    }

    setLoading(false);
    initialLoadDoneRef.current = true;
  }, [profile, isGuest, initializeUserSpinState, challengesLoading, shouldUseSupabaseChallenges]);

  // Base balance from profile. Match bets are now deducted server-side
  // (place_match_bet RPC), so coins_balance already reflects locked stakes.
  const baseBalance = profile?.coins_balance ?? 0;
  const coinBalance = baseBalance;

  const profileLevel = profile ? profile.level ?? profile.current_level ?? profile.level : undefined;

  // Note: handleSetCoinBalance is kept for compatibility but the effective balance
  // is now calculated from baseBalance - totalBetAmount
  const handleSetCoinBalance = (newBalance: number) => {
    if (profile) {
      useMockStore.getState().setCoinBalance(profile.id, newBalance);
    }
  };

  const handleTriggerSignUp = () => {
    if (isGuest) {
      setShowSignUpPrompt(true);
    }
  };

  const handleStartSignUp = () => {
    setShowSignUpPrompt(false);
    setAuthFlow('signing_up');
  };

  const handleCancelSignUp = () => {
    setPendingSignupEmail(null);
    setPendingSignupMode(null);
    setShowSignUpPrompt(false);
    setAuthFlow(isGuest ? 'guest' : 'authenticated');
  };

  const handleMagicLinkSent = async (email: string): Promise<string> => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!USE_SUPABASE) {
      addToast('Magic link flow requires Supabase to be enabled.', 'info');
      return 'Magic links are unavailable offline. Please try again later.';
    }

    try {
      const message = await sendMagicLink(normalizedEmail);
      setPendingSignupEmail(normalizedEmail);
      setPendingSignupMode('signin');
      addToast('Magic link sent! Check your email.', 'success');
      return message;
    } catch (error: any) {
      console.error('[App] Failed to send magic link', error);
      const errorMessage = error?.message || 'Unable to send magic link. Please try again.';
      addToast(errorMessage, 'error');
      throw error;
    }
  };

  const handleSignOut = async () => {
    await supabaseSignOut();
    setPendingSignupEmail(null);
    setPendingSignupMode(null);
    setAuthFlow('guest');
    setShowSignUpPrompt(false);
    setCurrentUserId(null);
    setPage('challenges');
    addToast('You have been signed out.', 'info');
  };

  const handleUpdateProfile = async (updatedData: { username: string; displayName: string; newProfilePic: File | null; favoriteClub?: string | null; favoriteNationalTeam?: string | null; }) => {
    if (!profile || isGuest) return;
    addToast('Updating profile...', 'info');

    try {
      const payload: {
        username: string;
        displayName: string;
        favoriteClub?: string | null;
        favoriteNationalTeam?: string | null;
      } = {
        username: updatedData.username,
        displayName: updatedData.displayName,
      };

      if (updatedData.favoriteClub !== undefined) {
        payload.favoriteClub = updatedData.favoriteClub;
      }

      if (updatedData.favoriteNationalTeam !== undefined) {
        payload.favoriteNationalTeam = updatedData.favoriteNationalTeam;
      }

      await updateUserProfile(profile.id, payload);

      await reloadProfile();
      addToast('Profile updated successfully!', 'success');
    } catch (error) {
      console.error('[App] Failed to update profile', error);
      addToast('We could not update your profile. Please try again.', 'error');
    }
  };

  const handleUpdateEmail = async (newEmail: string) => { /* ... */ };
  const handleDeleteAccount = async () => { /* ... */ };

  const handleCompleteOnboarding = async (payload: OnboardingCompletePayload) => {
    if (!profile) return;
    setLoading(true);

    try {
      await completeGuestRegistration({
        username: payload.username,
        displayName: payload.displayName ?? payload.username,
        email: pendingSignupEmail ?? profile.email ?? undefined,
      });

      await updateUserProfile(profile.id, {
        favoriteClub: payload.favoriteClub ?? null,
        favoriteNationalTeam: payload.favoriteNationalTeam ?? null,
      });

      await reloadProfile();
      setPendingSignupEmail(null);
      setPendingSignupMode(null);
      setAuthFlow('authenticated');
      addToast(`Welcome to Sportime, ${payload.displayName || payload.username}!`, 'success');
    } catch (error) {
      console.error('[App] Failed to complete onboarding', error);
      addToast('Unable to finish onboarding. Please try again.', 'error');
      throw error;
    } finally {
      setLoading(false);
    }
  };
  
  const handleBetClick = (match: Match, prediction: 'teamA' | 'draw' | 'teamB', odds: number) => {
    setModalState({ isOpen: true, match, prediction, odds });
  };

  const handleConfirmBet = async (amount: number, prediction: 'teamA' | 'draw' | 'teamB', odds: number) => {
    if (!modalState.match) return;
    // Client-side guard for fast feedback; the RPC re-validates the limit server-side.
    const betLimit = getLevelBetLimit(profile?.level);
    if (betLimit !== null && amount > betLimit) {
      addToast(`Your level limit is ${betLimit.toLocaleString()} coins per match.`, 'error');
      return;
    }
    if (!supabase) {
      addToast('Betting is unavailable right now.', 'error');
      return;
    }
    const safeOdds = typeof odds === 'number' && Number.isFinite(odds) ? odds : 0;
    try {
      const { error } = await supabase.rpc('place_match_bet', {
        p_fixture_id: modalState.match.id,
        p_prediction: prediction,
        p_amount: amount,
        p_odds: safeOdds,
      });
      if (error) throw error;
      await Promise.all([refreshMatchBets(), reloadProfile()]);
    } catch (err: any) {
      console.error('[App] place_match_bet failed', err);
      addToast(err?.message || 'Unable to place your bet. Please try again.', 'error');
    }
  };

  const handleCancelBet = async (matchId: string) => {
    if (!supabase) return;
    try {
      const { error } = await supabase.rpc('cancel_match_bet', { p_fixture_id: matchId });
      if (error) throw error;
      await Promise.all([refreshMatchBets(), reloadProfile()]);
    } catch (err: any) {
      console.error('[App] cancel_match_bet failed', err);
      addToast(err?.message || 'Unable to cancel your bet. Please try again.', 'error');
    }
  };

  const handleUpdateDailyBets = async (challengeId: string, day: number, newBets: ChallengeBet[]) => {
    if (shouldUseSupabaseChallenges && profile) {
      // Optimistic update: update local state immediately
      updateUserEntryBets(challengeId, day, newBets);

      try {
        const existingEntry = userChallengeEntries.find(entry => entry.challengeId === challengeId && entry.user_id === profile.id);
        const dailyEntry = existingEntry?.dailyEntries.find(d => d.day === day);
        await saveDailyEntry({
          challengeId,
          userId: profile.id,
          day,
          bets: newBets,
          booster: dailyEntry?.booster,
          entryMethod: existingEntry?.entryMethod ?? 'coins',
          ticketId: existingEntry?.ticketId ?? null,
        });
        // No need to refresh - local state already updated
      } catch (error) {
        console.error('[App] Failed to save challenge bets', error);
        // Revert optimistic update on error by refreshing from server
        await refreshChallenges();
        addToast('Unable to save your bets. Please try again.', 'error');
      }
      return;
    }

    console.log('Updating daily bets (mock):', { challengeId, day, newBets });
  };

  const handleSetDailyBooster = async (challengeId: string, day: number, booster: { type: 'x2' | 'x3'; matchId: string } | undefined) => {
    if (shouldUseSupabaseChallenges && profile) {
      try {
        const existingEntry = userChallengeEntries.find(entry => entry.challengeId === challengeId && entry.user_id === profile.id);
        const dailyEntry = existingEntry?.dailyEntries.find(d => d.day === day);
        await saveDailyEntry({
          challengeId,
          userId: profile.id,
          day,
          bets: dailyEntry?.bets ?? [],
          booster,
          entryMethod: existingEntry?.entryMethod ?? 'coins',
          ticketId: existingEntry?.ticketId ?? null,
        });
        await refreshChallenges();
        addToast('Booster updated!', 'success');
      } catch (error) {
        console.error('[App] Failed to update booster', error);
        addToast('Unable to update booster right now.', 'error');
      }
      return;
    }

    console.log('Setting daily booster (mock):', { challengeId, day, booster });
  };
  
  const handleUpdateBoosterPreferences = (booster: 'x2' | 'x3') => {
    const newPrefs = { ...boosterInfoPreferences, [booster]: true };
    setBoosterInfoPreferences(newPrefs);
    addToast(`Preference saved. This dialog will not show again for ${booster.toUpperCase()}.`, 'info');
  };
  
  const handleJoinSwipeGame = (gameId: string) => {
    if (isGuest) {
      handleTriggerSignUp();
      return;
    }
    const gameToJoin = games.find(g => g.id === gameId);
    if (!gameToJoin || !profile) return;

    // Check for valid ticket (same logic as betting games)
    const validTicket = userTickets.find(t =>
      t.user_id === profile.id &&
      t.type === gameToJoin.tier &&
      !t.is_used &&
      isBefore(new Date(), parseISO(t.expires_at))
    );
    const hasEnoughCoins = profile.coins_balance >= gameToJoin.entry_cost;

    // If user has both ticket and coins, show choice modal
    if (validTicket && hasEnoughCoins) {
      // Use the same ChooseEntryMethodModal as betting games
      setSwipeGameToJoin(gameToJoin);
    } else if (validTicket) {
      // Auto-join with ticket
      void handleConfirmJoinSwipeGameWithMethod(gameToJoin, 'ticket');
    } else if (hasEnoughCoins) {
      // Show confirmation modal for coins
      setJoinSwipeGameModalState({ isOpen: true, game: gameToJoin });
    } else {
      addToast("You don't have enough coins or a valid ticket to join.", 'error');
    }
  };

  const handleConfirmJoinSwipeGame = async () => {
    const { game } = joinSwipeGameModalState;
    if (!game || !profile || isGuest) return;

    if (coinBalance >= game.entry_cost) {
        try {
          // Import service dynamically to use it
          const { joinSwipeChallenge } = await import('./services/swipeGameService');

          handleSetCoinBalance(coinBalance - game.entry_cost);
          const result = await joinSwipeChallenge(game.id, profile.id);

          if (result.alreadyJoined) {
            addToast(`You've already joined "${game.name}"!`, 'info');
          } else {
            addToast(`Successfully joined "${game.name}"!`, 'success');
          }

          setJoinSwipeGameModalState({ isOpen: false, game: null });
          setSwipeGameViewMode('swiping');
          setActiveSwipeGameId(game.id);
        } catch (err: any) {
          addToast(err.message || 'Failed to join game', 'error');
          handleSetCoinBalance(coinBalance); // Refund
        }
    } else {
        addToast('Insufficient funds to join this game.', 'error');
    }
  };

  // Handle joining swipe game with ticket or coins
  const handleConfirmJoinSwipeGameWithMethod = async (game: Game, method: 'coins' | 'ticket') => {
    if (!profile || isGuest) return;

    try {
      const { joinSwipeChallenge } = await import('./services/swipeGameService');

      if (method === 'ticket') {
        // Find and use the ticket
        const validTicket = userTickets.find(t =>
          t.user_id === profile.id &&
          t.type === game.tier &&
          !t.is_used &&
          isBefore(new Date(), parseISO(t.expires_at))
        );
        if (!validTicket) {
          addToast('No valid ticket found.', 'error');
          return;
        }
        // Mark ticket as used (in real app, this should be done server-side)
        useTicket(validTicket.id);
      } else {
        // Deduct coins
        handleSetCoinBalance(coinBalance - game.entry_cost);
      }

      const result = await joinSwipeChallenge(game.id, profile.id);

      if (result.alreadyJoined) {
        addToast(`You've already joined "${game.name}"!`, 'info');
        // Refund if they already joined
        if (method === 'coins') {
          handleSetCoinBalance(coinBalance);
        }
      } else {
        const methodText = method === 'ticket' ? 'ticket' : `${game.entry_cost} coins`;
        addToast(`Successfully joined "${game.name}" using ${methodText}!`, 'success');
      }

      setSwipeGameToJoin(null);
      setSwipeGameViewMode('swiping');
      setActiveSwipeGameId(game.id);
    } catch (err: any) {
      addToast(err.message || 'Failed to join game', 'error');
      // Refund coins if payment was made
      if (method === 'coins') {
        handleSetCoinBalance(coinBalance);
      }
    }
  };

  const handlePlaySwipeGame = async (challengeId: string) => {
    // When clicking on a swipe game, default to recap view
    // Users can click "Swipe" button to go to swiping mode
    setSwipeGameViewMode('recap');
    setActiveSwipeGameId(challengeId);
  };
  // Swipe game handlers - now using live API
  // CRITICAL: All callbacks MUST be wrapped in useCallback to prevent re-render cascade
  const handleSwipeComplete = useCallback(() => {
    // When all predictions are made, switch to recap view
    setTimeout(() => setSwipeGameViewMode('recap'), 350);
  }, []);

  const handleEditSwipePicks = useCallback(() => {
    if (activeSwipeGameId) {
      setSwipeGameViewMode('swiping');
    }
  }, [activeSwipeGameId]);

  const handleExitSwiping = useCallback(() => {
    setActiveSwipeGameId(null);
    setViewingSwipeLeaderboardFor(null);
    setSwipeGameViewMode(null);
    // Refresh catalog to update joined state (userSwipeEntries)
    refreshChallenges();
  }, [refreshChallenges]);

  const handleDismissSwipeTutorial = useCallback((dontShowAgain: boolean) => {
    if (dontShowAgain) {
      localStorage.setItem('sportime_seen_swipe_tutorial', 'true');
    }
    setHasSeenSwipeTutorial(true);
  }, []);
  const handleViewFantasyGame = (gameId: string) => {
    setActiveFantasyGameId(gameId);
  };
  
  const handleCreateLeague = (name: string, description: string, image_url: string | null) => {
      if (!profile || isGuest) {
          handleTriggerSignUp();
          return;
      }
      const newLeague = createLeague(name, description, profile);
      addToast(`Squad "${name}" created!`, 'success');
      setShowCreateLeagueModal(false);
      setActiveLeagueId(newLeague.id);
      return newLeague;
  };

  const handleJoinLeague = (inviteCode: string) => {
      if (!profile || isGuest) {
          handleTriggerSignUp();
          return;
      }
      useMockStore.getState().joinLeague(inviteCode, profile.id, (league) => {
        if (league) {
          addToast(`Welcome to ${league.name}!`, 'success');
          setActiveLeagueId(league.id);
          setJoinLeagueCode(null);
        } else {
          addToast('Invalid invite code.', 'error');
          setJoinLeagueCode(null);
        }
      });
  };

  const handleLeaveLeague = (leagueId: string) => { /* ... */ };
  const handleDeleteLeague = (leagueId: string) => { /* ... */ };
  const handleUpdateLeagueDetails = (leagueId: string, name: string, description: string, image_url: string | null) => { /* ... */ };
  const handleRemoveLeagueMember = (leagueId: string, userId: string) => { /* ... */ };
  const handleResetInviteCode = (leagueId: string) => { /* ... */ };

  const handleLinkGameToLeague = (leagueId: string, game: Game) => {
    if (!profile) return;
    const { linkedLeagueNames } = linkGameToLeagues(game, [leagueId]);
    if (linkedLeagueNames.length > 0) {
      addToast(`"${game.name}" linked to your squad!`, 'success');
    }
  };

  const handleViewLeagueGame = (gameId: string, gameType: Game['game_type'], leagueId: string, leagueName: string) => {
    setLeaderboardContext({ leagueId, leagueName, fromLeague: true });
    if (gameType === 'betting') {
      setViewingLeaderboardFor(gameId);
    } else if (gameType === 'prediction') {
      setViewingSwipeLeaderboardFor(gameId);
    } else if (gameType === 'fantasy') {
      setActiveFantasyGameId(gameId);
    }
  };

  const handleViewLiveGame = (gameId: string, status: 'Upcoming' | 'Ongoing' | 'Finished') => {
    setActiveLiveGame({ id: gameId, status });
  };

  const myAdminLeagues = useMemo(() => {
    if (!profile) return [];
    const adminOfLeagueIds = new Set(leagueMembers.filter(m => m.user_id === profile.id && m.role === 'admin').map(m => m.league_id));
    return userLeagues.filter(l => adminOfLeagueIds.has(l.id));
  }, [profile, leagueMembers, userLeagues]);

  const handleOpenLinkGameFlow = (game: Game) => {
    if (isGuest) {
      handleTriggerSignUp();
      return;
    }
    setLinkingGame(game);
    if (myAdminLeagues.length === 0) {
      setShowNoLeaguesModal(true);
    } else {
      setShowSelectLeaguesModal(true);
    }
  };

  const handleCloseLinkGameModals = () => {
    setLinkingGame(null);
    setShowNoLeaguesModal(false);
    setShowSelectLeaguesModal(false);
    setShowMiniCreateLeagueModal(false);
  };

  const handleCreateLeagueAndLink = async (name: string, description: string) => {
    if (!profile || isGuest || !linkingGame) return;
    setIsLinkingLoading(true);
    
    createLeagueAndLink(name, description, linkingGame, profile);
    
    addToast(`Squad "${name}" created and linked successfully! 🎉`, 'success');
    handleCloseLinkGameModals();
    setIsLinkingLoading(false);
  };

  const handleLinkToSelectedLeagues = (leagueIds: string[]) => {
    if (!linkingGame || !profile) return;
    setIsLinkingLoading(true);

    const { linkedLeagueNames } = linkGameToLeagues(linkingGame, leagueIds);

    if(linkedLeagueNames.length > 0) {
        addToast(`Game linked to ${linkedLeagueNames.join(', ')} ✅`, 'success');
    }
    handleCloseLinkGameModals();
    setIsLinkingLoading(false);
  };

  const handleConfirmJoinChallenge = async (challengeId: string, method: 'coins' | 'ticket') => {
    if (!profile) return;

    if (shouldUseSupabaseChallenges) {
      try {
        const result = await joinChallengeOnSupabase(challengeId, profile.id, method);
        if (result.insufficientCoins) {
          addToast('Not enough coins to join this challenge.', 'error');
          return;
        }

        if (result.alreadyJoined) {
          addToast('You already joined this challenge.', 'info');
        } else {
          await ensureChallengeEntry(challengeId, profile.id, method, null);
          addToast('Challenge joined! Good luck! ⚽', 'success');
        }
        await refreshChallenges();
        setActiveChallengeId(challengeId);
      } catch (error) {
        console.error('[App] Failed to join challenge', error);
        addToast('Failed to join challenge. Please try again.', 'error');
      } finally {
        setChallengeToJoin(null);
      }
      return;
    }
    
    const result = joinChallengeAction(challengeId, profile.id, method);

    if (result.success) {
      addToast(result.message, 'success');
      setActiveChallengeId(challengeId);
    } else {
      addToast(result.message, 'error');
    }
    setChallengeToJoin(null);
  };

  const handleJoinChallenge = (game: SportimeGame) => {
    if (!profile || isGuest) {
      handleTriggerSignUp();
      return;
    }

    const validTicket = userTickets.find(t => 
      t.user_id === profile.id &&
      t.type === game.tier &&
      !t.is_used &&
      isBefore(new Date(), parseISO(t.expires_at))
    );
    const hasEnoughCoins = profile.coins_balance >= game.entry_cost;

    if (validTicket && hasEnoughCoins) {
      setChallengeToJoin(game);
    } else if (validTicket) {
      void handleConfirmJoinChallenge(game.id, 'ticket');
    } else if (hasEnoughCoins) {
      void handleConfirmJoinChallenge(game.id, 'coins');
    } else {
      addToast("You don't have enough coins or a valid ticket to join.", 'error');
    }
  };


  const handlePageChange = (newPage: Page) => {
    if ((newPage === 'profile' || newPage === 'squads' || newPage === 'funzone') && isGuest) {
        handleTriggerSignUp();
        return;
    }
    setPage(newPage);
    setActiveChallengeId(null);
    setViewingLeaderboardFor(null);
    setActiveSwipeGameId(null);
    setViewingSwipeLeaderboardFor(null);
    setActiveFantasyGameId(null);
    setActiveLeagueId(null);
    setJoinLeagueCode(null);
    setLeaderboardContext(null);
    setActiveLiveGame(null);
    setViewingPredictionChallenge(null);
  }

  const handleLeaderboardBack = () => {
    const fromLeagueId = leaderboardContext?.leagueId;
    setViewingLeaderboardFor(null);
    setViewingSwipeLeaderboardFor(null);
    setActiveFantasyGameId(null);
    setLeaderboardContext(null);
    setViewingPredictionChallenge(null);
    if (fromLeagueId) {
        setActiveLeagueId(fromLeagueId);
    }
  };

  const handleOpenSpinWheel = (tier: SpinTier) => {
    setSpinWheelState({ isOpen: true, tier });
  };

  const myGamesCount = useMemo(() => {
    if (!profile || isGuest) return 0;

    const myJoinedGameIds = USE_SUPABASE
      ? joinedChallengeSet
      : new Set<string>([
          ...userChallengeEntries.map(e => e.challengeId),
          ...userSwipeEntries.map(e => e.matchDayId),
          ...userFantasyTeams.map(t => t.gameId),
        ]);

    return games.filter(
      g =>
        myJoinedGameIds.has(g.id) &&
        (g.status === 'Upcoming' || g.status === 'Ongoing')
    ).length;
  }, [
    profile,
    isGuest,
    games,
    userChallengeEntries,
    userSwipeEntries,
    userFantasyTeams,
    joinedChallengeSet,
  ]);

  const linkableGames = useMemo(() => games.filter(g => g.is_linkable), [games]);

  const myLeagues = useMemo(() => {
    if (!profile) return [];
    const userMemberOf = leagueMembers.filter(m => m.user_id === profile.id).map(m => m.league_id);
    return userLeagues.filter(l => userMemberOf.includes(l.id));
  }, [profile, leagueMembers, userLeagues]);
  
  const ticketCount = useMemo(() => {
    if (!profile) return 0;
    return userTickets.filter(t => 
        t.user_id === profile.id && 
        !t.is_used && 
        isBefore(new Date(), parseISO(t.expires_at))
    ).length;
  }, [userTickets, profile]);

  const handlePlayGameClick = (matchId: string, matchName: string) => {
    setLiveGameModalState({ isOpen: true, matchId, matchName, isLoading: false });
  };

  const unreadNotificationsCount = useMemo(() => {
    // Always use Supabase for notifications (no mock fallback)
    return USE_SUPABASE && !isGuest ? supabaseUnreadCount : 0;
  }, [USE_SUPABASE, isGuest, supabaseUnreadCount]);

  const handleSubscribe = (plan: 'monthly' | 'seasonal') => {
    if (profile) {
      subscribeToPremium(profile.id, plan);
      addToast(`Subscribed to ${plan} plan! Premium activated.`, 'success');
      setIsPremiumModalOpen(false);
    }
  };

  const renderPage = () => {
    if (joinLeagueCode) {
        const leagueToJoin = userLeagues.find(l => l.invite_code === joinLeagueCode);
        const isMember = profile ? leagueMembers.some(m => m.league_id === leagueToJoin?.id && m.user_id === profile.id) : false;
        return <LeagueJoinPage 
            league={leagueToJoin || null}
            isMember={isMember}
            onJoin={() => handleJoinLeague(joinLeagueCode)}
            onGoToLeague={() => { setActiveLeagueId(leagueToJoin!.id); setJoinLeagueCode(null); setPage('squads'); }}
            onCancel={() => setJoinLeagueCode(null)}
        />
    }
    
    if (viewingLeaderboardFor) {
      if (USE_SUPABASE && leaderboardChallengeMatchesLoading) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-deep-navy">
            <div className="text-2xl font-semibold text-text-secondary">Loading leaderboard...</div>
          </div>
        );
      }

      const game = games.find(c => c.id === viewingLeaderboardFor && c.game_type === 'betting');
      if (game && profile) {
        // Convert SportimeGame to Challenge format (different property names)
        const challenge: Challenge = {
          id: game.id,
          name: game.name,
          startDate: game.start_date,
          endDate: game.end_date,
          entryCost: game.entry_cost,
          challengeBalance: game.challengeBalance ?? 1000,
          status: game.status === 'Cancelled' ? 'Finished' : game.status,
          totalPlayers: game.totalPlayers,
        };

        const matchesForLeaderboard = USE_SUPABASE
          ? leaderboardChallengeMatches
          : mockChallengeMatches.filter(m => m.challengeId === viewingLeaderboardFor);

        const existingEntry = userChallengeEntries.find(e => e.challengeId === viewingLeaderboardFor && e.user_id === profile.id);
        const userEntry = existingEntry ?? (USE_SUPABASE ? createEmptyChallengeEntry(challenge.id, profile.id, matchesForLeaderboard) : undefined);

        return <LeaderboardPage
          challenge={challenge}
          matches={matchesForLeaderboard}
          userEntry={userEntry}
          onBack={handleLeaderboardBack}
          initialLeagueContext={leaderboardContext}
          allUsers={allUsers}
          userLeagues={myLeagues}
          leagueMembers={leagueMembers}
          leagueGames={leagueGames}
          currentUserId={profile.id}
        />;
      }
    }

    if (activeChallengeId) {
      if (USE_SUPABASE && activeChallengeMatchesLoading) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-deep-navy">
            <div className="text-2xl font-semibold text-text-secondary">Loading challenge...</div>
          </div>
        );
      }

      const challenge = games.find(c => c.id === activeChallengeId && c.game_type === 'betting');
      if (challenge && profile) {
        const matchesForChallenge = USE_SUPABASE
          ? activeChallengeMatches
          : mockChallengeMatches.filter(m => m.challengeId === activeChallengeId);

        // Wait for matches to be loaded before creating user entry
        if (USE_SUPABASE && matchesForChallenge.length === 0 && !activeChallengeMatchesLoading) {
          // Matches loaded but empty - show message
          return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-deep-navy p-4">
              <div className="text-xl font-semibold text-text-secondary mb-4">No matches available for this challenge</div>
              <button onClick={() => setActiveChallengeId(null)} className="text-electric-blue font-semibold">Back to Games</button>
            </div>
          );
        }

        const existingEntry = userChallengeEntries.find(e => e.challengeId === activeChallengeId && e.user_id === profile.id);

        // If existingEntry has empty dailyEntries but we have matches, regenerate dailyEntries
        let userEntry = existingEntry;
        if (existingEntry && existingEntry.dailyEntries.length === 0 && matchesForChallenge.length > 0) {
          console.log('[App] Regenerating dailyEntries for existing entry with', matchesForChallenge.length, 'matches');
          const freshEntry = createEmptyChallengeEntry(activeChallengeId, profile.id, matchesForChallenge);
          userEntry = { ...existingEntry, dailyEntries: freshEntry.dailyEntries };
        } else if (!existingEntry && USE_SUPABASE) {
          userEntry = createEmptyChallengeEntry(activeChallengeId, profile.id, matchesForChallenge);
        }

        if (userEntry && matchesForChallenge.length > 0) {
          return <ChallengeRoomPage
            challenge={challenge}
            matches={matchesForChallenge}
            userEntry={userEntry}
            onUpdateDailyBets={handleUpdateDailyBets}
            onSetDailyBooster={handleSetDailyBooster}
            onBack={() => setActiveChallengeId(null)}
            onViewLeaderboard={() => setViewingLeaderboardFor(activeChallengeId)}
            boosterInfoPreferences={boosterInfoPreferences}
            onUpdateBoosterPreferences={handleUpdateBoosterPreferences}
            onLinkGame={handleOpenLinkGameFlow}
            profile={profile}
            userLeagues={myLeagues}
            leagueMembers={leagueMembers}
            leagueGames={leagueGames}
            onRefreshMatches={refreshActiveChallengeMatches}
          />;
        }
      }
    }

    if (viewingPredictionChallenge) {
      const challenge = predictionChallenges.find(c => c.id === viewingPredictionChallenge);
      if (challenge && profile) {
        return <PredictionChallengeOverviewPage 
          challenge={challenge}
          onBack={handleLeaderboardBack}
          allUsers={allUsers}
          userSwipeEntries={userSwipeEntries}
          swipeMatchDays={games.filter(g => g.game_type === 'prediction') as SwipeMatchDay[]}
          currentUserId={profile.id}
        />
      }
    }

    // Swipe game flow - single unified component
    if ((activeSwipeGameId || viewingSwipeLeaderboardFor) && profile) {
      const swipeChallengeId = activeSwipeGameId || viewingSwipeLeaderboardFor;
      return (
        <SwipeFlowPage
          challengeId={swipeChallengeId!}
          userId={profile.id}
          hasSeenSwipeTutorial={hasSeenSwipeTutorial}
          onDismissTutorial={handleDismissSwipeTutorial}
          onExit={handleExitSwiping}
          profile={profile}
          userLeagues={myLeagues}
          leagueMembers={leagueMembers}
          leagueGames={leagueGames}
          onLinkGame={handleOpenLinkGameFlow}
        />
      );
    }
    
    if (activeFantasyGameId) {
      const game = games.find(g => g.id === activeFantasyGameId && g.game_type === 'fantasy');
      if (game && profile) {
        return <FantasyGameWeekPage
          game={game as FantasyGame}
          allPlayers={mockFantasyPlayers}
          onBack={handleLeaderboardBack}
          initialLeagueContext={leaderboardContext}
          allUsers={allUsers}
          userLeagues={myLeagues}
          leagueMembers={leagueMembers}
          leagueGames={leagueGames}
          currentUserId={profile.id}
          onLinkGame={handleOpenLinkGameFlow}
          profile={profile}
        />;
      }
    }

    if (activeLiveGame) {
      const game = liveGames.find(g => g.id === activeLiveGame.id);
      if (game && profile) {
        const playerEntry = game.players.find(p => p.user_id === profile.id);
        if (game.mode === 'prediction') {
          if (activeLiveGame.status === 'Upcoming') {
            return <LiveGameSetupPage game={game} onBack={() => setActiveLiveGame(null)} onSubmit={submitLiveGamePrediction} playerEntry={playerEntry} />;
          }
          if (activeLiveGame.status === 'Ongoing') {
            return <LiveGamePlayPage game={game} onBack={() => setActiveLiveGame(null)} onEdit={editLiveGamePrediction} playerEntry={playerEntry} onTick={tickLiveGame} />;
          }
          if (activeLiveGame.status === 'Finished') {
            return <LiveGameResultsPage game={game} onBack={() => setActiveLiveGame(null)} playerEntry={playerEntry} currentUserId={profile.id} leagueMembers={leagueMembers} />;
          }
        } else if (game.mode === 'betting') {
          if (activeLiveGame.status === 'Upcoming') {
            return <LiveGameBettingSetupPage game={game} onBack={() => setActiveLiveGame(null)} playerEntry={playerEntry} onPlaceBet={placeLiveBet} />;
          }
           if (activeLiveGame.status === 'Ongoing') {
            return <LiveGameBettingPlayPage game={game} onBack={() => setActiveLiveGame(null)} playerEntry={playerEntry} onPlaceBet={placeLiveBet} onTick={tickLiveGame} />;
          }
          if (activeLiveGame.status === 'Finished') {
            return <LiveGameBettingResultsPage game={game} onBack={() => setActiveLiveGame(null)} playerEntry={playerEntry} currentUserId={profile.id} leagueMembers={leagueMembers} />;
          }
        } else if (game.mode === 'fantasy-live') {
            if (activeLiveGame.status === 'Upcoming') {
                return <FantasyLiveTeamSelectionPage game={game} onBack={() => setActiveLiveGame(null)} />;
            }
            if (activeLiveGame.status === 'Ongoing' || activeLiveGame.status === 'Finished') {
                return <FantasyLiveGamePage game={game} onBack={() => setActiveLiveGame(null)} />;
            }
        }
      }
    }

    if (activeLeagueId) {
        const league = userLeagues.find(l => l.id === activeLeagueId);
        if (league && profile) {
            const membersOfLeague = leagueMembers.filter(m => m.league_id === league.id);
            const memberProfiles = membersOfLeague.map(m => allUsers.find(u => u.id === m.user_id)).filter(Boolean) as Profile[];
            const currentUserMembership = membersOfLeague.find(m => m.user_id === profile.id);
            return <LeaguePage 
                league={league}
                members={memberProfiles}
                memberRoles={membersOfLeague}
                currentUserRole={currentUserMembership?.role || 'member'}
                currentUserId={profile.id}
                onBack={() => setActiveLeagueId(null)}
                onUpdateDetails={() => {}}
                onRemoveMember={() => {}}
                onResetInviteCode={() => {}}
                onLeave={() => setModalAction({type: 'leave', leagueId: league.id})}
                onDelete={() => setModalAction({type: 'delete', leagueId: league.id})}
                onViewGame={(gameId, gameType) => handleViewLeagueGame(gameId, gameType as any, league.id, league.name)}
                onViewLiveGame={handleViewLiveGame}
                addToast={addToast}
                leagueGames={leagueGames}
                allGames={games}
                linkableGames={linkableGames}
            />;
        }
    }

    switch (page) {
      case 'matches':
        return (
          <ErrorBoundary>
            <MatchesPage matches={matches} bets={bets} onBet={handleBetClick} onPlayGame={handlePlayGameClick} />
          </ErrorBoundary>
        );
      case 'challenges':
        return <GamesListPage games={games} userChallengeEntries={userChallengeEntries} userSwipeEntries={userSwipeEntries} userFantasyTeams={userFantasyTeams} onJoinChallenge={handleJoinChallenge} onViewChallenge={setActiveChallengeId} onJoinSwipeGame={handleJoinSwipeGame} onPlaySwipeGame={handlePlaySwipeGame} onViewFantasyGame={handleViewFantasyGame} myGamesCount={myGamesCount} profile={profile} userTickets={userTickets} onRefresh={refreshChallenges} />;
      case 'squads':
          return <LeaguesListPage
              leagues={myLeagues}
              onCreate={() => setShowCreateLeagueModal(true)}
              onViewLeague={setActiveLeagueId}
          />;
      case 'funzone':
        return <FunZonePage profile={profile} onOpenSpinWheel={handleOpenSpinWheel} addToast={addToast} />;
      case 'admin':
        return <AdminPage profile={profile} addToast={addToast} />;
      case 'profile':
        if (profile && !isGuest) {
          // Use Supabase streak data if available, fallback to mock for guests/errors
          const profileStreaks = supabaseStreak ? [supabaseStreak] : userStreaks;
          return <ProfilePage profile={profile} levels={levelsConfig} allBadges={badges} userBadges={userBadges} userStreaks={profileStreaks} onUpdateProfile={handleUpdateProfile} onUpdateEmail={handleUpdateEmail} onSignOut={handleSignOut} onDeleteAccount={handleDeleteAccount} onOpenSpinWheel={handleOpenSpinWheel} onOpenPremiumModal={() => setIsPremiumModalOpen(true)} />;
        }
        return null;
      default:
        return <GamesListPage games={games} userChallengeEntries={userChallengeEntries} userSwipeEntries={userSwipeEntries} userFantasyTeams={userFantasyTeams} onJoinChallenge={handleJoinChallenge} onViewChallenge={setActiveChallengeId} onJoinSwipeGame={handleJoinSwipeGame} onPlaySwipeGame={handlePlaySwipeGame} onViewFantasyGame={handleViewFantasyGame} myGamesCount={myGamesCount} profile={profile} userTickets={userTickets} onRefresh={refreshChallenges} />;
    }
  }
  
  const userBetForModal = modalState.match ? bets.find(b => b.matchId === modalState.match!.id) : undefined;
  const currentBetLimit = useMemo(() => getLevelBetLimit(profileLevel), [profileLevel]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-deep-navy"><div className="text-2xl font-semibold text-text-secondary">Loading...</div></div>;
  }

  if (authFlow === 'signing_up' || joinLeagueCode && profile?.is_guest) {
    return <SignUpStep onMagicLinkSent={handleMagicLinkSent} onBack={handleCancelSignUp} />;
  }
  if (authFlow === 'onboarding' && profile) {
    return <OnboardingPage profile={profile} onComplete={handleCompleteOnboarding} />;
  }

  // Show Live Game Lobby if active
  if (activeLiveGameSupabase) {
    return (
      <Suspense fallback={<PageLoader />}>
        <LiveGameLobbyPage
          gameId={activeLiveGameSupabase.id}
          fixtureId={activeLiveGameSupabase.fixtureId}
          mode={activeLiveGameSupabase.mode}
          onBack={() => setActiveLiveGameSupabase(null)}
        />
      </Suspense>
    );
  }

  return (
    <div className="main-background fixed inset-0 flex flex-col overflow-hidden">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Fixed top header (profile / coins) — never scrolls */}
      <div className="flex-shrink-0 w-full max-w-md mx-auto px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
        <Header
          profile={profile}
          coinBalance={coinBalance}
          ticketCount={ticketCount}
          onViewProfile={() => handlePageChange('profile')}
          onSignIn={handleTriggerSignUp}
          onViewTickets={() => setIsTicketWalletOpen(true)}
          notificationCount={unreadNotificationsCount}
          onViewNotifications={() => setIsNotificationCenterOpen(true)}
          onGoToShop={() => setIsCoinShopModalOpen(true)}
          onOpenPremiumModal={() => setIsPremiumModalOpen(true)}
        />
      </div>

      {/* Single scroll region for page content */}
      <div id="app-scroll" className="flex-1 overflow-y-auto overscroll-y-contain">
        <div className="w-full max-w-md mx-auto px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] space-y-4">
          <Suspense fallback={<PageLoader />}>{renderPage()}</Suspense>
        </div>
      </div>

      <FooterNav activePage={page} onPageChange={handlePageChange} />

      {modalState.match && modalState.prediction && (
        <BetModal
          isOpen={modalState.isOpen}
          onClose={() => setModalState({ ...modalState, isOpen: false })}
          match={modalState.match}
          prediction={modalState.prediction}
          odds={modalState.odds}
          balance={coinBalance}
          betLimit={currentBetLimit}
          onConfirm={handleConfirmBet}
          userBet={userBetForModal}
          onCancelBet={handleCancelBet}
        />
      )}
      {challengeToJoin && (
        <ChooseEntryMethodModal
          isOpen={!!challengeToJoin}
          onClose={() => setChallengeToJoin(null)}
          onSelectMethod={(method) => handleConfirmJoinChallenge(challengeToJoin.id, method)}
          challenge={challengeToJoin}
        />
      )}
      {swipeGameToJoin && (
        <ChooseEntryMethodModal
          isOpen={!!swipeGameToJoin}
          onClose={() => setSwipeGameToJoin(null)}
          onSelectMethod={(method) => handleConfirmJoinSwipeGameWithMethod(swipeGameToJoin, method)}
          challenge={swipeGameToJoin}
        />
      )}
      {joinSwipeGameModalState.isOpen && joinSwipeGameModalState.game && ( <JoinSwipeGameConfirmationModal isOpen={joinSwipeGameModalState.isOpen} onClose={() => setJoinSwipeGameModalState({ isOpen: false, game: null })} onConfirm={handleConfirmJoinSwipeGame} game={joinSwipeGameModalState.game as SwipeMatchDay} userBalance={coinBalance} /> )}
      <SignUpPromptModal isOpen={showSignUpPrompt} onConfirm={handleStartSignUp} onCancel={() => setShowSignUpPrompt(false)} />
      <CreateLeagueModal isOpen={showCreateLeagueModal} onClose={() => setShowCreateLeagueModal(false)} onCreate={handleCreateLeague} />
      
      {modalAction && (
        <ConfirmationModal 
            isOpen={!!modalAction}
            onClose={() => setModalAction(null)}
            onConfirm={() => modalAction.type === 'leave' ? handleLeaveLeague(modalAction.leagueId) : handleDeleteLeague(modalAction.leagueId)}
            title={modalAction.type === 'leave' ? 'Leave Squad' : 'Delete Squad'}
            message={modalAction.type === 'leave' ? 'Are you sure you want to leave this squad?' : 'This action is irreversible and will delete the squad for all members. Are you sure?'}
            confirmText={modalAction.type === 'leave' ? 'Leave' : 'Delete'}
            isDestructive={true}
        />
    )}
    <NoLeaguesModal 
        isOpen={showNoLeaguesModal}
        onClose={handleCloseLinkGameModals}
        onCreateLeague={() => {
            setShowNoLeaguesModal(false);
            setShowMiniCreateLeagueModal(true);
        }}
    />
    <MiniCreateLeagueModal
        isOpen={showMiniCreateLeagueModal}
        onClose={handleCloseLinkGameModals}
        onCreate={handleCreateLeagueAndLink}
        loading={isLinkingLoading}
    />
    <SelectLeaguesToLinkModal
        isOpen={showSelectLeaguesModal}
        onClose={handleCloseLinkGameModals}
        onLink={handleLinkToSelectedLeagues}
        adminLeagues={myAdminLeagues}
        alreadyLinkedLeagueIds={linkingGame ? leagueGames.filter(lg => lg.game_id === linkingGame.id).map(lg => lg.league_id) : []}
        loading={isLinkingLoading}
    />
    <OnboardingFlow 
      isOpen={useMockStore.getState().showOnboardingTest}
      onClose={() => useMockStore.getState().closeOnboardingTest()}
    />
    <TicketWalletModal
      isOpen={isTicketWalletOpen}
      onClose={() => setIsTicketWalletOpen(false)}
      tickets={profile ? userTickets.filter(t => t.user_id === profile.id) : []}
    />
    {spinWheelState.isOpen && spinWheelState.tier && profile && (
      <SpinWheel
        isOpen={spinWheelState.isOpen}
        onClose={() => setSpinWheelState({ isOpen: false, tier: null })}
        tier={spinWheelState.tier}
        userId={profile.id}
      />
    )}
    <LiveGameModal
        isOpen={liveGameModalState.isOpen}
        onClose={() => setLiveGameModalState({ isOpen: false, matchId: null, matchName: null, isLoading: false })}
        matchId={liveGameModalState.matchId}
        matchName={liveGameModalState.matchName}
        onSelectMode={handleSelectLiveGameMode}
        isLoading={liveGameModalState.isLoading}
        userBalance={profile?.coins_balance ?? 0}
        userTier={profile?.level ?? profile?.current_level ?? 'rookie'}
    />
    <NotificationCenter
      isOpen={isNotificationCenterOpen}
      onClose={() => setIsNotificationCenterOpen(false)}
      userId={profile?.id}
    />
    <PremiumModal
      isOpen={isPremiumModalOpen}
      onClose={() => setIsPremiumModalOpen(false)}
      onSubscribe={handleSubscribe}
    />
    <CoinShopModal
      isOpen={isCoinShopModalOpen}
      onClose={() => setIsCoinShopModalOpen(false)}
      profile={profile}
      addToast={addToast}
      onOpenPremiumModal={() => {
        setIsCoinShopModalOpen(false);
        setIsPremiumModalOpen(true);
      }}
      onTriggerSignUp={handleTriggerSignUp}
    />
{/* DISABLED: Streak system temporarily disabled
    <DailyStreakModal
      isOpen={dailyStreakData.isOpen}
      onClaim={handleClaimStreak}
      streakDay={dailyStreakData.streakDay}
    />
*/}
    {contextualPrompt && <ContextualPremiumPrompt {...contextualPrompt} />}
    </div>
    );
}

export default App;
