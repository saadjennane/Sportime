import React, { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import { AuthApiError } from '@supabase/supabase-js';
import ErrorBoundary from './components/ErrorBoundary';
import { Header } from './components/Header';
import { BetModal } from './components/BetModal';
import { FooterNav } from './components/FooterNav';
import { LogoSpinner } from './components/LogoSpinner';
import { SportSwitcher } from './components/SportSwitcher';
import { useSport } from './contexts/SportContext';
import RacesPage from './pages/RacesPage';
import { mockMatches } from './data/mockMatches';
import { mockChallengeMatches } from './data/mockChallenges';
import { mockFantasyPlayers } from './data/mockFantasy.tsx';
import { Match, Bet, UserChallengeEntry, Profile, LevelConfig, Badge, UserBadge, UserFantasyTeam, UserTicket, SportimeGame, SpinTier, SwipeMatchDay, FantasyGame, ActiveSession, ContextualPromptType, DailyChallengeEntry, ChallengeMatch, ChallengeBet, Challenge } from './types';
import GamesListPage from './pages/GamesListPage';
const ChallengeRoomPage = lazy(() => import('./pages/ChallengeRoomPage'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));
import { ChooseEntryMethodModal } from './components/ChooseEntryMethodModal';
import { MasterpassInviteModal } from './components/funzone/MasterpassInviteModal';
import { MasterpassClaimModal } from './components/funzone/MasterpassClaimModal';
import { getAvailableMasterpasses, useMasterpass, claimMasterpassInvite, getMyPendingInvites } from './services/masterpassService';
import { getMRGameByFixture, createMRGame } from './services/matchRoyaleService';
import { getLFGameByFixture, notifyLineups } from './services/liveFantasyService';
import { App as CapApp } from '@capacitor/app';
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
const TournamentQuestPage = lazy(() => import('./pages/TournamentQuestPage').then(m => ({ default: m.TournamentQuestPage })));
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
import { getUserSpinState } from './services/spinService';
import * as streakService from './services/streakService';
// Load diagnostic tools in dev mode
if (import.meta.env.DEV) {
  import('./utils/spinDiagnostic');
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
const LiveScorePredictionGame = lazy(() => import('./pages/live-game/LiveScorePredictionGame'));
const LiveGamesListPage = lazy(() => import('./pages/live-game/LiveGamesListPage'));
const MatchRoyaleGame = lazy(() => import('./pages/live-game/MatchRoyaleGame'));
const LiveFantasyGame = lazy(() => import('./pages/live-game/LiveFantasyGame'));
import { OnboardingFlow } from './components/OnboardingFlow';
import { isBefore, parseISO, differenceInHours } from 'date-fns';
import { TicketWalletModal } from './components/TicketWalletModal';
import { SpinwheelModal } from './components/funzone/SpinwheelModal';
import { LiveGameModal } from './components/modals/LiveGameModal';
import { createLiveGame as createLiveGameSupabase, getGameByFixture as getLiveGameByFixture, getMyMatchModes, MatchModes } from './services/liveGameService';
import { claimPremiumDaily } from './services/premiumService';
import { configurePurchases } from './services/premiumPurchaseService';
import { NotificationCenter } from './components/notifications/NotificationCenter';
import FanPulsePage from './pages/FanPulsePage';
import { PremiumModal } from './components/premium/PremiumModal';
import { CoinShopModal } from './components/shop/CoinShopModal';
import { ResultsModal } from './components/modals/ResultsModal';
import { BetHistoryPage } from './pages/BetHistoryPage';
import { MatchStatsDrawer } from './components/matches/stats/MatchStatsDrawer';
import { EmptyState } from './components/EmptyState';
import { DailyStreakModal } from './components/streaks/DailyStreakModal';
import { ContextualPremiumPrompt } from './components/premium/ContextualPremiumPrompt';
import { useActivityTracker } from './hooks/useActivityTracker';
import { useAuth } from './contexts/AuthContext';
import { useChallengesCatalog } from './features/challenges/useChallengesCatalog';
import { useGamePending } from './features/challenges/useGamePending';
import { useDuelCatalog, duelRaceId } from './features/f1/useDuelCatalog';
import { usePredCatalog, predGameId, seasonGameId } from './features/f1/usePredCatalog';
import { useFantasyCatalog, fantasyGameId } from './features/f1/useFantasyCatalog';
import { F1Duels } from './components/f1/F1Duels';
import { F1Predictor } from './components/f1/F1Predictor';
import { F1SeasonForecast } from './components/f1/F1SeasonForecast';
import { F1Fantasy } from './components/f1/F1Fantasy';
import { F1FanPulsePage } from './pages/F1FanPulsePage';
import { useSquads } from './hooks/useSquads';
import * as squadService from './services/squadService';
import { useMatchBets } from './features/matches/useMatchBets';
import { useChallengeMatches } from './features/challenges/useChallengeMatches';
import { useUserTickets } from './hooks/useUserTickets';
import { completeGuestRegistration } from './services/userService';
import { updateUserProfile } from './services/profileService';
import { joinChallenge as joinChallengeOnSupabase } from './services/challengeService';
import { saveDailyEntry, ensureChallengeEntry } from './services/challengeEntryService';
import { initializeOneSignal, setupOneSignalForUser, logoutOneSignal, setNotificationOpenHandler } from './services/oneSignalService';
import { initAnalytics, identifyUser, resetAnalytics, registerSuperProps } from './services/analytics';
import { EVENTS, trackEvent, trackScreen } from './analytics/events';
import { Capacitor } from '@capacitor/core';
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


export type Page = 'challenges' | 'matches' | 'profile' | 'squads' | 'funzone';
type AuthFlowState = 'guest' | 'authenticated' | 'signing_up' | 'onboarding';

// Placeholder for F1-specific tabs not built yet (Games / Fan Pulse).
function F1ComingSoon({ title }: { title: string }) {
  return (
    <div className="card-base p-8 text-center space-y-2">
      <div className="text-4xl">🏎️</div>
      <div className="text-text-primary font-bold text-lg">{title}</div>
      <div className="text-text-secondary text-sm">Coming soon for Formula 1.</div>
    </div>
  );
}

// Fallback shown while a lazy-loaded page chunk is being fetched.
function PageLoader() {
  return <LogoSpinner />;
}

function App() {
  const [loading, setLoading] = useState(true);
  // True once the app has finished its first load — used to keep background
  // refreshes (e.g. on app resume) from re-showing the full-screen loader.
  const initialLoadDoneRef = useRef(false);
  const premiumClaimedRef = useRef(false);
  const rcConfiguredRef = useRef(false);

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
  const [resultsModal, setResultsModal] = useState<{ isOpen: boolean; fixtureId: string | null; matchName: string | null }>({ isOpen: false, fixtureId: null, matchName: null });
  // Pick History overlay — hosted here so both Matches (Finished CTA) and Profile can open it.
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyStatsMatch, setHistoryStatsMatch] = useState<Match | null>(null);
  const [dailyStreakData, setDailyStreakData] = useState<{ isOpen: boolean; streakDay: number }>({ isOpen: false, streakDay: 0 });
  const [contextualPrompt, setContextualPrompt] = useState<{ type: ContextualPromptType; isOpen: boolean } | null>(null);

  const [page, setPage] = useState<Page>('matches');
  const { sport, setSport } = useSport();
  const [matches, setMatches] = useState<Match[]>(mockMatches);
  // `bets` now comes from useMatchBets (persisted); see below.
  const [modalState, setModalState] = useState<{ isOpen: boolean; match: Match | null; prediction: 'teamA' | 'draw' | 'teamB' | null; odds: number; }>({ isOpen: false, match: null, prediction: null, odds: 0 });

  // --- Game Modal States ---
  const [liveGameModalState, setLiveGameModalState] = useState<{ isOpen: boolean; matchId: string | null; matchName: string | null; isLoading: boolean; }>({ isOpen: false, matchId: null, matchName: null, isLoading: false });
  const [mrForMatch, setMrForMatch] = useState<{ id: string; pot_amount: number | null } | null>(null);
  const [openMRGame, setOpenMRGame] = useState<string | null>(null);
  const [lfForMatch, setLfForMatch] = useState<{ id: string } | null>(null);
  const [matchModes, setMatchModes] = useState<MatchModes | null>(null);
  const [openLFGame, setOpenLFGame] = useState<string | null>(null);

  // --- Active Live Game (Supabase) ---
  const [activeLiveGameSupabase, setActiveLiveGameSupabase] = useState<{
    id: string;
    fixtureId: string;
    mode: 'free' | 'ranked';
  } | null>(null);
  const [showLiveGames, setShowLiveGames] = useState(false);

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

  const { user: authUser, profile: authProfile, isLoading: authLoading, ensureGuest, signOut: supabaseSignOut, refreshProfile: reloadProfile, sendMagicLink, requestSignupOtp, verifySignupOtp } = useAuth();

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

  const { duelGames, duelJoinedIds, refreshDuels } = useDuelCatalog(profile?.id ?? null);
  const { predGames, predJoinedIds, refreshPred } = usePredCatalog(profile?.id ?? null);
  const { fantasyGames, fantasyJoinedIds, refreshFantasy } = useFantasyCatalog(profile?.id ?? null);
  const games = shouldUseSupabaseChallenges ? supabaseGames : mockGames;
  // F1 "Games" universe — same Browse/My Games UI as football, fed with the F1 games (duels + predictor + fantasy).
  const f1Games = useMemo(() => [...duelGames, ...predGames, ...fantasyGames], [duelGames, predGames, fantasyGames]);
  const f1JoinedIds = useMemo(() => new Set<string>([...duelJoinedIds, ...predJoinedIds, ...fantasyJoinedIds]), [duelJoinedIds, predJoinedIds, fantasyJoinedIds]);
  const f1MyGamesCount = useMemo(
    () => f1Games.filter((g) => f1JoinedIds.has(g.id) && (g.status === 'Upcoming' || g.status === 'Ongoing')).length,
    [f1Games, f1JoinedIds],
  );
  // F1 "action needed": an upcoming race game the user hasn't played yet (joining = picking).
  const f1PendingIds = useMemo(
    () => new Set(f1Games.filter((g) => g.status === 'Upcoming' && !f1JoinedIds.has(g.id)).map((g) => g.id)),
    [f1Games, f1JoinedIds],
  );
  const [duelRace, setDuelRace] = useState<{ id: number; raceAt: string | null; name: string } | null>(null);
  const [predOpen, setPredOpen] = useState<{ id: string; name: string } | null>(null);
  const [seasonOpen, setSeasonOpen] = useState<{ id: string; name: string } | null>(null);
  const [fantasyOpen, setFantasyOpen] = useState<{ id: string; name: string } | null>(null);
  const handlePlayFantasyF1 = useCallback((game: any) => {
    const gid = fantasyGameId(game.id);
    if (gid != null) setFantasyOpen({ id: gid, name: game.name });
  }, []);
  const handlePlayDuel = useCallback((game: any) => {
    const rid = duelRaceId(game.id);
    if (rid == null) return;
    setDuelRace({ id: rid, raceAt: game.end_date ?? null, name: game.name });
  }, []);
  const handlePlayPredictor = useCallback((game: any) => {
    const seasonId = seasonGameId(game.id);
    if (seasonId != null) { setSeasonOpen({ id: seasonId, name: game.name }); return; }
    const gid = predGameId(game.id);
    if (gid == null) return;
    setPredOpen({ id: gid, name: game.name });
  }, []);
  const userChallengeEntries = shouldUseSupabaseChallenges ? supabaseChallengeEntries : mockUserChallengeEntries;
  const userSwipeEntries = shouldUseSupabaseChallenges ? supabaseSwipeEntries : mockUserSwipeEntries;
  const userFantasyTeams = shouldUseSupabaseChallenges ? supabaseFantasyTeams : mockUserFantasyTeams;

  // Games awaiting a user action (pick/lineup before deadline) → footer + card badges.
  const pendingGameIds = useGamePending(games, joinedChallengeSet, userChallengeEntries, userSwipeEntries, userFantasyTeams, profile?.id ?? null);

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

    // Guest upgraded IN PLACE: the auth email is now the signup email (email_change verified),
    // but the profile row is still a guest → run onboarding to finish (keeps the same account).
    const authEmail = authUser?.email?.toLowerCase() ?? '';
    if (isGuestProfile && needsOnboarding && pendingSignupEmail && authEmail === pendingSignupEmail) {
      if (authFlow !== 'onboarding') { setAuthFlow('onboarding'); setShowSignUpPrompt(false); }
      return;
    }

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
  }, [profile, pendingSignupEmail, pendingSignupMode, authFlow, authUser]);

  // ✅ Auto-track user activity for XP calculation
  useActivityTracker(isGuest ? null : (profile?.id || null));

  // ✅ Initialize OneSignal + PostHog on app load
  useEffect(() => {
    initAnalytics();
    registerSuperProps({ platform: Capacitor.getPlatform() });
    CapApp.getInfo().then(i => registerSuperProps({ app_version: i.version })).catch(() => {});
    trackEvent(EVENTS.SESSION_STARTED, { resumed: false });
    if (USE_SUPABASE) initializeOneSignal();
  }, []);

  // Screen views — fire on top-level page changes (with the previous screen).
  const prevScreenRef = useRef<string | null>(null);
  useEffect(() => {
    trackScreen(page, prevScreenRef.current ?? undefined);
    prevScreenRef.current = page;
  }, [page]);

  // Premium paywall view (funnel entry).
  useEffect(() => { if (isPremiumModalOpen) trackEvent(EVENTS.PAYWALL_VIEWED, {}); }, [isPremiumModalOpen]);

  // ✅ Setup OneSignal + identify the user in analytics, for authenticated users
  useEffect(() => {
    if (!USE_SUPABASE || !profile || isGuest) return;
    {
      const sports = (profile.sports ?? ['football', 'f1']) as string[];
      identifyUser(profile.id, {
        username: profile.username ?? undefined,
        user_type: profile.user_type,
        is_premium: !!profile.is_subscriber,
        signup_date: profile.created_at,
        level: profile.current_level ?? profile.level,
        follows_football: sports.includes('football'),
        follows_f1: sports.includes('f1'),
        favourite_club: profile.favorite_club ?? undefined,
      });
      registerSuperProps({ is_premium: !!profile.is_subscriber });
    }
    setupOneSignalForUser(profile.id).catch(err =>
      console.error('[App] Failed to setup OneSignal for user:', err)
    );
    // B5a — persist the user's timezone for the orchestrator's quiet-hours. Segmentation is
    // DB-driven (OneSignal's free plan caps data tags), so audiences are computed from our own
    // tables (sports, favourites, premium, dormancy, picks) and targeted by external_id.
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      // Persist tz (quiet-hours) + last_active_at (powers the reactivation ladder).
      if (supabase) supabase.from('users')
        .update({ ...(tz ? { timezone: tz } : {}), last_active_at: new Date().toISOString() })
        .eq('id', profile.id).then(() => {}, () => {});
    } catch { /* no Intl */ }
  }, [profile?.id, isGuest]);

  // ✅ Get notifications unread count (only for authenticated users)
  const { unreadCount: supabaseUnreadCount, refetch: refetchUnreadNotifs } = useNotifications(
    USE_SUPABASE && !isGuest ? profile?.id : null
  );

  const { initializeUserSpinState, updateUserSpinState } = useSpinStore();
  const headerSpinState = useSpinStore(state => profile ? state.userSpinStates[profile.id] : null);
  const freeSpinReady = !!profile && !isGuest && (!headerSpinState?.lastFreeSpinAt || Date.now() - new Date(headerSpinState.lastFreeSpinAt).getTime() >= 24 * 3600 * 1000);

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
  const [activeTournamentId, setActiveTournamentId] = useState<string | null>(null);
  const [activeLiveGame, setActiveLiveGame] = useState<{ id: string; status: 'Upcoming' | 'Ongoing' | 'Finished' } | null>(null);
  const [boosterInfoPreferences, setBoosterInfoPreferences] = useState<{ x2: boolean, x3: boolean }>(() => {
    try { const s = localStorage.getItem('boosterInfoPreferences'); if (s) return JSON.parse(s); } catch { /* ignore */ }
    return { x2: false, x3: false };
  });
  const [challengeToJoin, setChallengeToJoin] = useState<SportimeGame | null>(null);
  const [masterpassTiers, setMasterpassTiers] = useState<Set<string>>(new Set());
  const [masterpassInvite, setMasterpassInvite] = useState<{ inviteId: string; token: string } | null>(null);
  const [claimToken, setClaimToken] = useState<string | null>(null);
  const [pendingInvites, setPendingInvites] = useState<Record<string, { inviteId: string; token: string }>>({});
  useEffect(() => {
    if (!profile) { setMasterpassTiers(new Set()); setPendingInvites({}); return; }
    getAvailableMasterpasses().then(mps => setMasterpassTiers(new Set(mps.map(m => m.tier)))).catch(() => {});
    getMyPendingInvites().then(setPendingInvites).catch(() => {});
  }, [profile?.id]);
  const reopenInvite = (gameId: string) => { const inv = pendingInvites[gameId]; if (inv) setMasterpassInvite(inv); };

  // B1 — deep-link router entry points: cold-start launch URL, warm appUrlOpen, and
  // notification clicks (route carried in OneSignal data.route). All funnel to resolveRoute.
  const resolveRouteRef = useRef<(url: string) => void>(() => {});
  useEffect(() => {
    let sub: any;
    (async () => {
      try {
        sub = await CapApp.addListener('appUrlOpen', ({ url }: { url: string }) => { trackEvent(EVENTS.DEEPLINK_OPENED, { route: url }); resolveRouteRef.current(url); });
        const launch = await CapApp.getLaunchUrl();
        if (launch?.url) resolveRouteRef.current(launch.url);
      } catch { /* not native */ }
    })();
    setNotificationOpenHandler((route, notifKey) => {
      trackEvent(EVENTS.NOTIF_OPENED, { notif_key: notifKey, route });
      if (notifKey && supabase) supabase.rpc('mark_notif_opened', { p_notif_key: notifKey }).then(() => {}, () => {});
      if (route) resolveRouteRef.current(route);
    });
    return () => { try { sub?.remove?.(); } catch { /* ignore */ } };
  }, []);

  const confirmClaimMasterpass = async () => {
    if (!claimToken) return;
    if (!profile || isGuest) { setClaimToken(null); handleTriggerSignUp(); return; }
    const res: any = await claimMasterpassInvite(claimToken);
    setClaimToken(null);
    if (!res?.ok) { addToast(res?.error === 'already_used' ? 'This invite was already used' : (res?.error || 'Could not join'), 'error'); return; }
    addToast('Joined! 🎉 Good luck!', 'success');
    await refreshChallenges();
    if (res.game_type === 'tournament') handleViewTournament(res.game_id);
    else if (res.game_type === 'fantasy') handleViewFantasyGame(res.game_id);
    else setActiveChallengeId(res.game_id);
  };
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
      const fixtureId = liveGameModalState.matchId;
      // You can only join a live prediction once. If you already have a (non-finished)
      // game for this fixture, open THAT one (it shows your existing prediction) instead
      // of creating/joining another — same behaviour as opening it from the Live tab.
      if (supabase && profile) {
        const { data: myGames } = await supabase.rpc('get_user_live_games', { p_user_id: profile.id });
        const mine = (Array.isArray(myGames) ? myGames : []).find((g: any) => g.fixture_id === fixtureId && g.status !== 'finished');
        if (mine) {
          setActiveLiveGameSupabase({ id: mine.id, fixtureId: mine.fixture_id, mode: (mine.mode as 'free' | 'ranked') ?? 'free' });
          return;
        }
      }

      const cost = mode === 'ranked' ? (entryCost ?? 1000) : 0;
      // Players who join the same match compete together: reuse an existing
      // (non-finished) game for this fixture instead of creating a duplicate.
      const existing = await getLiveGameByFixture(fixtureId).catch(() => null);
      const reuse = !!(existing && existing.status !== 'finished');
      const game = reuse
        ? existing
        : await createLiveGameSupabase({ fixtureId, mode, entryCost: cost });

      if (game) {
        addToast(reuse ? 'Joined the game!' : `${mode === 'free' ? 'Free' : 'Stakes'} game created!`, 'success');
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
    // Hydrate the store with the REAL spin counts/cooldown (otherwise Profile + Header
    // show the hardcoded defaults from initializeUserSpinState).
    if (!isGuest) getUserSpinState(profile.id).then(s => updateUserSpinState(profile.id, s)).catch(() => {});

    // RevenueCat: identify the user for purchases (no-op until the plugin is installed/configured).
    if (!isGuest && !rcConfiguredRef.current) {
      rcConfiguredRef.current = true;
      configurePurchases(profile.id).catch(() => {});
    }

    // Premium: claim today's perks (coins + spins) once per session. Idempotent per day server-side.
    if (!isGuest && profile.is_subscriber && !premiumClaimedRef.current) {
      premiumClaimedRef.current = true;
      claimPremiumDaily().then(r => {
        if (r.ok && !r.already && ((r.coins ?? 0) > 0 || (r.spins ?? 0) > 0 || (r.tickets ?? 0) > 0)) {
          const parts = [
            (r.coins ?? 0) > 0 ? `+${r.coins} coins` : null,
            (r.spins ?? 0) > 0 ? `+${r.spins} spin` : null,
            (r.tickets ?? 0) > 0 ? `+${r.tickets} ticket` : null,
          ].filter(Boolean);
          addToast(`Premium daily: ${parts.join(' · ')} 🎁`, 'success');
        }
      }).catch(() => {});
    }

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
  }, [profile, isGuest, initializeUserSpinState, updateUserSpinState, challengesLoading, shouldUseSupabaseChallenges]);

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
      // Upgrades the current guest in place (keeps coins/picks) when the email is new;
      // falls back to signing into an existing account if the email is already registered.
      const message = await requestSignupOtp(normalizedEmail);
      setPendingSignupEmail(normalizedEmail);
      setPendingSignupMode('signin');
      addToast('Code sent! Check your email.', 'success');
      return message;
    } catch (error: any) {
      console.error('[App] Failed to send magic link', error);
      const errorMessage = error?.message || 'Unable to send magic link. Please try again.';
      addToast(errorMessage, 'error');
      throw error;
    }
  };

  const handleSignOut = async () => {
    resetAnalytics();
    logoutOneSignal();
    await supabaseSignOut();
    setPendingSignupEmail(null);
    setPendingSignupMode(null);
    setAuthFlow('guest');
    setShowSignUpPrompt(false);
    setCurrentUserId(null);
    setPage('challenges');
    addToast('You have been signed out.', 'info');
  };

  const handleUpdateProfile = async (updatedData: { username: string; displayName: string; newProfilePic: File | null; sports?: string[]; }) => {
    if (!profile || isGuest) return;
    addToast('Updating profile...', 'info');

    try {
      const payload: {
        username: string;
        displayName: string;
        sports?: string[];
      } = {
        username: updatedData.username,
        displayName: updatedData.displayName,
      };

      if (updatedData.sports !== undefined) {
        payload.sports = updatedData.sports;
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

      trackEvent(EVENTS.SIGNUP_COMPLETED, { method: pendingSignupMode ?? 'email' });
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
      trackEvent(EVENTS.PICK_PLACED, {
        fixture_id: modalState.match.id,
        prediction, stake: amount, odds: safeOdds, sport: 'football',
        league_id: modalState.match.meta?.leagueId,
        is_first_pick: bets.length === 0,
      });
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
    try { localStorage.setItem('boosterInfoPreferences', JSON.stringify(newPrefs)); } catch { /* ignore */ }
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
    await joinSwipeGame(game, 'coins', () => setJoinSwipeGameModalState({ isOpen: false, game: null }));
  };

  // Handle joining swipe game with ticket / coins / masterpass (server-validated)
  const handleConfirmJoinSwipeGameWithMethod = async (game: Game, method: 'coins' | 'ticket' | 'masterpass') => {
    if (method === 'masterpass') {
      setSwipeGameToJoin(null);
      const res = await useMasterpass('prediction', game.id);
      if (!(res as any)?.ok) { addToast((res as any)?.error === 'no_masterpass' ? 'No MasterPass for this tier' : ((res as any)?.error || 'Failed'), 'error'); return; }
      await refreshChallenges();
      setMasterpassInvite({ inviteId: (res as any).invite_id, token: (res as any).token });
      return;
    }
    await joinSwipeGame(game, method, () => setSwipeGameToJoin(null));
  };

  // Shared join routine: the server (join_swipe_challenge) validates eligibility,
  // deducts coins / consumes the ticket; the client just reflects the result.
  const joinSwipeGame = async (game: Game, method: 'coins' | 'ticket', closeModal: () => void) => {
    if (!profile || isGuest) return;
    try {
      const { joinSwipeChallenge } = await import('./services/swipeGameService');
      const result = await joinSwipeChallenge(game.id, profile.id, method);
      if (result.ineligible) {
        addToast(result.ineligible, 'error');
        return;
      }
      if (result.alreadyJoined) {
        addToast(`You've already joined "${game.name}"!`, 'info');
      } else {
        const methodText = method === 'ticket' ? 'ticket' : `${game.entry_cost} coins`;
        addToast(`Successfully joined "${game.name}" using ${methodText}!`, 'success');
      }
      await reloadProfile();
      closeModal();
      setSwipeGameViewMode('swiping');
      setActiveSwipeGameId(game.id);
    } catch (err: any) {
      addToast(err.message || 'Failed to join game', 'error');
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

  const handleViewTournament = async (competitionId: string) => {
    if (!profile || isGuest) { handleTriggerSignUp(); return; }
    setActiveTournamentId(competitionId);
    // Create the entry (free quest) so it shows in My Games. Surface failures instead of
    // swallowing them — a silent failure here makes later prediction saves error out.
    const { joinTournament } = await import('./services/tournamentService');
    const { error } = await joinTournament(profile.id, competitionId);
    if (error) addToast(`Could not join the tournament: ${error.message}`, 'error');
    refreshChallenges();
  };
  
  const handleCreateLeague = async (name: string, description: string, image_url: string | null) => {
      if (!profile || isGuest) {
          handleTriggerSignUp();
          return;
      }
      try {
        const squad = await squadService.createSquad(profile.id, {
          name,
          description: description || undefined,
          image_url: image_url || undefined,
        });
        addToast(`Squad "${name}" created!`, 'success');
        setShowCreateLeagueModal(false);
        await refetchSquads();
        setActiveLeagueId(squad.id);
      } catch (e: any) {
        addToast(e?.message || 'Failed to create squad', 'error');
      }
  };

  const handleJoinLeague = async (inviteCode: string) => {
      if (!profile || isGuest) {
          handleTriggerSignUp();
          return;
      }
      try {
        const member = await squadService.joinSquad(profile.id, inviteCode.trim().toUpperCase());
        addToast('Welcome to the squad!', 'success');
        setJoinLeagueCode(null);
        await refetchSquads();
        setActiveLeagueId(member.squad_id);
      } catch (e: any) {
        addToast('Invalid invite code.', 'error');
        setJoinLeagueCode(null);
      }
  };

  const handleLeaveLeague = (leagueId: string) => { /* ... */ };
  const handleDeleteLeague = (leagueId: string) => { /* ... */ };
  const handleUpdateLeagueDetails = (leagueId: string, name: string, description: string, image_url: string | null) => { /* ... */ };
  const handleRemoveLeagueMember = (leagueId: string, userId: string) => { /* ... */ };
  const handleResetInviteCode = (leagueId: string) => { /* ... */ };

  const handleLinkGameToLeague = async (leagueId: string, game: Game) => {
    if (!profile) return;
    try {
      await squadService.linkGameToSquads(game.id, game.game_type, [leagueId], profile.id);
      addToast(`"${game.name}" linked to your squad!`, 'success');
      await refetchActiveSquadGames();
    } catch (e: any) {
      addToast(e?.message || 'Failed to link game', 'error');
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
    try {
      const squad = await squadService.createSquad(profile.id, { name, description: description || undefined });
      await squadService.linkGameToSquads(linkingGame.id, linkingGame.game_type, [squad.id], profile.id);
      await refetchSquads();
      addToast(`Squad "${name}" created and linked successfully! 🎉`, 'success');
      handleCloseLinkGameModals();
    } catch (e: any) {
      addToast(e?.message || 'Failed to create & link', 'error');
    } finally {
      setIsLinkingLoading(false);
    }
  };

  const handleLinkToSelectedLeagues = async (leagueIds: string[]) => {
    if (!linkingGame || !profile) return;
    setIsLinkingLoading(true);
    try {
      await squadService.linkGameToSquads(linkingGame.id, linkingGame.game_type, leagueIds, profile.id);
      addToast(`Game linked to ${leagueIds.length} squad${leagueIds.length > 1 ? 's' : ''} ✅`, 'success');
      await refetchActiveSquadGames();
      handleCloseLinkGameModals();
    } catch (e: any) {
      addToast(e?.message || 'Failed to link game', 'error');
    } finally {
      setIsLinkingLoading(false);
    }
  };

  const handleConfirmJoinChallenge = async (challengeId: string, method: 'coins' | 'ticket' | 'masterpass') => {
    if (!profile) return;

    const gameType = challengeToJoin?.game_type;

    // Tournament Quest is a FREE quest — join + open it whatever the entry method,
    // never charging coins/ticket/MasterPass (kept consistent across all paths).
    if (gameType === 'tournament') {
      setChallengeToJoin(null);
      handleViewTournament(challengeId);
      return;
    }

    if (method === 'masterpass') {
      const gt = (gameType === 'fantasy' ? 'fantasy' : 'betting') as 'fantasy' | 'betting';
      const res = await useMasterpass(gt, challengeId);
      setChallengeToJoin(null);
      if (!(res as any)?.ok) { addToast((res as any)?.error === 'no_masterpass' ? 'No MasterPass for this tier' : ((res as any)?.error || 'Failed to use MasterPass'), 'error'); return; }
      await reloadProfile(); await refreshChallenges();
      setMasterpassInvite({ inviteId: (res as any).invite_id, token: (res as any).token });
      return;
    }

    // Try the fantasy join first: join_fantasy_game (SECURITY DEFINER) authoritatively
    // checks fantasy_games and bypasses RLS. If it's not a fantasy game, it raises
    // 'Fantasy game not found' and we fall through to the betting/challenge join.
    try {
      const { joinFantasyGame } = await import('./services/fantasyService');
      const result = await joinFantasyGame(challengeId, profile.id, method);
      if (result.ineligible) { addToast(result.ineligible, 'error'); return; }
      addToast(result.alreadyJoined ? "You've already joined this game!" : 'Joined! Build your team.', result.alreadyJoined ? 'info' : 'success');
      setChallengeToJoin(null);
      await reloadProfile();
      await refreshChallenges();
      handleViewFantasyGame(challengeId);
      return;
    } catch (err: any) {
      if (err?.message !== 'Fantasy game not found') {
        addToast(err?.message || 'Failed to join', 'error');
        return;
      }
      // Not a fantasy game — continue to the betting/challenge join below.
    }

    if (shouldUseSupabaseChallenges) {
      try {
        const result = await joinChallengeOnSupabase(challengeId, profile.id, method);
        if (result.insufficientCoins) {
          addToast('Not enough coins to join this challenge.', 'error');
          return;
        }
        if (result.ineligible) {
          addToast(result.ineligible, 'error');
          return;
        }

        if (result.alreadyJoined) {
          addToast('You already joined this challenge.', 'info');
        } else {
          await ensureChallengeEntry(challengeId, profile.id, method, null);
          addToast('Challenge joined! Good luck! ⚽', 'success');
        }
        await refreshChallenges();
        trackEvent(EVENTS.GAME_JOINED, { game_id: challengeId, game_type: 'betting', entry_method: method });
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
    const hasMasterpass = masterpassTiers.has(game.tier);

    // Always show the confirmation modal before spending coins / consuming a ticket / masterpass.
    if (validTicket || hasEnoughCoins || hasMasterpass) {
      setChallengeToJoin(game);
    } else {
      addToast("You don't have enough coins, a valid ticket or a MasterPass to join.", 'error');
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
    setActiveTournamentId(null);
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
    setActiveTournamentId(null);
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

  // The user's active live games (upcoming/live) — used to make them linkable to squads.
  const [myLiveGames, setMyLiveGames] = useState<any[]>([]);

  const linkableGames = useMemo(() => {
    const catalog = games.filter(g => g.is_linkable);
    const live = myLiveGames.map((lg: any) => ({
      id: lg.id,
      name: `${lg.fixture?.homeTeam?.name ?? 'TBD'} vs ${lg.fixture?.awayTeam?.name ?? 'TBD'}`,
      game_type: 'live',
      is_linkable: true,
      status: lg.status === 'live' ? 'Ongoing' : lg.status === 'finished' ? 'Finished' : 'Upcoming',
      sport: 'football',
    }));
    return [...catalog, ...(live as any[])] as typeof games;
  }, [games, myLiveGames]);

  // Squads (real, Supabase) — replaces the mock leagues for list/create/join.
  const { squads: realSquads, refetch: refetchSquads, isLoading: squadsLoading } = useSquads(profile?.id ?? null);
  const myLeagues = realSquads as unknown as typeof userLeagues;
  // Any squad I belong to can have games linked (the RPC validates membership).
  const myAdminLeagues = realSquads as unknown as typeof userLeagues;

  // Members + linked games (catalog + live) of the squad currently open (real).
  const [activeSquadMembers, setActiveSquadMembers] = useState<any[]>([]);
  const [activeSquadGames, setActiveSquadGames] = useState<any[]>([]);
  const [activeSquadLiveGames, setActiveSquadLiveGames] = useState<any[]>([]);
  const refetchActiveSquadGames = useCallback(async () => {
    if (!activeLeagueId) { setActiveSquadGames([]); setActiveSquadLiveGames([]); return; }
    try { setActiveSquadGames(await squadService.getSquadGames(activeLeagueId)); } catch { setActiveSquadGames([]); }
    try { setActiveSquadLiveGames(await squadService.getSquadLiveGames(activeLeagueId)); } catch { setActiveSquadLiveGames([]); }
  }, [activeLeagueId]);
  useEffect(() => {
    if (!activeLeagueId) { setActiveSquadMembers([]); setActiveSquadGames([]); setActiveSquadLiveGames([]); return; }
    let cancelled = false;
    squadService.getSquadMembers(activeLeagueId)
      .then(m => { if (!cancelled) setActiveSquadMembers(m); })
      .catch(() => { if (!cancelled) setActiveSquadMembers([]); });
    squadService.getSquadGames(activeLeagueId)
      .then(g => { if (!cancelled) setActiveSquadGames(g); })
      .catch(() => { if (!cancelled) setActiveSquadGames([]); });
    squadService.getSquadLiveGames(activeLeagueId)
      .then(g => { if (!cancelled) setActiveSquadLiveGames(g); })
      .catch(() => { if (!cancelled) setActiveSquadLiveGames([]); });
    return () => { cancelled = true; };
  }, [activeLeagueId]);

  // Fetch the user's active live games (state declared above) for squad linking.
  useEffect(() => {
    if (!profile?.id || isGuest) { setMyLiveGames([]); return; }
    let cancelled = false;
    import('./services/liveGameService')
      .then(s => s.getUserActiveGames(profile.id))
      .then(g => { if (!cancelled) setMyLiveGames(g); })
      .catch(() => { if (!cancelled) setMyLiveGames([]); });
    return () => { cancelled = true; };
  }, [profile?.id, isGuest]);
  
  // Linked games of the active squad, resolved to the shape LeaguePage expects.
  const resolvedActiveSquadGames = useMemo(() => {
    const typeMap: Record<string, string> = { fantasy: 'Fantasy', prediction: 'Prediction', betting: 'Betting', live: 'Live' };
    return activeSquadGames.map((sg: any) => {
      const g = (games as any[]).find(x => x.id === sg.game_id);
      return {
        id: sg.id,
        league_id: sg.squad_id,
        game_id: sg.game_id,
        game_name: g?.name ?? 'Game',
        type: typeMap[sg.game_type] ?? 'Betting',
      };
    });
  }, [activeSquadGames, games]);

  const handleUnlinkSquadGame = useCallback(async (gameId: string) => {
    if (!profile || !activeLeagueId) return;
    try {
      await squadService.unlinkGame(activeLeagueId, gameId, profile.id);
      await refetchActiveSquadGames();
    } catch (e: any) {
      addToast(e?.message || 'Failed to unlink', 'error');
    }
  }, [profile, activeLeagueId, refetchActiveSquadGames]);

  // Squad member administration.
  const refetchActiveSquadMembers = useCallback(async () => {
    if (!activeLeagueId) return;
    try { setActiveSquadMembers(await squadService.getSquadMembers(activeLeagueId)); } catch { /* keep */ }
  }, [activeLeagueId]);
  const mapSquadAdminError = (e: any): string => {
    const m = e?.message;
    if (m === 'not_admin') return 'Admins only';
    if (m === 'cannot_target_creator') return "You can't manage the squad owner";
    return m || 'Action failed';
  };
  const handleSetMemberRole = useCallback(async (userId: string, role: 'admin' | 'member') => {
    if (!profile || !activeLeagueId) return;
    try {
      await squadService.setMemberRoleRpc(activeLeagueId, userId, role, profile.id);
      await refetchActiveSquadMembers();
      addToast(role === 'admin' ? 'Promoted to admin' : 'Admin rights removed', 'success');
    } catch (e: any) { addToast(mapSquadAdminError(e), 'error'); }
  }, [profile, activeLeagueId, refetchActiveSquadMembers]);
  const handleKickMember = useCallback(async (userId: string) => {
    if (!profile || !activeLeagueId) return;
    try {
      await squadService.kickMember(activeLeagueId, userId, profile.id);
      await refetchActiveSquadMembers();
      addToast('Member removed', 'success');
    } catch (e: any) { addToast(mapSquadAdminError(e), 'error'); }
  }, [profile, activeLeagueId, refetchActiveSquadMembers]);
  const handleBlockMember = useCallback(async (userId: string) => {
    if (!profile || !activeLeagueId) return;
    try {
      await squadService.blockMember(activeLeagueId, userId, profile.id);
      await refetchActiveSquadMembers();
      addToast('Member blocked', 'success');
    } catch (e: any) { addToast(mapSquadAdminError(e), 'error'); }
  }, [profile, activeLeagueId, refetchActiveSquadMembers]);

  const ticketCount = useMemo(() => {
    if (!profile) return 0;
    return userTickets.filter(t => 
        t.user_id === profile.id && 
        !t.is_used && 
        isBefore(new Date(), parseISO(t.expires_at))
    ).length;
  }, [userTickets, profile]);

  const handlePlayGameClick = async (matchId: string, matchName: string) => {
    // If the user already joined a live game for this fixture, re-open it directly
    // so they can find their prediction again — instead of the create modal.
    if (profile && !isGuest && supabase) {
      try {
        const existing = await getLiveGameByFixture(matchId);
        if (existing && existing.status !== 'finished') {
          const { data } = await supabase.rpc('get_live_game_state', { p_game_id: existing.id });
          const joined = ((data as any)?.entries || []).some((e: any) => e.user_id === profile.id);
          if (joined) {
            setActiveLiveGameSupabase({
              id: existing.id,
              fixtureId: existing.fixtureId,
              mode: existing.mode as 'free' | 'ranked',
            });
            return;
          }
        }
      } catch { /* fall through to the create modal */ }
    }
    setMrForMatch(null); setLfForMatch(null); setMatchModes(null);
    getMRGameByFixture(matchId).then((g: any) => setMrForMatch(g)).catch(() => setMrForMatch(null));
    getLFGameByFixture(matchId).then((g: any) => setLfForMatch(g)).catch(() => setLfForMatch(null));
    if (profile && !isGuest) getMyMatchModes(matchId, profile.id).then(setMatchModes).catch(() => setMatchModes(null));
    setLiveGameModalState({ isOpen: true, matchId, matchName, isLoading: false });
  };

  const unreadNotificationsCount = useMemo(() => {
    // Always use Supabase for notifications (no mock fallback)
    return USE_SUPABASE && !isGuest ? supabaseUnreadCount : 0;
  }, [USE_SUPABASE, isGuest, supabaseUnreadCount]);

  const handleSubscribe = (plan: 'monthly' | 'seasonal') => {
    if (profile) {
      trackEvent(EVENTS.PREMIUM_CTA_CLICKED, { plan });
      subscribeToPremium(profile.id, plan);
      addToast(`Subscribed to ${plan} plan! Premium activated.`, 'success');
      setIsPremiumModalOpen(false);
    }
  };

  // Requested Matches sub-tab from a deep link (consumed by MatchesPage).
  const [matchTab, setMatchTab] = useState<'today' | 'picks' | 'finished' | null>(null);

  // B1 — resolve a sportime:// (or https://sportime.app/) deep link to app state.
  const resolveRoute = useCallback((raw: string) => {
    if (!raw) return;
    try {
      const rest = raw
        .replace(/^sportime:\/\//i, '')
        .replace(/^https?:\/\/sportime\.app\//i, '')
        .replace(/^\/+/, '')
        .split('?')[0];
      const [seg, id] = rest.split('/');
      const auth = () => { if (!profile || isGuest) { handleTriggerSignUp(); return false; } return true; };
      // Most deep links target football screens; if the user is on F1 the page would
      // switch but the content stays F1-filtered. Force the matching sport per route.
      const football = () => setSport('football');
      switch (seg) {
        case '': case 'matches': case 'match': football(); setPage('matches'); setMatchTab('today'); break;
        case 'picks': football(); setPage('matches'); setMatchTab('picks'); break;
        case 'finished': football(); setPage('matches'); setMatchTab('finished'); break;
        case 'games': case 'challenges': football(); setPage('challenges'); break;
        case 'challenge': football(); if (id && auth()) setActiveChallengeId(id); else setPage('challenges'); break;
        case 'swipe': football(); if (id && auth()) setActiveSwipeGameId(id); else setPage('challenges'); break;
        case 'fantasy': football(); if (id && auth()) setActiveFantasyGameId(id); else setPage('challenges'); break;
        case 'tq': football(); if (id && auth()) setActiveTournamentId(id); else setPage('challenges'); break;
        case 'live': football(); if (id && auth()) setActiveLiveGame({ id, status: 'Ongoing' }); else setPage('challenges'); break;
        case 'leaderboard': football(); setPage('challenges'); break;
        case 'squads': case 'squad': setPage('squads'); if (id && id !== 'join') setActiveLeagueId(id); break;
        case 'league': setPage('squads'); break;
        case 'fanpulse': football(); setPage('funzone'); break;
        case 'f1': setSport('f1'); setPage('funzone'); break;
        case 'shop': setIsCoinShopModalOpen(true); break;
        case 'wallet': setPage('profile'); break;
        case 'spin': if (auth()) handleOpenSpinWheel((id as SpinTier) || 'free'); break;
        case 'premium': setIsPremiumModalOpen(true); break;
        case 'profile': setPage('profile'); if (id === 'history') setHistoryOpen(true); break;
        case 'masterpass': case 'i': if (id) setClaimToken(id); break;
        default: setPage('matches');
      }
    } catch (e) { console.warn('[deeplink] resolve failed', raw, e); }
  }, [profile, isGuest, handleTriggerSignUp, handleOpenSpinWheel, setSport]);
  useEffect(() => { resolveRouteRef.current = resolveRoute; }, [resolveRoute]);

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
        return <PageLoader />;
      }

      const challenge = games.find(c => c.id === activeChallengeId && c.game_type === 'betting');
      if (challenge && profile) {
        const matchesForChallenge = USE_SUPABASE
          ? activeChallengeMatches
          : mockChallengeMatches.filter(m => m.challengeId === activeChallengeId);

        // Wait for matches to be loaded before creating user entry
        if (USE_SUPABASE && matchesForChallenge.length === 0 && !activeChallengeMatchesLoading) {
          // Matches loaded but empty
          return (
            <EmptyState
              glyph="⚽"
              title="No matches yet"
              subtitle="This game's fixtures haven't been set yet. Check back soon."
              cta={{ label: '← Back to Games', onClick: () => setActiveChallengeId(null) }}
            />
          );
        }

        const existingEntry = userChallengeEntries.find(e => e.challengeId === activeChallengeId && e.user_id === profile.id);

        // If existingEntry has empty dailyEntries but we have matches, regenerate dailyEntries
        let userEntry = existingEntry;
        if (existingEntry && existingEntry.dailyEntries.length === 0 && matchesForChallenge.length > 0) {
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
          addToast={addToast}
        />
      );
    }

    if (activeTournamentId && profile) {
      return <Suspense fallback={<PageLoader />}>
        <TournamentQuestPage competitionId={activeTournamentId} userId={profile.id} onBack={() => setActiveTournamentId(null)} />
      </Suspense>;
    }

    if (activeFantasyGameId) {
      const game = games.find(g => g.id === activeFantasyGameId && g.game_type === 'fantasy');
      if (game && profile && !(game as FantasyGame).gameWeeks?.length) {
        return (
          <EmptyState
            glyph="📅"
            title="No game weeks yet"
            subtitle="This Fantasy game has no game weeks set up. Check back soon."
            cta={{ label: '← Back to Games', onClick: () => setActiveFantasyGameId(null) }}
          />
        );
      }
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
          addToast={addToast}
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
        const league = (realSquads as any[]).find(l => l.id === activeLeagueId);
        if (league && profile) {
            const membersOfLeague = activeSquadMembers.map((m: any) => ({
              league_id: league.id,
              user_id: m.user_id,
              role: m.role,
            }));
            const memberProfiles = activeSquadMembers.map((m: any) => ({
              id: m.user?.id ?? m.user_id,
              username: m.user?.username ?? 'Player',
              profile_picture_url: m.user?.profile_picture_url ?? null,
              level_name: m.user?.level_name,
              xp_total: m.user?.xp_total,
            })) as unknown as Profile[];
            const currentUserMembership = activeSquadMembers.find((m: any) => m.user_id === profile.id);
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
                onLinkGame={handleLinkGameToLeague}
                onUnlinkGame={handleUnlinkSquadGame}
                onSetMemberRole={handleSetMemberRole}
                onKickMember={handleKickMember}
                onBlockMember={handleBlockMember}
                addToast={addToast}
                linkedLiveGames={activeSquadLiveGames as any}
                leagueGames={resolvedActiveSquadGames as any}
                allGames={games}
                linkableGames={linkableGames}
            />;
        }
    }

    switch (page) {
      case 'matches':
        // F1 universe → Races; football → the existing Matches page.
        return (
          <ErrorBoundary>
            {sport === 'f1'
              ? <RacesPage />
              : <MatchesPage matches={matches} bets={bets} onBet={handleBetClick} onPlayGame={handlePlayGameClick} onViewResults={(fixtureId, matchName) => setResultsModal({ isOpen: true, fixtureId, matchName })} onBrowseGames={() => handlePageChange('challenges')} onOpenHistory={() => setHistoryOpen(true)} requestedTab={matchTab} onTabConsumed={() => setMatchTab(null)} />}
          </ErrorBoundary>
        );
      case 'challenges':
        if (sport === 'f1') return <GamesListPage games={f1Games} userChallengeEntries={[]} userSwipeEntries={[]} userFantasyTeams={[]} onJoinChallenge={() => {}} onViewChallenge={() => {}} onJoinSwipeGame={() => {}} onPlaySwipeGame={() => {}} onViewFantasyGame={() => {}} onViewTournament={() => {}} onPlayDuel={handlePlayDuel} onPlayPredictor={handlePlayPredictor} onPlayFantasyF1={handlePlayFantasyF1} joinedGameIds={f1JoinedIds} myGamesCount={f1MyGamesCount} profile={profile} userTickets={userTickets} isLoading={false} onRefresh={() => { refreshDuels(); refreshPred(); refreshFantasy(); }} />;
        return <GamesListPage games={games} userChallengeEntries={userChallengeEntries} userSwipeEntries={userSwipeEntries} userFantasyTeams={userFantasyTeams} onJoinChallenge={handleJoinChallenge} onViewChallenge={setActiveChallengeId} onJoinSwipeGame={handleJoinSwipeGame} onPlaySwipeGame={handlePlaySwipeGame} onViewFantasyGame={handleViewFantasyGame} onViewTournament={handleViewTournament} joinedGameIds={joinedChallengeSet} myGamesCount={myGamesCount} profile={profile} userTickets={userTickets} isLoading={challengesLoading} onRefresh={refreshChallenges} onShowLiveGames={() => setShowLiveGames(true)} pendingInviteGameIds={new Set(Object.keys(pendingInvites))} onReopenInvite={reopenInvite} pendingGameIds={pendingGameIds} />;
      case 'squads':
          return <LeaguesListPage
              leagues={realSquads}
              isLoading={squadsLoading}
              onCreate={() => setShowCreateLeagueModal(true)}
              onViewLeague={setActiveLeagueId}
              onJoin={handleJoinLeague}
              onRefresh={refetchSquads}
          />;
      case 'funzone':
        if (sport === 'f1') return <F1FanPulsePage profile={profile} />;
        return <FanPulsePage profile={profile} />;
      case 'profile':
        if (profile && !isGuest) {
          // Use Supabase streak data if available, fallback to mock for guests/errors
          const profileStreaks = supabaseStreak ? [supabaseStreak] : userStreaks;
          return <ProfilePage profile={profile} levels={levelsConfig} allBadges={badges} userBadges={userBadges} userStreaks={profileStreaks} onUpdateProfile={handleUpdateProfile} onUpdateEmail={handleUpdateEmail} onSignOut={handleSignOut} onDeleteAccount={handleDeleteAccount} onOpenSpinWheel={handleOpenSpinWheel} onOpenPremiumModal={() => setIsPremiumModalOpen(true)} onGoToShop={() => setIsCoinShopModalOpen(true)} onOpenHistory={() => setHistoryOpen(true)} />;
        }
        return null;
      default:
        return <GamesListPage games={games} userChallengeEntries={userChallengeEntries} userSwipeEntries={userSwipeEntries} userFantasyTeams={userFantasyTeams} onJoinChallenge={handleJoinChallenge} onViewChallenge={setActiveChallengeId} onJoinSwipeGame={handleJoinSwipeGame} onPlaySwipeGame={handlePlaySwipeGame} onViewFantasyGame={handleViewFantasyGame} onViewTournament={handleViewTournament} joinedGameIds={joinedChallengeSet} myGamesCount={myGamesCount} profile={profile} userTickets={userTickets} isLoading={challengesLoading} onRefresh={refreshChallenges} onShowLiveGames={() => setShowLiveGames(true)} pendingInviteGameIds={new Set(Object.keys(pendingInvites))} onReopenInvite={reopenInvite} pendingGameIds={pendingGameIds} />;
    }
  }
  
  const userBetForModal = modalState.match ? bets.find(b => b.matchId === modalState.match!.id) : undefined;
  const currentBetLimit = useMemo(() => getLevelBetLimit(profileLevel), [profileLevel]);

  if (loading) {
    return <div className="min-h-screen bg-deep-navy"><LogoSpinner fullscreen size={72} /></div>;
  }

  if (authFlow === 'signing_up' || joinLeagueCode && profile?.is_guest) {
    return <SignUpStep onMagicLinkSent={handleMagicLinkSent} onVerifyOtp={verifySignupOtp} onBack={handleCancelSignUp} />;
  }
  if (authFlow === 'onboarding' && profile) {
    return <OnboardingPage profile={profile} onComplete={handleCompleteOnboarding} />;
  }

  // Show Live Game Lobby if active
  if (activeLiveGameSupabase && profile) {
    return (
      <Suspense fallback={<PageLoader />}>
        <LiveScorePredictionGame
          gameId={activeLiveGameSupabase.id}
          userId={profile.id}
          onBack={() => setActiveLiveGameSupabase(null)}
        />
      </Suspense>
    );
  }

  if (showLiveGames && profile) {
    return (
      <Suspense fallback={<PageLoader />}>
        <LiveGamesListPage
          userId={profile.id}
          onOpenGame={(id, fixtureId, mode) => { setShowLiveGames(false); setActiveLiveGameSupabase({ id, fixtureId, mode }); }}
          onBack={() => setShowLiveGames(false)}
          addToast={addToast}
        />
      </Suspense>
    );
  }

  if (duelRace && profile) {
    return (
      <div className="main-background fixed inset-0 flex flex-col overflow-hidden">
        <div className="flex-shrink-0 w-full max-w-md mx-auto px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 flex items-center gap-2">
          <button onClick={() => { setDuelRace(null); refreshDuels(); }} className="px-2 py-1 text-sm font-semibold text-text-secondary">← Back</button>
          <div className="font-bold text-text-primary truncate">{duelRace.name}</div>
        </div>
        <div className="flex-1 overflow-y-auto w-full max-w-md mx-auto px-4 pb-24">
          <F1Duels gp={{ id: duelRace.id, raceAt: duelRace.raceAt } as any} userId={profile.id} />
        </div>
      </div>
    );
  }

  if (predOpen && profile) {
    return (
      <div className="main-background fixed inset-0 flex flex-col overflow-hidden">
        <div className="flex-shrink-0 w-full max-w-md mx-auto px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 flex items-center gap-2">
          <button onClick={() => { setPredOpen(null); refreshPred(); }} className="px-2 py-1 text-sm font-semibold text-text-secondary">← Back</button>
          <div className="font-bold text-text-primary truncate">{predOpen.name}</div>
        </div>
        <div className="flex-1 overflow-y-auto w-full max-w-md mx-auto px-4 pb-24">
          <F1Predictor gameId={predOpen.id} userId={profile.id} />
        </div>
      </div>
    );
  }

  if (seasonOpen && profile) {
    return (
      <div className="main-background fixed inset-0 flex flex-col overflow-hidden">
        <div className="flex-shrink-0 w-full max-w-md mx-auto px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 flex items-center gap-2">
          <button onClick={() => { setSeasonOpen(null); refreshPred(); }} className="px-2 py-1 text-sm font-semibold text-text-secondary">← Back</button>
          <div className="font-bold text-text-primary truncate">{seasonOpen.name}</div>
        </div>
        <div className="flex-1 overflow-y-auto w-full max-w-md mx-auto px-4 pb-24">
          <F1SeasonForecast gameId={seasonOpen.id} userId={profile.id} />
        </div>
      </div>
    );
  }

  if (fantasyOpen && profile) {
    return (
      <div className="main-background fixed inset-0 flex flex-col overflow-hidden">
        <div className="flex-shrink-0 w-full max-w-md mx-auto px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 flex items-center gap-2">
          <button onClick={() => { setFantasyOpen(null); refreshFantasy(); }} className="px-2 py-1 text-sm font-semibold text-text-secondary">← Back</button>
          <div className="font-bold text-text-primary truncate">{fantasyOpen.name}</div>
        </div>
        <div className="flex-1 overflow-y-auto w-full max-w-md mx-auto px-4 pb-24">
          <F1Fantasy gameId={fantasyOpen.id} userId={profile.id} />
        </div>
      </div>
    );
  }

  // When a game/drill-in takeover is active, the page goes full-screen: the global
  // header, Football/F1 selector and footer nav are CSS-hidden (kept mounted, NOT
  // unmounted — so opening a game stays "mount the page only" and feels instant).
  // These pages bring their own back button.
  const immersiveView = !!(
    viewingLeaderboardFor || activeChallengeId || viewingPredictionChallenge ||
    activeSwipeGameId || viewingSwipeLeaderboardFor || activeTournamentId ||
    activeFantasyGameId || activeLiveGame
  );

  return (
    <div className="main-background fixed inset-0 flex flex-col overflow-hidden">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Fixed top header (profile / coins) — never scrolls. CSS-hidden (not unmounted)
          in immersive game view so opening a game doesn't tear down + rebuild the chrome. */}
      <div className={`flex-shrink-0 w-full max-w-md mx-auto px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 ${immersiveView ? 'hidden' : ''}`}>
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
          freeSpinReady={freeSpinReady}
          onOpenSpin={() => handleOpenSpinWheel('free')}
        />
      </div>

      {/* Sport universe selector (Football / F1) — CSS-hidden in immersive game view */}
      <div className={`flex-shrink-0 w-full max-w-md mx-auto px-4 pb-2 ${immersiveView ? 'hidden' : ''}`}>
        <SportSwitcher badges={{ football: pendingGameIds.size, f1: f1PendingIds.size }} />
      </div>

      {/* Single scroll region for page content */}
      <div id="app-scroll" className="flex-1 overflow-y-auto overscroll-y-contain">
        <div className={`w-full max-w-md mx-auto px-4 space-y-4 ${immersiveView
          ? 'pt-[max(0.75rem,env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))]'
          : 'pb-[calc(4.5rem+env(safe-area-inset-bottom))]'}`}>
          <Suspense fallback={<PageLoader />}>{renderPage()}</Suspense>
        </div>
      </div>

      <div className={immersiveView ? 'hidden' : ''}>
        <FooterNav activePage={page} onPageChange={handlePageChange} gamesBadge={sport === 'f1' ? f1PendingIds.size : pendingGameIds.size} />
      </div>

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
          hasCoins={!!profile && profile.coins_balance >= challengeToJoin.entry_cost}
          hasTicket={!!profile && userTickets.some(t =>
            t.user_id === profile.id &&
            t.type === challengeToJoin.tier &&
            !t.is_used &&
            isBefore(new Date(), parseISO(t.expires_at))
          )}
          hasMasterpass={masterpassTiers.has(challengeToJoin.tier)}
        />
      )}
      {swipeGameToJoin && (
        <ChooseEntryMethodModal
          isOpen={!!swipeGameToJoin}
          onClose={() => setSwipeGameToJoin(null)}
          onSelectMethod={(method) => handleConfirmJoinSwipeGameWithMethod(swipeGameToJoin, method)}
          challenge={swipeGameToJoin}
          hasMasterpass={masterpassTiers.has(swipeGameToJoin.tier)}
        />
      )}
      {masterpassInvite && (
        <MasterpassInviteModal
          isOpen={!!masterpassInvite}
          onClose={() => { setMasterpassInvite(null); getMyPendingInvites().then(setPendingInvites).catch(() => {}); }}
          inviteId={masterpassInvite.inviteId}
          token={masterpassInvite.token}
          addToast={addToast}
        />
      )}
      {claimToken && (
        <MasterpassClaimModal
          isOpen={!!claimToken}
          onClose={() => setClaimToken(null)}
          onConfirm={confirmClaimMasterpass}
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
      <SpinwheelModal
        isOpen={spinWheelState.isOpen}
        onClose={() => setSpinWheelState({ isOpen: false, tier: null })}
        tier={spinWheelState.tier}
        userId={profile.id}
        addToast={addToast}
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
        modes={matchModes}
        matchRoyalePot={mrForMatch?.pot_amount ?? null}
        onPlayMatchRoyale={async () => { const fx = liveGameModalState.matchId; const nm = liveGameModalState.matchName ?? 'Match Royale'; setLiveGameModalState({ isOpen: false, matchId: null, matchName: null, isLoading: false }); let id = mrForMatch?.id ?? null; if (!id && fx) { id = await createMRGame(fx, nm).catch(() => null); if (!id) { addToast('Could not start Match Royale', 'error'); return; } } setOpenMRGame(id); }}
        liveFantasyReady={!!lfForMatch}
        onPlayLiveFantasy={() => { const fx = liveGameModalState.matchId; setLiveGameModalState({ isOpen: false, matchId: null, matchName: null, isLoading: false }); setOpenLFGame(fx); }}
        onNotifyLineups={() => { const fx = liveGameModalState.matchId; setLiveGameModalState({ isOpen: false, matchId: null, matchName: null, isLoading: false }); if (fx) notifyLineups(fx).then(() => addToast("We'll notify you when lineups drop 🔔", 'success')).catch(() => {}); }}
    />
    {openMRGame && profile && (
      <Suspense fallback={<PageLoader />}>
        <MatchRoyaleGame gameId={openMRGame} userId={profile.id} onBack={() => setOpenMRGame(null)} addToast={addToast} />
      </Suspense>
    )}
    {openLFGame && profile && (
      <Suspense fallback={<PageLoader />}>
        <LiveFantasyGame fixtureId={openLFGame} userId={profile.id} onBack={() => setOpenLFGame(null)} addToast={addToast} />
      </Suspense>
    )}
    <NotificationCenter
      isOpen={isNotificationCenterOpen}
      onClose={() => setIsNotificationCenterOpen(false)}
      userId={profile?.id}
      onChanged={refetchUnreadNotifs}
      onNavigate={(link) => resolveRoute(link)}
    />
    <PremiumModal
      isOpen={isPremiumModalOpen}
      onClose={() => setIsPremiumModalOpen(false)}
      onSubscribe={handleSubscribe}
      addToast={addToast}
      onPurchased={() => reloadProfile()}
    />
    {historyOpen && (
      <BetHistoryPage
        bets={bets}
        onClose={() => setHistoryOpen(false)}
        onViewStats={setHistoryStatsMatch}
        onViewResults={(fixtureId, matchName) => setResultsModal({ isOpen: true, fixtureId, matchName })}
      />
    )}
    <MatchStatsDrawer match={historyStatsMatch} onClose={() => setHistoryStatsMatch(null)} />

    <ResultsModal
      isOpen={resultsModal.isOpen}
      onClose={() => setResultsModal({ isOpen: false, fixtureId: null, matchName: null })}
      fixtureId={resultsModal.fixtureId}
      matchName={resultsModal.matchName}
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
