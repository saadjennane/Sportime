import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Header } from './components/Header';
import { BetModal } from './components/BetModal';
import { FooterNav } from './components/FooterNav';
import { mockMatches } from './data/mockMatches';
import { mockChallengeMatches } from './data/mockChallenges';
import { mockFantasyPlayers } from './data/mockFantasy.tsx';
import { Match, Bet, UserChallengeEntry, Profile, LevelConfig, Badge, UserBadge, UserFantasyTeam, UserTicket, SportimeGame, SpinTier, SwipeMatchDay, FantasyGame, ActiveSession, ContextualPromptType } from './types';
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
import { OnboardingPage } from './pages/onboarding/OnboardingPage';
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
import { isBefore, parseISO, differenceInHours } from 'date-fns';
import { TicketWalletModal } from './components/TicketWalletModal';
import { SpinWheel } from './components/SpinWheel';
import { GameModal } from './components/modals/GameModal';
import { LiveArenaModal } from './components/modals/LiveArenaModal';
import { JoinGameModal } from './components/modals/JoinGameModal';
import { NotificationCenter } from './components/notifications/NotificationCenter';
import FunZonePage from './pages/FunZonePage';
import { PremiumModal } from './components/premium/PremiumModal';
import { CoinShopModal } from './components/shop/CoinShopModal';
import { DailyStreakModal } from './components/streaks/DailyStreakModal';
import { ContextualPremiumPrompt } from './components/premium/ContextualPremiumPrompt';
import { Session } from '@supabase/supabase-js';


export type Page = 'challenges' | 'matches' | 'profile' | 'admin' | 'leagues' | 'funzone';
type AuthFlowState = 'guest' | 'authenticated' | 'signing_up' | 'onboarding';

function App() {
  const [loading, setLoading] = useState(true);
  const { toasts, addToast, removeToast } = useToast();
  
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authFlow, setAuthFlow] = useState<AuthFlowState>('guest');

  const [showSignUpPrompt, setShowSignUpPrompt] = useState(false);
  const [isTicketWalletOpen, setIsTicketWalletOpen] = useState(false);
  const [spinWheelState, setSpinWheelState] = useState<{ isOpen: boolean; tier: SpinTier | null }>({ isOpen: false, tier: null });
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  const [isPremiumModalOpen, setIsPremiumModalOpen] = useState(false);
  const [isCoinShopModalOpen, setIsCoinShopModalOpen] = useState(false);
  const [dailyStreakData, setDailyStreakData] = useState<{ isOpen: boolean; streakDay: number }>({ isOpen: false, streakDay: 0 });
  const [contextualPrompt, setContextualPrompt] = useState<{ type: ContextualPromptType; isOpen: boolean } | null>(null);

  const [page, setPage] = useState<Page>('challenges');
  const [matches, setMatches] = useState<Match[]>(mockMatches);
  const [bets, setBets] = useState<Bet[]>([]);
  const [modalState, setModalState] = useState<{ isOpen: boolean; match: Match | null; prediction: 'teamA' | 'draw' | 'teamB' | null; odds: number; }>({ isOpen: false, match: null, prediction: null, odds: 0 });

  // --- Game Modal States ---
  const [gameModalState, setGameModalState] = useState<{ isOpen: boolean; matchId: string | null; matchName: string | null; }>({ isOpen: false, matchId: null, matchName: null });
  const [liveGameModalState, setLiveGameModalState] = useState<{ isOpen: boolean; matchId: string | null; matchName: string | null; }>({ isOpen: false, matchId: null, matchName: null });
  const [joinGameModalState, setJoinGameModalState] = useState<{ isOpen: boolean }>({ isOpen: false });

  // --- Store State ---
  const {
    games, userLeagues, leagueMembers, leagueGames, liveGames, predictionChallenges,
    userTickets, userStreaks, createLeague, linkGameToLeagues, createLeagueAndLink,
    createLiveGame, submitLiveGamePrediction, editLiveGamePrediction, placeLiveBet,
    tickLiveGame, joinChallenge: joinChallengeAction, joinSwipeGame,
    notifications, markNotificationAsRead, markAllNotificationsAsRead, subscribeToPremium,
    checkDailyStreak, claimDailyStreak,
  } = useMockStore();

  const { initializeUserSpinState } = useSpinStore();
  
  const { userChallengeEntries, userSwipeEntries, userFantasyTeams } = useMockStore(state => ({
    userChallengeEntries: state.userChallengeEntries,
    userSwipeEntries: state.userSwipeEntries,
    userFantasyTeams: state.userFantasyTeams,
  }));
  
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
          window.history.replaceState({}, document.title, "/");
      }
  }, []);

  useEffect(() => {
    if (!supabase) {
        setLoading(false);
        return;
    }
    setLoading(true);
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
        setSession(session);
        
        if (session?.user) {
            const { data: userProfile, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
                console.error("Error fetching profile:", error);
                addToast('Error loading your profile.', 'error');
            } else if (userProfile) {
                setProfile(userProfile);
                setAuthFlow('authenticated');
            } else {
                // New user, start onboarding
                const newUserProfile: Profile = {
                    id: session.user.id,
                    email: session.user.email!,
                    username: `user_${session.user.id.slice(0, 6)}`,
                    coins_balance: 1000,
                    created_at: new Date().toISOString(),
                    is_guest: false,
                    verified: false,
                };
                setProfile(newUserProfile);
                setAuthFlow('onboarding');
            }
        } else {
            // No session, user is a guest
            const guestId = `guest-${uuidv4()}`;
            const guestProfile: Profile = { id: guestId, username: 'Guest', coins_balance: 1000, created_at: new Date().toISOString(), is_guest: true, verified: false, email: null };
            setProfile(guestProfile);
            setAuthFlow('guest');
        }
        setLoading(false);
    });

    return () => {
        subscription.unsubscribe();
    };
  }, [addToast]);

  const handleClaimStreak = () => {
    if (!profile) return;
    const { reward, streakDay } = claimDailyStreak(profile.id);
    
    let rewardMessage = '';
    if (reward.coins) rewardMessage = `You earned +${reward.coins} coins!`;
    if (reward.ticket) rewardMessage = `You earned a ${reward.ticket} Ticket!`;

    addToast(`Day ${streakDay} streak claimed! ${rewardMessage}`, 'success');
    setDailyStreakData({ isOpen: false, streakDay: 0 });
  };

  useEffect(() => {
    if (profile && !profile.is_guest) {
      initializeUserSpinState(profile.id);
      const { isAvailable, streakDay } = checkDailyStreak(profile.id);
      if (isAvailable) {
        setDailyStreakData({ isOpen: true, streakDay });
      }
    }
    const seenTutorial = localStorage.getItem('sportime_seen_swipe_tutorial');
    if (seenTutorial) {
      setHasSeenSwipeTutorial(true);
    }
  }, [profile, initializeUserSpinState, checkDailyStreak]);

  const coinBalance = profile?.coins_balance ?? 0;

  const handleSetCoinBalance = async (newBalance: number) => {
    if (profile && !profile.is_guest && supabase) {
        const { data, error } = await supabase
            .from('profiles')
            .update({ coins_balance: newBalance })
            .eq('id', profile.id)
            .select()
            .single();
        
        if (error) {
            addToast('Failed to update balance.', 'error');
        } else if (data) {
            setProfile(data);
        }
    } else if (profile && profile.is_guest) {
        setProfile(p => p ? { ...p, coins_balance: newBalance } : null);
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

  const handleMagicLinkSent = async (email: string) => {
    if (!supabase) {
        addToast('Supabase not configured.', 'error');
        return;
    }
    const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
            emailRedirectTo: window.location.origin,
        },
    });

    if (error) {
        addToast(error.message, 'error');
    } else {
        addToast('Check your email for the magic link!', 'success');
    }
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
        addToast(`Error signing out: ${error.message}`, 'error');
    } else {
        addToast('You have been signed out.', 'info');
        setPage('challenges');
    }
  };

  const handleUpdateProfile = async (updatedData: { username: string; displayName: string; newProfilePic: File | null; favoriteClub?: string | null; favoriteNationalTeam?: string | null; }) => {
    if (!profile || profile.is_guest || !supabase) return;
    setLoading(true);
    addToast('Updating profile...', 'info');

    let newProfilePictureUrl = profile.profile_picture_url;

    if (updatedData.newProfilePic) {
        const file = updatedData.newProfilePic;
        const fileExt = file.name.split('.').pop();
        const fileName = `${profile.id}-${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);

        if (uploadError) {
            addToast(`Error uploading avatar: ${uploadError.message}`, 'error');
            setLoading(false);
            return;
        }

        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
        newProfilePictureUrl = urlData.publicUrl;
    }

    const updatesToSave: Partial<Profile> = {
        username: updatedData.username,
        display_name: updatedData.displayName,
        profile_picture_url: newProfilePictureUrl,
        favorite_club: updatedData.favoriteClub === null ? undefined : updatedData.favoriteClub || profile.favorite_club,
        favorite_national_team: updatedData.favoriteNationalTeam === null ? undefined : updatedData.favoriteNationalTeam || profile.favorite_national_team,
        sports_preferences: { football: { club: updatedData.favoriteClub || undefined, national_team: updatedData.favoriteNationalTeam || undefined } },
    };

    const { data: updatedProfile, error } = await supabase
        .from('profiles')
        .update(updatesToSave)
        .eq('id', profile.id)
        .select()
        .single();

    if (error) {
        addToast(`Error updating profile: ${error.message}`, 'error');
    } else if (updatedProfile) {
        setProfile(updatedProfile);
        addToast('Profile updated successfully!', 'success');
    }
    setLoading(false);
  };

  const handleUpdateEmail = async (newEmail: string) => { /* ... */ };
  const handleDeleteAccount = async () => { /* ... */ };

  const handleCompleteOnboarding = async (updatedProfileData: Partial<Profile>) => {
    if (!profile || profile.is_guest || !supabase) return;

    const finalProfileData = {
        ...profile,
        ...updatedProfileData,
        verified: true,
        id: profile.id,
    };
    
    // Clean up client-side state properties before upserting
    const { is_guest, verified, ...dbProfile } = finalProfileData;

    const { data: upsertedProfile, error } = await supabase
        .from('profiles')
        .upsert(dbProfile)
        .select()
        .single();

    if (error) {
        addToast(`Error setting up profile: ${error.message}`, 'error');
    } else if (upsertedProfile) {
        setProfile(upsertedProfile as Profile);
        setAuthFlow('authenticated');
        addToast(`Welcome to Sportime, ${upsertedProfile.display_name || upsertedProfile.username}!`, 'success');
    }
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

  const handleUpdateDailyBets = async (challengeId: string, day: number, newBets: any) => {
    console.log("Updating daily bets (UI event):", { challengeId, day, newBets });
  };
  const handleSetDailyBooster = async (challengeId: string, day: number, booster: any) => {
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
        handleSetCoinBalance(coinBalance - game.entry_cost);
        const result = joinSwipeGame(game.id, profile.id);
        
        if (result.success) {
          setJoinSwipeGameModalState({ isOpen: false, game: null });
          addToast(`Successfully joined "${game.name}"!`, 'success');
          setSwipeGameViewMode('swiping');
          setActiveSwipeGameId(game.id);
        } else {
          addToast(result.message, 'error');
          handleSetCoinBalance(coinBalance); // Refund
        }
    } else {
        addToast('Insufficient funds to join this game.', 'error');
    }
  };
  const handlePlaySwipeGame = (matchDayId: string) => {
    const matchDay = games.find(md => md.id === matchDayId && md.game_type === 'prediction');
    const userEntry = userSwipeEntries.find(e => e.user_id === profile?.id && e.matchDayId === matchDayId);
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
  const handleSwipePrediction = (matchDayId: string, matchId: string, prediction: any) => {
    if (profile?.is_guest) {
        handleTriggerSignUp();
        return;
    }
    useMockStore.getState().handleSwipePrediction(matchDayId, profile!.id, matchId, prediction);
    const matchDay = games.find(md => md.id === matchDayId);
    const userEntry = userSwipeEntries.find(e => e.user_id === profile?.id && e.matchDayId === matchDayId);
    if (matchDay && userEntry && userEntry.predictions.length + 1 >= (matchDay.matches?.length || 0)) {
        setTimeout(() => setSwipeGameViewMode('recap'), 350);
    }
  };
  const handleUpdateSwipePrediction = (matchDayId: string, matchId: string, prediction: any) => {
    useMockStore.getState().updateSwipePrediction(profile!.id, matchDayId, matchId, prediction);
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
      setChallengeToJoin(game);
    } else if (validTicket) {
      handleConfirmJoinChallenge(game.id, 'ticket');
    } else if (hasEnoughCoins) {
      handleConfirmJoinChallenge(game.id, 'coins');
    } else {
      addToast("You don't have enough coins or a valid ticket to join.", 'error');
    }
  };


  const handlePageChange = (newPage: Page) => {
    if ((newPage === 'profile' || newPage === 'leagues' || newPage === 'funzone') && profile?.is_guest) {
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

  const handlePlayGameClick = (matchId: string, matchName: string) => {
    setGameModalState({ isOpen: true, matchId, matchName });
  };

  const unreadNotificationsCount = useMemo(() => notifications.filter(n => !n.isRead).length, [notifications]);

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
            onGoToLeague={() => { setActiveLeagueId(leagueToJoin!.id); setJoinLeagueCode(null); setPage('leagues'); }}
            onCancel={() => setJoinLeagueCode(null)}
        />
    }
    
    if (viewingLeaderboardFor) {
      const challenge = games.find(c => c.id === viewingLeaderboardFor && c.game_type === 'betting');
      if (challenge && profile) {
        const userEntry = userChallengeEntries.find(e => e.challengeId === viewingLeaderboardFor && e.user_id === profile.id);
        return <LeaderboardPage
          challenge={challenge}
          matches={mockChallengeMatches}
          userEntry={userEntry}
          onBack={handleLeaderboardBack}
          initialLeagueContext={leaderboardContext}
          allUsers={useMockStore.getState().allUsers}
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
          challenge={challenge}
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
          allUsers={useMockStore.getState().allUsers}
          userSwipeEntries={userSwipeEntries}
          swipeMatchDays={games.filter(g => g.game_type === 'prediction') as SwipeMatchDay[]}
          currentUserId={profile.id}
        />
      }
    }

    if (viewingSwipeLeaderboardFor) {
      const matchDay = games.find(md => md.id === viewingSwipeLeaderboardFor && md.game_type === 'prediction');
      if (matchDay && profile) {
        const userEntry = userSwipeEntries.find(e => e.user_id === profile.id && e.matchDayId === viewingSwipeLeaderboardFor);
        return <SwipeLeaderboardPage
          matchDay={matchDay as SwipeMatchDay}
          userEntry={userEntry}
          onBack={handleLeaderboardBack}
          initialLeagueContext={leaderboardContext}
          allUsers={useMockStore.getState().allUsers}
          userLeagues={myLeagues}
          leagueMembers={leagueMembers}
          leagueGames={leagueGames}
          currentUserId={profile.id}
        />;
      }
    }

    if (activeSwipeGameId) {
      const matchDay = games.find(md => md.id === activeSwipeGameId && md.game_type === 'prediction');
      const userEntry = userSwipeEntries.find(e => e.user_id === profile?.id && e.matchDayId === activeSwipeGameId);

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
            allMatchDays={games.filter(g => g.game_type === 'prediction' && userSwipeEntries.some(e => e.user_id === profile?.id && e.matchDayId === g.id)) as SwipeMatchDay[]}
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
          allUsers={useMockStore.getState().allUsers}
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
            const memberProfiles = membersOfLeague.map(m => useMockStore.getState().allUsers.find(u => u.id === m.user_id)).filter(Boolean) as Profile[];
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
        return <MatchesPage matches={matches} bets={bets} onBet={handleBetClick} onPlayGame={handlePlayGameClick} />;
      case 'challenges':
        return <GamesListPage games={games} userChallengeEntries={userChallengeEntries} userSwipeEntries={userSwipeEntries} userFantasyTeams={userFantasyTeams} onJoinChallenge={handleJoinChallenge} onViewChallenge={setActiveChallengeId} onJoinSwipeGame={handleJoinSwipeGame} onPlaySwipeGame={handlePlaySwipeGame} onViewFantasyGame={handleViewFantasyGame} myGamesCount={myGamesCount} profile={profile} userTickets={userTickets} />;
      case 'leagues':
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
        if (profile && !profile.is_guest) {
          return <ProfilePage profile={profile} levels={levelsConfig} allBadges={badges} userBadges={userBadges} userStreaks={userStreaks} onUpdateProfile={handleUpdateProfile} onUpdateEmail={handleUpdateEmail} onSignOut={handleSignOut} onDeleteAccount={handleDeleteAccount} onOpenSpinWheel={handleOpenSpinWheel} onOpenPremiumModal={() => setIsPremiumModalOpen(true)} />;
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

  if (authFlow === 'signing_up' || (joinLeagueCode && profile?.is_guest)) {
    return <SignUpStep onMagicLinkSent={handleMagicLinkSent} onBack={handleCancelSignUp} />;
  }
  if (authFlow === 'onboarding' && profile) {
    return <OnboardingPage profile={profile} onComplete={handleCompleteOnboarding} />;
  }

  return (
    <div className="main-background">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <div className="max-w-md mx-auto px-4 pt-4 pb-28 space-y-4">
        <Header 
          profile={profile} 
          ticketCount={ticketCount} 
          onViewProfile={() => handlePageChange('profile')} 
          onSignIn={handleTriggerSignUp} 
          onViewTickets={() => setIsTicketWalletOpen(true)}
          notificationCount={unreadNotificationsCount}
          onViewNotifications={() => setIsNotificationCenterOpen(true)}
          onGoToShop={() => setIsCoinShopModalOpen(true)}
          onOpenPremiumModal={() => setIsPremiumModalOpen(true)}
        />
        {renderPage()}
      </div>

      <FooterNav activePage={page} onPageChange={handlePageChange} />

      {modalState.match && modalState.prediction && ( <BetModal isOpen={modalState.isOpen} onClose={() => setModalState({ ...modalState, isOpen: false })} match={modalState.match} prediction={modalState.prediction} odds={modalState.odds} balance={coinBalance} onConfirm={handleConfirmBet} userBet={userBetForModal} onCancelBet={handleCancelBet} /> )}
      {challengeToJoin && (
        <ChooseEntryMethodModal
          isOpen={!!challengeToJoin}
          onClose={() => setChallengeToJoin(null)}
          onSelectMethod={(method) => handleConfirmJoinChallenge(challengeToJoin.id, method)}
          challenge={challengeToJoin}
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
    <GameModal 
        isOpen={gameModalState.isOpen} 
        onClose={() => setGameModalState({ isOpen: false, matchId: null, matchName: null })}
        matchId={gameModalState.matchId}
        matchName={gameModalState.matchName}
        onStartLiveGame={() => {
            setLiveGameModalState({ isOpen: true, matchId: gameModalState.matchId, matchName: gameModalState.matchName });
            setGameModalState({ isOpen: false, matchId: null, matchName: null });
        }}
        onJoinGame={() => {
            setJoinGameModalState({ isOpen: true });
            setGameModalState({ isOpen: false, matchId: null, matchName: null });
        }}
        addToast={addToast}
    />
    <LiveArenaModal
        isOpen={liveGameModalState.isOpen}
        onClose={() => setLiveGameModalState({ isOpen: false, matchId: null, matchName: null })}
        matchId={liveGameModalState.matchId}
        matchName={liveGameModalState.matchName}
    />
    <JoinGameModal
        isOpen={joinGameModalState.isOpen}
        onClose={() => setJoinGameModalState({ isOpen: false })}
    />
    <NotificationCenter
      isOpen={isNotificationCenterOpen}
      onClose={() => setIsNotificationCenterOpen(false)}
      notifications={notifications}
      onMarkAsRead={markNotificationAsRead}
      onMarkAllAsRead={markAllNotificationsAsRead}
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
    <DailyStreakModal
      isOpen={dailyStreakData.isOpen}
      onClaim={handleClaimStreak}
      streakDay={dailyStreakData.streakDay}
    />
    {contextualPrompt && <ContextualPremiumPrompt {...contextualPrompt} />}
    </div>
  );
}

export default App;
