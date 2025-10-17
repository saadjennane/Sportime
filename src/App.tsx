import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Header } from './components/Header';
import { BetModal } from './components/BetModal';
import { FooterNav } from './components/FooterNav';
import { mockMatches } from './data/mockMatches';
import { mockChallengeMatches } from './data/mockChallenges';
import { mockFantasyPlayers, mockUserFantasyTeams } from './data/mockFantasy.tsx';
import { Match, Bet, UserChallengeEntry, ChallengeStatus, DailyChallengeEntry, BoosterSelection, UserSwipeEntry, SwipePredictionOutcome, Profile, LevelConfig, Badge, UserBadge, FantasyPlayer, ChallengeBet, UserLeague, LeagueMember, LeagueGame, Game, PrivateLeagueGameConfig, LiveGamePlayerEntry, UserFantasyTeam, UserTicket, BettingChallenge, SportimeGame, SpinTier, SwipeMatchDay, FantasyGame } from './types';
import UpcomingPage from './pages/Upcoming';
import PlayedPage from './pages/Played';
import AdminPage from './pages/Admin';
import GamesListPage from './pages/GamesListPage';
import ChallengeRoomPage from './pages/ChallengeRoomPage';
import LeaderboardPage from './pages/LeaderboardPage';
import { ChooseEntryMethodModal } from './components/ChooseEntryMethodModal';
import { SwipeGamePage } from './pages/SwipeGamePage';
import { SwipeRecapPage } from './pages/SwipeRecapPage';
import { JoinSwipeGameConfirmationModal } from './components/JoinSwipeGameConfirmationModal';
import SwipeLeaderboardPage from './pages/SwipeLeaderboardPage';
import { supabase } from './lib/supabaseClient';
import { useToast } from './hooks/useToast';
import { ToastContainer } from './components/Toast';
import ProfilePage from './pages/ProfilePage';
import { mockBadges, mockLevelsConfig, mockUserBadges } from './data/mockProgression';
import MatchesPage from './pages/MatchesPage';
import { FantasyGameWeekPage } from './pages/FantasyGameWeekPage';
import { USE_SUPABASE } from './config/env';
import { mockUsers } from './data/mockUsers';
import { OnboardingPage } from './pages/OnboardingPage';
import { SignUpPromptModal } from './components/SignUpPromptModal';
import { SignUpStep } from './pages/onboarding/SignUpStep';
import LeaguesListPage from './pages/LeaguesListPage';
import LeaguePage from './pages/LeaguePage';
import LeagueJoinPage from './pages/LeagueJoinPage';
import { CreateLeagueModal } from './components/leagues/CreateLeagueModal';
import { ConfirmationModal } from './components/leagues/ConfirmationModal';
import { NoLeaguesModal } from './components/leagues/NoLeaguesModal';
import { MiniCreateLeagueModal } from './components/leagues/MiniCreateLeagueModal';
import { SelectLeaguesToLinkModal } from './components/leagues/SelectLeaguesToLinkModal';
import { useMockStore } from './store/useMockStore';
import { useSpinStore } from './store/useSpinStore';
import LiveGameSetupPage from './pages/live-game/LiveGameSetupPage';
import LiveGamePlayPage from './pages/live-game/LiveGamePlayPage';
import LiveGameResultsPage from './pages/live-game/LiveGameResultsPage';
import LiveGameBettingSetupPage from './pages/live-game/betting/LiveGameBettingSetupPage';
import LiveGameBettingPlayPage from './pages/live-game/betting/LiveGameBettingPlayPage';
import LiveGameBettingResultsPage from './pages/live-game/betting/LiveGameBettingResultsPage';
import PredictionChallengeOverviewPage from './pages/prediction/PredictionChallengeOverviewPage';
import FantasyLiveTeamSelectionPage from './pages/live-game/FantasyLiveTeamSelectionPage';
import FantasyLiveGamePage from './pages/live-game/FantasyLiveGamePage';
import { OnboardingFlow } from './components/OnboardingFlow';
import { isBefore, parseISO } from 'date-fns';
import { TicketWalletModal } from './components/TicketWalletModal';
import { SpinWheel } from './components/SpinWheel';


export type Page = 'challenges' | 'matches' | 'profile' | 'admin' | 'leagues';
type AuthFlowState = 'guest' | 'authenticated' | 'signing_up' | 'onboarding';

function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const { toasts, addToast, removeToast } = useToast();
  const [authFlow, setAuthFlow] = useState<AuthFlowState>('guest');
  const [showSignUpPrompt, setShowSignUpPrompt] = useState(false);
  const [showOnboardingTest, setShowOnboardingTest] = useState(false);
  const [isTicketWalletOpen, setIsTicketWalletOpen] = useState(false);
  const [spinWheelState, setSpinWheelState] = useState<{ isOpen: boolean; tier: SpinTier | null }>({ isOpen: false, tier: null });

  const [page, setPage] = useState<Page>('challenges');
  const [matches, setMatches] = useState<Match[]>(mockMatches);
  const [bets, setBets] = useState<Bet[]>([]);
  const [modalState, setModalState] = useState<{ isOpen: boolean; match: Match | null; prediction: 'teamA' | 'draw' | 'teamB' | null; odds: number; }>({ isOpen: false, match: null, prediction: null, odds: 0 });

  // --- Game State (from Zustand Store) ---
  const {
    games,
    userLeagues,
    leagueMembers,
    leagueGames,
    liveGames,
    predictionChallenges,
    userTickets,
    userStreaks,
    allUsers,
    createLeague,
    linkGameToLeagues,
    createLeagueAndLink,
    createLiveGame,
    submitLiveGamePrediction,
    editLiveGamePrediction,
    placeLiveBet,
    tickLiveGame,
    joinChallenge: joinChallengeAction,
    processDailyStreak,
  } = useMockStore();

  const { initializeUserSpinState } = useSpinStore();
  
  // --- Local Game State ---
  const { userChallengeEntries, userSwipeEntries, userFantasyTeams } = useMockStore(state => ({
    userChallengeEntries: state.userChallengeEntries,
    userSwipeEntries: state.userSwipeEntries,
    userFantasyTeams: state.userFantasyTeams,
  }));
  
  // --- Progression State ---
  const [levelsConfig, setLevelsConfig] = useState<LevelConfig[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [userBadges, setUserBadges] = useState<UserBadge[]>(mockUserBadges);

  // --- League UI State ---
  const [activeLeagueId, setActiveLeagueId] = useState<string | null>(null);
  const [joinLeagueCode, setJoinLeagueCode] = useState<string | null>(null);
  const [showCreateLeagueModal, setShowCreateLeagueModal] = useState(false);
  const [modalAction, setModalAction] = useState<{ type: 'leave' | 'delete', leagueId: string } | null>(null);

  // --- UI State ---
  const [activeChallengeId, setActiveChallengeId] = useState<string | null>(null);
  const [viewingLeaderboardFor, setViewingLeaderboardFor] = useState<string | null>(null);
  const [activeSwipeGameId, setActiveSwipeGameId] = useState<string | null>(null);
  const [viewingSwipeLeaderboardFor, setViewingSwipeLeaderboardFor] = useState<string | null>(null);
  const [activeFantasyGameId, setActiveFantasyGameId] = useState<string | null>(null);
  const [activeLiveGame, setActiveLiveGame] = useState<{ id: string; status: 'Upcoming' | 'Ongoing' | 'Finished' } | null>(null);
  const [boosterInfoPreferences, setBoosterInfoPreferences] = useState<{ x2: boolean, x3: boolean }>({ x2: false, x3: false });
  const [challengeToJoin, setChallengeToJoin] = useState<SportimeGame | null>(null);
  const [joinSwipeGameModalState, setJoinSwipeGameModalState] = useState<{ isOpen: boolean; game: Game | null; }>({ isOpen: false, game: null });
  const [hasSeenSwipeTutorial, setHasSeenSwipeTutorial] = useState(false);
  const [swipeGameViewMode, setSwipeGameViewMode] = useState<'swiping' | 'recap'>('swiping');
  const [leaderboardContext, setLeaderboardContext] = useState<{ leagueId: string; leagueName: string; fromLeague?: boolean } | null>(null);
  const [viewingPredictionChallenge, setViewingPredictionChallenge] = useState<string | null>(null);

  // --- In-Game Linking State ---
  const [linkingGame, setLinkingGame] = useState<Game | null>(null);
  const [isLinkingLoading, setIsLinkingLoading] = useState(false);
  const [showNoLeaguesModal, setShowNoLeaguesModal] = useState(false);
  const [showSelectLeaguesModal, setShowSelectLeaguesModal] = useState(false);
  const [showMiniCreateLeagueModal, setShowMiniCreateLeagueModal] = useState(false);

  // Effect for static data (runs once)
  useEffect(() => {
    const fetchStaticData = async () => {
      if (USE_SUPABASE) {
        // ... supabase logic
      } else {
        setLevelsConfig(mockLevelsConfig);
        setBadges(mockBadges);
      }
    };
    fetchStaticData();
  }, []);

  // Check for league join link on initial load
  useEffect(() => {
      const path = window.location.pathname;
      const joinMatch = path.match(/\/join\/([a-zA-Z0-9]+)/);
      if (joinMatch && joinMatch[1]) {
          setJoinLeagueCode(joinMatch[1]);
          window.history.replaceState({}, document.title, "/");
      }
  }, []);

  // Main Auth Effect
  useEffect(() => {
    const setupAuth = async () => {
      if (USE_SUPABASE) {
        // ... supabase logic
      } else {
        // Mock logic for guest/registered user
        setLoading(true);
        const storedUserJson = localStorage.getItem('sportime_user');
        let user: Profile;
        if (storedUserJson) {
            user = JSON.parse(storedUserJson);
        } else {
            user = mockUsers.find(u => u.id === 'user-1')!;
            localStorage.setItem('sportime_user', JSON.stringify(user));
        }
        setProfile(user);
        setAuthFlow(user.is_guest ? 'guest' : 'authenticated');
        
        // Initialize user-specific states
        initializeUserSpinState(user.id);
        const { reward, message } = processDailyStreak(user.id);
        if (reward) {
          addToast(message, 'success');
        }

        const seenTutorial = localStorage.getItem('sportime_seen_swipe_tutorial');
        if (seenTutorial) {
          setHasSeenSwipeTutorial(true);
        }
        setLoading(false);
      }
    };
    setupAuth();
  }, []); // Run only once on mount


  const coinBalance = profile?.coins_balance ?? 0;

  const handleSetCoinBalance = (newBalance: number) => {
    if (profile) {
      useMockStore.getState().setCoinBalance(profile.id, newBalance);
      const updatedProfile = { ...profile, coins_balance: newBalance };
      setProfile(updatedProfile);
      if (!profile.is_guest) {
          localStorage.setItem('sportime_user', JSON.stringify(updatedProfile));
      }
    }
  };

  const handleTriggerSignUp = () => {
    if (profile?.is_guest) {
      setShowSignUpPrompt(true);
    }
  };

  const handleStartSignUp = () => {
    setShowSignUpPrompt(false);
    setAuthFlow('signing_up');
  };

  const handleCancelSignUp = () => {
    setAuthFlow(profile?.is_guest ? 'guest' : 'authenticated');
  };

  const handleMagicLinkSent = (email: string) => {
    const completeSignUp = () => {
        const newUser: Profile = {
            id: uuidv4(),
            email,
            username: null,
            coins_balance: 1000,
            created_at: new Date().toISOString(),
            is_guest: false,
            verified: true,
        };
        setProfile(newUser);
        setAuthFlow('onboarding');
    };

    if (useMockStore.getState().isTestMode) {
      addToast('Test Mode: Skipping verification...', 'info');
      completeSignUp();
    } else {
      addToast('Simulating Magic Link verification...', 'info');
      setTimeout(() => {
          completeSignUp();
          addToast('Verification successful! Please set up your profile.', 'success');
      }, 1500);
    }
  };

  const handleSignOut = async () => {
    if (USE_SUPABASE) {
        await supabase.auth.signOut();
    }
    localStorage.removeItem('sportime_user');
    const guestId = `guest-${uuidv4()}`;
    const guestProfile: Profile = {
        id: guestId, username: 'Guest', coins_balance: 1000,
        created_at: new Date().toISOString(), is_guest: true, verified: false, email: null,
    };
    localStorage.setItem('sportime_user', JSON.stringify(guestProfile));
    setProfile(guestProfile);
    setAuthFlow('guest');
    setPage('challenges');
    addToast('You have been signed out.', 'info');
  };

  const handleUpdateProfile = async (updatedData: { username: string; newProfilePic: File | null; favoriteClub?: string | null; favoriteNationalTeam?: string | null; }) => {
    if (!profile || profile.is_guest) return;
    setLoading(true);
    addToast('Updating profile...', 'info');

    let newProfilePictureUrl = profile.profile_picture_url;
    
    if (updatedData.newProfilePic) {
        newProfilePictureUrl = URL.createObjectURL(updatedData.newProfilePic);
    }

    const newProfileData: Partial<Profile> = {
      username: updatedData.username,
      profile_picture_url: newProfilePictureUrl,
      favorite_club: updatedData.favoriteClub === null ? undefined : updatedData.favoriteClub || profile.favorite_club,
      favorite_national_team: updatedData.favoriteNationalTeam === null ? undefined : updatedData.favoriteNationalTeam || profile.favorite_national_team,
    };
    newProfileData.sports_preferences = { ...profile.sports_preferences, football: { club: newProfileData.favorite_club, national_team: newProfileData.favorite_national_team } };

    const updatedProfile = { ...profile, ...newProfileData } as Profile;
    setProfile(updatedProfile);
    localStorage.setItem('sportime_user', JSON.stringify(updatedProfile));
    addToast('Profile updated successfully!', 'success');
    setLoading(false);
  };

  const handleUpdateEmail = async (newEmail: string) => { /* ... */ };
  const handleDeleteAccount = async () => { /* ... */ };

  const handleCompleteOnboarding = (updatedProfile: Profile) => {
    const finalProfile = { ...updatedProfile, verified: true };
    setProfile(finalProfile);
    localStorage.setItem('sportime_user', JSON.stringify(finalProfile));
    setAuthFlow('authenticated');
    addToast(`Welcome to Sportime, ${finalProfile.username}!`, 'success');
  };
  
  const handleBetClick = (match: Match, prediction: 'teamA' | 'draw' | 'teamB', odds: number) => {
    setModalState({ isOpen: true, match, prediction, odds });
  };

  const handleConfirmBet = (amount: number, prediction: 'teamA' | 'draw' | 'teamB', odds: number) => {
    if (modalState.match) {
      const newBetData = { prediction, amount, odds };
      const existingBetIndex = bets.findIndex(b => b.matchId === modalState.match!.id);
      if (existingBetIndex !== -1) {
        const oldBet = bets[existingBetIndex];
        const updatedBets = [...bets];
        updatedBets[existingBetIndex] = { ...oldBet, ...newBetData };
        setBets(updatedBets);
        handleSetCoinBalance(coinBalance + oldBet.amount - amount);
      } else {
        const newBet: Bet = { matchId: modalState.match.id, ...newBetData, status: 'pending' };
        setBets([...bets, newBet]);
        handleSetCoinBalance(coinBalance - amount);
      }
    }
  };
  
  const handleCancelBet = (matchId: string) => {
    const betToCancel = bets.find(b => b.matchId === matchId);
    if (betToCancel) {
      handleSetCoinBalance(coinBalance + betToCancel.amount);
      setBets(prevBets => prevBets.filter(b => b.matchId !== matchId));
    }
  };

  const handleUpdateDailyBets = async (challengeId: string, day: number, newBets: ChallengeBet[]) => {
    // This logic is now handled in the store. This handler is kept for legacy compatibility if needed.
    console.log("Updating daily bets (UI event):", { challengeId, day, newBets });
  };
  const handleSetDailyBooster = async (challengeId: string, day: number, booster: BoosterSelection | undefined) => {
    // This logic is now handled in the store.
    console.log("Setting daily booster (UI event):", { challengeId, day, booster });
  };
  
  const handleUpdateBoosterPreferences = (booster: 'x2' | 'x3') => {
    const newPrefs = { ...boosterInfoPreferences, [booster]: true };
    setBoosterInfoPreferences(newPrefs);
    addToast(`Preference saved. This dialog will not show again for ${booster.toUpperCase()}.`, 'info');
  };
  
  const handleJoinSwipeGame = (gameId: string) => {
    if (profile?.is_guest) {
      handleTriggerSignUp();
      return;
    }
    const gameToJoin = games.find(g => g.id === gameId);
    if (gameToJoin) setJoinSwipeGameModalState({ isOpen: true, game: gameToJoin });
  };

  const handleConfirmJoinSwipeGame = async () => {
    const { game } = joinSwipeGameModalState;
    if (!game || !profile || profile.is_guest) return;

    if (coinBalance >= game.entry_cost) {
        await handleSetCoinBalance(coinBalance - game.entry_cost);

        const newEntry: UserSwipeEntry = {
            matchDayId: game.id,
            predictions: [],
            submitted_at: null,
        };
        useMockStore.setState(state => ({ userSwipeEntries: [...state.userSwipeEntries, newEntry] }));

        setJoinSwipeGameModalState({ isOpen: false, game: null });
        addToast(`Successfully joined "${game.name}"!`, 'success');
        setSwipeGameViewMode('swiping');
        setActiveSwipeGameId(game.id);
    } else {
        addToast('Insufficient funds to join this game.', 'error');
    }
  };
  const handlePlaySwipeGame = (matchDayId: string) => {
    const matchDay = games.find(md => md.id === matchDayId && md.game_type === 'prediction');
    const userEntry = userSwipeEntries.find(e => e.matchDayId === matchDayId);
    if (matchDay && userEntry) {
        const hasMadeAllPicks = userEntry.predictions.length >= (matchDay.matches?.length || 0);
        const isEditable = matchDay.status === 'Upcoming';
        if (isEditable && !hasMadeAllPicks) {
            setSwipeGameViewMode('swiping');
        } else {
            setSwipeGameViewMode('recap');
        }
    } else {
        setSwipeGameViewMode('swiping');
    }
    setActiveSwipeGameId(matchDayId);
  };
  const handleSwipePrediction = (matchDayId: string, matchId: string, prediction: SwipePredictionOutcome) => {
    if (profile?.is_guest) {
        handleTriggerSignUp();
        return;
    }
    useMockStore.setState(prev => {
        const oldEntry = prev.userSwipeEntries.find(e => e.matchDayId === matchDayId);
        const oldPredictionsCount = oldEntry?.predictions.length || 0;

        const newEntries = prev.userSwipeEntries.map(entry => {
            if (entry.matchDayId === matchDayId) {
                const existingPredictionIndex = entry.predictions.findIndex(p => p.matchId === matchId);
                let newPredictions = [...entry.predictions];
                if (existingPredictionIndex !== -1) {
                    newPredictions[existingPredictionIndex] = { matchId, prediction };
                } else {
                    newPredictions.push({ matchId, prediction });
                }

                const matchDay = games.find(md => md.id === matchDayId);
                const totalMatches = matchDay?.matches?.length || 0;
                const newPredictionsCount = newPredictions.length;

                // Only navigate to recap if we have just completed all predictions for the first time.
                if (matchDay && newPredictionsCount >= totalMatches && oldPredictionsCount < totalMatches) {
                    setTimeout(() => setSwipeGameViewMode('recap'), 350); // Allow animation to finish
                }
                
                // Finalize submission on last pick
                const submitted_at = newPredictionsCount >= totalMatches ? new Date().toISOString() : entry.submitted_at;

                return { ...entry, predictions: newPredictions, submitted_at };
            }
            return entry;
        });
        return { userSwipeEntries: newEntries };
    });
  };
  const handleUpdateSwipePrediction = (matchDayId: string, matchId: string, prediction: SwipePredictionOutcome) => {
    useMockStore.setState(prev => ({
        userSwipeEntries: prev.userSwipeEntries.map(entry => {
            if (entry.matchDayId === matchDayId) {
                const newPredictions = entry.predictions.map(p =>
                    p.matchId === matchId ? { ...p, prediction } : p
                );
                return { ...entry, predictions: newPredictions };
            }
            return entry;
        })
    }));
    addToast('Prediction updated!', 'info');
  };
  const handleEditSwipePicks = () => {
    if (activeSwipeGameId) {
      setSwipeGameViewMode('swiping');
    }
  };

  const handleExitSwiping = () => {
    setSwipeGameViewMode('recap');
  };

  const handleDismissSwipeTutorial = (dontShowAgain: boolean) => {
    if (dontShowAgain) {
      localStorage.setItem('sportime_seen_swipe_tutorial', 'true');
    }
    setHasSeenSwipeTutorial(true);
  };
  const handleViewFantasyGame = (gameId: string) => {
    setActiveFantasyGameId(gameId);
  };
  
  // --- League Handlers ---
  const handleCreateLeague = (name: string, description: string, image_url: string | null) => {
      if (!profile || profile.is_guest) {
          handleTriggerSignUp();
          return;
      }
      const newLeague = createLeague(name, description, profile);
      addToast(`League "${name}" created!`, 'success');
      setShowCreateLeagueModal(false);
      setActiveLeagueId(newLeague.id);
      return newLeague;
  };

  const handleJoinLeague = (inviteCode: string) => {
      if (!profile || profile.is_guest) {
          handleTriggerSignUp();
          return;
      }
      const league = userLeagues.find(l => l.invite_code === inviteCode);
      if (!league) {
          addToast('Invalid invite code.', 'error');
          setJoinLeagueCode(null);
          return;
      }
      const isAlreadyMember = leagueMembers.some(m => m.league_id === league.id && m.user_id === profile.id);
      if (isAlreadyMember) {
          addToast('You are already a member of this league.', 'info');
          setActiveLeagueId(league.id);
          setJoinLeagueCode(null);
          return;
      }
      // This should be a store action in a real app
      const newMember: LeagueMember = {
          id: uuidv4(),
          league_id: league.id,
          user_id: profile.id,
          role: 'member',
          joined_at: new Date().toISOString(),
      };
      useMockStore.setState(state => ({ leagueMembers: [...state.leagueMembers, newMember] }));
      addToast(`Welcome to ${league.name}!`, 'success');
      setActiveLeagueId(league.id);
      setJoinLeagueCode(null);
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
      addToast(`"${game.name}" linked to your league!`, 'success');
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

  // --- In-Game Linking Handlers ---
  const myAdminLeagues = useMemo(() => {
    if (!profile) return [];
    const adminOfLeagueIds = new Set(leagueMembers.filter(m => m.user_id === profile.id && m.role === 'admin').map(m => m.league_id));
    return userLeagues.filter(l => adminOfLeagueIds.has(l.id));
  }, [profile, leagueMembers, userLeagues]);

  const handleOpenLinkGameFlow = (game: Game) => {
    if (profile?.is_guest) {
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
    if (!profile || profile.is_guest || !linkingGame) return;
    setIsLinkingLoading(true);
    
    createLeagueAndLink(name, description, linkingGame, profile);
    
    addToast(`League "${name}" created and linked successfully! 🎉`, 'success');
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

  const handleConfirmJoinChallenge = (challengeId: string, method: 'coins' | 'ticket') => {
    if (!profile) return;
    
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
    if (!profile || profile.is_guest) {
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
      setChallengeToJoin(game); // Open modal to choose
    } else if (validTicket) {
      handleConfirmJoinChallenge(game.id, 'ticket'); // Auto-use ticket
    } else if (hasEnoughCoins) {
      handleConfirmJoinChallenge(game.id, 'coins'); // Auto-use coins
    } else {
      addToast("You don't have enough coins or a valid ticket to join.", 'error');
    }
  };


  const handlePageChange = (newPage: Page) => {
    if ((newPage === 'profile' || newPage === 'leagues') && profile?.is_guest) {
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

    // Reset all possible leaderboard states
    setViewingLeaderboardFor(null);
    setViewingSwipeLeaderboardFor(null);
    setActiveFantasyGameId(null);
    setLeaderboardContext(null);
    setViewingPredictionChallenge(null);

    // If we came from a league, navigate back to it
    if (fromLeagueId) {
        setActiveLeagueId(fromLeagueId);
    }
  };

  const handleOpenSpinWheel = (tier: SpinTier) => {
    setSpinWheelState({ isOpen: true, tier });
  };

  const myGamesCount = useMemo(() => {
    if (!profile || profile.is_guest) return 0;
    const myJoinedGameIds = new Set([
      ...userChallengeEntries.map(e => e.challengeId),
      ...userSwipeEntries.map(e => e.matchDayId),
      ...userFantasyTeams.map(t => t.gameId),
    ]);
    return games.filter(g => myJoinedGameIds.has(g.id) && (g.status === 'Upcoming' || g.status === 'Ongoing')).length;
  }, [profile, games, userChallengeEntries, userSwipeEntries, userFantasyTeams]);

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

  const renderPage = () => {
    if (joinLeagueCode) {
        const leagueToJoin = userLeagues.find(l => l.invite_code === joinLeagueCode);
        const isMember = profile ? leagueMembers.some(m => m.league_id === leagueToJoin?.id && m.user_id === profile.id) : false;
        return <LeagueJoinPage 
            league={leagueToJoin || null}
            isMember={isMember}
            onJoin={() => handleJoinLeague(joinLeagueCode)}
            onGoToLeague={() => { setActiveLeagueId(leagueToJoin!.id); setJoinLeagueCode(null); setPage('leagues'); }}
            onCancel={() => setJoinLeagueCode(null)}
        />
    }
    
    if (viewingLeaderboardFor) {
      const challenge = games.find(c => c.id === viewingLeaderboardFor && c.game_type === 'betting');
      if (challenge && profile) {
        const userEntry = userChallengeEntries.find(e => e.challengeId === viewingLeaderboardFor && e.user_id === profile.id);
        return <LeaderboardPage
          challenge={challenge as BettingChallenge}
          matches={mockChallengeMatches}
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
      const challenge = games.find(c => c.id === activeChallengeId && c.game_type === 'betting');
      const userEntry = userChallengeEntries.find(e => e.challengeId === activeChallengeId && e.user_id === profile.id);
      if (challenge && userEntry && profile) {
        return <ChallengeRoomPage
          challenge={challenge as BettingChallenge}
          matches={mockChallengeMatches.filter(m => m.challengeId === activeChallengeId)}
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
        />;
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

    if (viewingSwipeLeaderboardFor) {
      const matchDay = games.find(md => md.id === viewingSwipeLeaderboardFor && md.game_type === 'prediction');
      if (matchDay && profile) {
        const userEntry = userSwipeEntries.find(e => e.matchDayId === viewingSwipeLeaderboardFor);
        return <SwipeLeaderboardPage
          matchDay={matchDay as SwipeMatchDay}
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

    if (activeSwipeGameId) {
      const matchDay = games.find(md => md.id === activeSwipeGameId && md.game_type === 'prediction');
      const userEntry = userSwipeEntries.find(e => e.matchDayId === activeSwipeGameId);

      if (matchDay && userEntry && profile) {
        const isEditable = matchDay.status === 'Upcoming';
        
        if (swipeGameViewMode === 'swiping' && isEditable) {
          return <SwipeGamePage
            matchDay={matchDay as SwipeMatchDay}
            userEntry={userEntry}
            onSwipePrediction={handleSwipePrediction}
            hasSeenSwipeTutorial={hasSeenSwipeTutorial}
            onDismissTutorial={handleDismissSwipeTutorial}
            onExit={handleExitSwiping}
          />;
        } else {
          return <SwipeRecapPage
            allMatchDays={games.filter(g => g.game_type === 'prediction' && userSwipeEntries.some(e => e.matchDayId === g.id)) as SwipeMatchDay[]}
            selectedMatchDayId={activeSwipeGameId}
            userEntry={userEntry}
            onBack={() => setActiveSwipeGameId(null)}
            onUpdatePrediction={isEditable ? handleUpdateSwipePrediction : undefined}
            onViewLeaderboard={() => setViewingSwipeLeaderboardFor(activeSwipeGameId)}
            onSelectMatchDay={handlePlaySwipeGame}
            onEditPicks={isEditable ? handleEditSwipePicks : undefined}
            onLinkGame={handleOpenLinkGameFlow}
            profile={profile}
            userLeagues={myLeagues}
            leagueMembers={leagueMembers}
            leagueGames={leagueGames}
          />;
        }
      }
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
        return <MatchesPage matches={matches} bets={bets} onBet={handleBetClick} />;
      case 'challenges':
        return <GamesListPage games={games} userChallengeEntries={userChallengeEntries} userSwipeEntries={userSwipeEntries} userFantasyTeams={userFantasyTeams} onJoinChallenge={handleJoinChallenge} onViewChallenge={setActiveChallengeId} onJoinSwipeGame={handleJoinSwipeGame} onPlaySwipeGame={handlePlaySwipeGame} onViewFantasyGame={handleViewFantasyGame} myGamesCount={myGamesCount} profile={profile} userTickets={userTickets} />;
      case 'leagues':
          return <LeaguesListPage 
              leagues={myLeagues}
              onCreate={() => setShowCreateLeagueModal(true)}
              onViewLeague={setActiveLeagueId}
          />;
      case 'admin':
        return <AdminPage profile={profile} addToast={addToast} />;
      case 'profile':
        if (profile && !profile.is_guest) {
          return <ProfilePage profile={profile} levels={levelsConfig} allBadges={badges} userBadges={userBadges} userStreaks={userStreaks} onUpdateProfile={handleUpdateProfile} onUpdateEmail={handleUpdateEmail} onSignOut={handleSignOut} onDeleteAccount={handleDeleteAccount} onOpenSpinWheel={handleOpenSpinWheel} />;
        }
        return null;
      default:
        return <GamesListPage games={games} userChallengeEntries={userChallengeEntries} userSwipeEntries={userSwipeEntries} userFantasyTeams={userFantasyTeams} onJoinChallenge={handleJoinChallenge} onViewChallenge={setActiveChallengeId} onJoinSwipeGame={handleJoinSwipeGame} onPlaySwipeGame={handlePlaySwipeGame} onViewFantasyGame={handleViewFantasyGame} myGamesCount={myGamesCount} profile={profile} userTickets={userTickets} />;
    }
  }
  
  const userBetForModal = modalState.match ? bets.find(b => b.matchId === modalState.match!.id) : undefined;

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-deep-navy"><div className="text-2xl font-semibold text-text-secondary">Loading...</div></div>;
  }

  // --- Auth Flow Rendering ---
  if (authFlow === 'signing_up' || joinLeagueCode && profile?.is_guest) {
    return <SignUpStep onMagicLinkSent={handleMagicLinkSent} onBack={handleCancelSignUp} />;
  }
  if (authFlow === 'onboarding' && profile) {
    return <OnboardingPage profile={profile} onComplete={handleCompleteOnboarding} />;
  }

  const handleOpenOnboardingTest = () => {
    setShowOnboardingTest(true);
  };

  return (
    <div className="main-background">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <div className="max-w-md mx-auto px-4 pt-4 pb-28 space-y-4">
        <Header profile={profile} ticketCount={ticketCount} onViewProfile={() => handlePageChange('profile')} onSignIn={handleTriggerSignUp} onViewTickets={() => setIsTicketWalletOpen(true)} />
        {renderPage()}
      </div>

      <FooterNav activePage={page} onPageChange={handlePageChange} />

      {modalState.match && modalState.prediction && ( <BetModal isOpen={modalState.isOpen} onClose={() => setModalState({ ...modalState, isOpen: false })} match={modalState.match} prediction={modalState.prediction} odds={modalState.odds} balance={coinBalance} onConfirm={handleConfirmBet} userBet={userBetForModal} onCancelBet={handleCancelBet} /> )}
      {challengeToJoin && (
        <ChooseEntryMethodModal
          isOpen={!!challengeToJoin}
          onClose={() => setChallengeToJoin(null)}
          onSelectMethod={(method) => handleConfirmJoinChallenge(challengeToJoin.id, method)}
          challenge={challengeToJoin as BettingChallenge}
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
            title={modalAction.type === 'leave' ? 'Leave League' : 'Delete League'}
            message={modalAction.type === 'leave' ? 'Are you sure you want to leave this league?' : 'This action is irreversible and will delete the league for all members. Are you sure?'}
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
      isOpen={showOnboardingTest}
      onClose={() => setShowOnboardingTest(false)}
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
    </div>
  );
}

export default App;
