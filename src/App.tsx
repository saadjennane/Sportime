import React, { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Header } from './components/Header';
import { BetModal } from './components/BetModal';
import { FooterNav } from './components/FooterNav';
import { mockMatches } from './data/mockMatches';
import { mockChallenges, mockChallengeMatches } from './data/mockChallenges';
import { mockSwipeMatchDays } from './data/mockSwipeGames';
import { mockFantasyGame, mockFantasyPlayers, mockUserFantasyTeams } from './data/mockFantasy.tsx';
import { Match, Bet, Challenge, ChallengeMatch, UserChallengeEntry, ChallengeStatus, DailyChallengeEntry, BoosterSelection, SwipeMatchDay, UserSwipeEntry, SwipePredictionOutcome, Profile, LevelConfig, Badge, UserBadge, FantasyGame, UserFantasyTeam, FantasyPlayer, ChallengeBet, UserLeague, LeagueMember } from './types';
import UpcomingPage from './pages/Upcoming';
import PlayedPage from './pages/Played';
import AdminPage from './pages/Admin';
import GamesListPage from './pages/GamesListPage';
import ChallengeRoomPage from './pages/ChallengeRoomPage';
import LeaderboardPage from './pages/LeaderboardPage';
import { JoinChallengeConfirmationModal } from './components/JoinChallengeConfirmationModal';
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
import { mockUserLeagues } from './data/mockUserLeagues';
import { mockLeagueMembers } from './data/mockLeagueMembers';


export type Page = 'challenges' | 'matches' | 'profile' | 'admin' | 'leagues';
type AuthFlowState = 'guest' | 'authenticated' | 'signing_up' | 'onboarding';

// Pre-populate user entries for testing purposes
const initialUserSwipeEntries: UserSwipeEntry[] = [
  {
    matchDayId: 'swipe-2',
    predictions: mockSwipeMatchDays.find(md => md.id === 'swipe-2')!.matches.map(m => ({
      matchId: m.id,
      prediction: ['teamA', 'draw', 'teamB'][Math.floor(Math.random() * 3)] as 'teamA'|'draw'|'teamB',
    })),
    isFinalized: true,
  }
];

function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const { toasts, addToast, removeToast } = useToast();
  const [allUsers, setAllUsers] = useState<Profile[]>(mockUsers);
  const [authFlow, setAuthFlow] = useState<AuthFlowState>('guest');
  const [showSignUpPrompt, setShowSignUpPrompt] = useState(false);
  const [isTestMode, setIsTestMode] = useState(false);

  const [page, setPage] = useState<Page>('challenges');
  const [matches, setMatches] = useState<Match[]>(mockMatches);
  const [bets, setBets] = useState<Bet[]>([]);
  const [modalState, setModalState] = useState<{ isOpen: boolean; match: Match | null; prediction: 'teamA' | 'draw' | 'teamB' | null; odds: number; }>({ isOpen: false, match: null, prediction: null, odds: 0 });

  // --- Game State ---
  const [challenges, setChallenges] = useState<Challenge[]>(mockChallenges);
  const [challengeMatches, setChallengeMatches] = useState<ChallengeMatch[]>(mockChallengeMatches);
  const [userChallengeEntries, setUserChallengeEntries] = useState<UserChallengeEntry[]>([]);
  const [swipeMatchDays, setSwipeMatchDays] = useState<SwipeMatchDay[]>(mockSwipeMatchDays);
  const [userSwipeEntries, setUserSwipeEntries] = useState<UserSwipeEntry[]>(initialUserSwipeEntries);
  const [fantasyGames, setFantasyGames] = useState<FantasyGame[]>([mockFantasyGame]);
  const [fantasyPlayers, setFantasyPlayers] = useState<FantasyPlayer[]>(mockFantasyPlayers);
  const [userFantasyTeams, setUserFantasyTeams] = useState<UserFantasyTeam[]>(mockUserFantasyTeams);
  
  // --- Progression State ---
  const [levelsConfig, setLevelsConfig] = useState<LevelConfig[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [userBadges, setUserBadges] = useState<UserBadge[]>(mockUserBadges);

  // --- League State ---
  const [userLeagues, setUserLeagues] = useState<UserLeague[]>(mockUserLeagues);
  const [leagueMembers, setLeagueMembers] = useState<LeagueMember[]>(mockLeagueMembers);
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
  const [boosterInfoPreferences, setBoosterInfoPreferences] = useState<{ x2: boolean, x3: boolean }>({ x2: false, x3: false });
  const [joinChallengeModalState, setJoinChallengeModalState] = useState<{ isOpen: boolean; challenge: Challenge | null; }>({ isOpen: false, challenge: null });
  const [joinSwipeGameModalState, setJoinSwipeGameModalState] = useState<{ isOpen: boolean; game: SwipeMatchDay | null; }>({ isOpen: false, game: null });
  const [hasSeenSwipeTutorial, setHasSeenSwipeTutorial] = useState(false);
  const [swipeGameViewMode, setSwipeGameViewMode] = useState<'swiping' | 'recap'>('swiping');

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

  // Effect for test mode
  useEffect(() => {
    const storedTestMode = localStorage.getItem('sportime_test_mode');
    if (storedTestMode) {
      setIsTestMode(JSON.parse(storedTestMode));
    }
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
        if (storedUserJson) {
            const user: Profile = JSON.parse(storedUserJson);
            setProfile(user);
            setAuthFlow(user.is_guest ? 'guest' : 'authenticated');
            if (!user.is_guest) {
                const userInDb = allUsers.find(u => u.id === user.id);
                if (!userInDb) setAllUsers(prev => [...prev, user]);
            }
        } else {
            const guestId = `guest-${uuidv4()}`;
            const guestProfile: Profile = {
                id: guestId,
                username: 'Guest',
                coins_balance: 1000,
                created_at: new Date().toISOString(),
                is_guest: true,
                verified: false,
                email: null,
            };
            localStorage.setItem('sportime_user', JSON.stringify(guestProfile));
            setProfile(guestProfile);
            setAuthFlow('guest');
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

  const handleSetCoinBalance = async (newBalance: number) => {
    if (profile) {
      const updatedProfile = { ...profile, coins_balance: newBalance };
      setProfile(updatedProfile);
      if (!profile.is_guest) {
          localStorage.setItem('sportime_user', JSON.stringify(updatedProfile));
      }
      if (USE_SUPABASE && !profile.is_guest) {
        await supabase.from('users').update({ coins_balance: newBalance }).eq('id', profile.id);
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
        setAllUsers(prev => [...prev, newUser]);
        setProfile(newUser);
        setAuthFlow('onboarding');
    };

    if (isTestMode) {
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
    setAllUsers(prev => prev.map(u => u.id === updatedProfile.id ? updatedProfile : u));
    localStorage.setItem('sportime_user', JSON.stringify(updatedProfile));
    addToast('Profile updated successfully!', 'success');
    setLoading(false);
  };

  const handleUpdateEmail = async (newEmail: string) => { /* ... */ };
  const handleDeleteAccount = async () => { /* ... */ };

  const handleCompleteOnboarding = (updatedProfile: Profile) => {
    const finalProfile = { ...updatedProfile, verified: true };
    setProfile(finalProfile);
    setAllUsers(prev => prev.map(u => u.id === finalProfile.id ? finalProfile : u));
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

  const handleAddMatch = (newMatchData: Omit<Match, 'id' | 'status'>) => {
    const newMatch: Match = { ...newMatchData, id: uuidv4(), status: 'upcoming' };
    setMatches([newMatch, ...matches]);
  };

  const handleUpdateMatch = (updatedMatch: Match) => {
    setMatches(matches.map(m => m.id === updatedMatch.id ? updatedMatch : m));
  };
  
  const handleResolveMatch = (matchId: string, result: 'teamA' | 'draw' | 'teamB', score: { teamA: number, teamB: number }) => {
    let totalPayout = 0;
    const updatedBets = bets.map(bet => {
      if (bet.matchId === matchId && bet.status === 'pending') {
        if (bet.prediction === result) {
          const winAmount = bet.amount * bet.odds;
          totalPayout += winAmount;
          return { ...bet, status: 'won' as const, winAmount };
        } else {
          return { ...bet, status: 'lost' as const };
        }
      }
      return bet;
    });
    const updatedMatches = matches.map(match => {
      if (match.id === matchId) {
        return { ...match, status: 'played' as const, result, score };
      }
      return match;
    });
    handleSetCoinBalance(coinBalance + totalPayout);
    setBets(updatedBets);
    setMatches(updatedMatches);
  };

  const handleJoinChallenge = (challengeId: string) => {
    if (profile?.is_guest) {
      handleTriggerSignUp();
      return;
    }
    const challengeToJoin = challenges.find(c => c.id === challengeId);
    if (challengeToJoin) setJoinChallengeModalState({ isOpen: true, challenge: challengeToJoin });
  };

  const handleConfirmJoinChallenge = async () => {
    const { challenge } = joinChallengeModalState;
    if (!challenge || !profile || profile.is_guest) return;

    if (coinBalance >= challenge.entryCost) {
        await handleSetCoinBalance(coinBalance - challenge.entryCost);

        const challengeDays = [...new Set(challengeMatches.filter(m => m.challengeId === challenge.id).map(m => m.day))];
        
        const newEntry: UserChallengeEntry = {
            challengeId: challenge.id,
            dailyEntries: challengeDays.map(day => ({
                day: day,
                bets: [],
            })),
        };

        setUserChallengeEntries(prev => [...prev, newEntry]);
        setJoinChallengeModalState({ isOpen: false, challenge: null });
        addToast(`Successfully joined "${challenge.name}"!`, 'success');
        setActiveChallengeId(challenge.id);
    } else {
        addToast('Insufficient funds to join this challenge.', 'error');
    }
  };
  const handleUpdateDailyBets = async (challengeId: string, day: number, newBets: ChallengeBet[]) => {
    setUserChallengeEntries(prev => prev.map(entry => {
      if (entry.challengeId === challengeId) {
        const newDailyEntries = entry.dailyEntries.map(daily => {
          if (daily.day === day) {
            return { ...daily, bets: newBets };
          }
          return daily;
        });
        return { ...entry, dailyEntries: newDailyEntries };
      }
      return entry;
    }));
    addToast('Bets updated for Day ' + day, 'info');
  };
  const handleSetDailyBooster = async (challengeId: string, day: number, booster: BoosterSelection | undefined) => {
    setUserChallengeEntries(prev => prev.map(entry => {
      if (entry.challengeId === challengeId) {
        const newDailyEntries = entry.dailyEntries.map(daily => {
          if (daily.day === day) {
            return { ...daily, booster };
          }
          return daily;
        });
        return { ...entry, dailyEntries: newDailyEntries };
      }
      return entry;
    }));
    if (booster) {
        addToast(`Booster applied!`, 'success');
    } else {
        addToast(`Booster removed.`, 'info');
    }
  };
  const handleUpdateChallengeStatus = (challengeId: string, status: ChallengeStatus) => { /* ... */ };
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
    const gameToJoin = swipeMatchDays.find(g => g.id === gameId);
    if (gameToJoin) setJoinSwipeGameModalState({ isOpen: true, game: gameToJoin });
  };

  const handleConfirmJoinSwipeGame = async () => {
    const { game } = joinSwipeGameModalState;
    if (!game || !profile || profile.is_guest) return;

    if (coinBalance >= game.entryCost) {
        await handleSetCoinBalance(coinBalance - game.entryCost);

        const newEntry: UserSwipeEntry = {
            matchDayId: game.id,
            predictions: [],
            isFinalized: false,
        };
        setUserSwipeEntries(prev => [...prev, newEntry]);

        setJoinSwipeGameModalState({ isOpen: false, game: null });
        addToast(`Successfully joined "${game.name}"!`, 'success');
        setSwipeGameViewMode('swiping');
        setActiveSwipeGameId(game.id);
    } else {
        addToast('Insufficient funds to join this game.', 'error');
    }
  };
  const handlePlaySwipeGame = (matchDayId: string) => {
    const matchDay = swipeMatchDays.find(md => md.id === matchDayId);
    const userEntry = userSwipeEntries.find(e => e.matchDayId === matchDayId);
    if (matchDay && userEntry) {
        const hasMadeAllPicks = userEntry.predictions.length >= matchDay.matches.length;
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
    setUserSwipeEntries(prev => {
        const oldEntry = prev.find(e => e.matchDayId === matchDayId);
        const oldPredictionsCount = oldEntry?.predictions.length || 0;

        const newEntries = prev.map(entry => {
            if (entry.matchDayId === matchDayId) {
                const existingPredictionIndex = entry.predictions.findIndex(p => p.matchId === matchId);
                let newPredictions = [...entry.predictions];
                if (existingPredictionIndex !== -1) {
                    newPredictions[existingPredictionIndex] = { matchId, prediction };
                } else {
                    newPredictions.push({ matchId, prediction });
                }

                const matchDay = swipeMatchDays.find(md => md.id === matchDayId);
                const totalMatches = matchDay?.matches.length || 0;
                const newPredictionsCount = newPredictions.length;

                // Only navigate to recap if we have just completed all predictions for the first time.
                if (matchDay && newPredictionsCount >= totalMatches && oldPredictionsCount < totalMatches) {
                    setTimeout(() => setSwipeGameViewMode('recap'), 350); // Allow animation to finish
                }

                return { ...entry, predictions: newPredictions };
            }
            return entry;
        });
        return newEntries;
    });
  };
  const handleUpdateSwipePrediction = (matchDayId: string, matchId: string, prediction: SwipePredictionOutcome) => {
    setUserSwipeEntries(prev => prev.map(entry => {
        if (entry.matchDayId === matchDayId) {
            const newPredictions = entry.predictions.map(p =>
                p.matchId === matchId ? { ...p, prediction } : p
            );
            return { ...entry, predictions: newPredictions };
        }
        return entry;
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

  const handleFinalizeSwipePicks = async (matchDayId: string) => { /* ... */ };
  const handleDismissSwipeTutorial = (dontShowAgain: boolean) => {
    if (dontShowAgain) {
      localStorage.setItem('sportime_seen_swipe_tutorial', 'true');
    }
    setHasSeenSwipeTutorial(true);
  };
  const handleViewFantasyGame = (gameId: string) => {
    setActiveFantasyGameId(gameId);
  };
  
  // Progression Handlers
  const handleAddLevel = async (levelData: Omit<LevelConfig, 'id'>) => { /* ... */ };
  const handleUpdateLevel = async (levelData: LevelConfig) => { /* ... */ };
  const handleDeleteLevel = async (levelId: string) => { /* ... */ };
  const handleAddBadge = async (badgeData: Omit<Badge, 'id' | 'created_at'>) => { /* ... */ };
  const handleUpdateBadge = async (badgeData: Badge) => { /* ... */ };
  const handleDeleteBadge = async (badgeId: string) => { /* ... */ };

  // --- League Handlers ---
  const handleCreateLeague = (name: string, description: string, image_url: string | null) => {
      if (!profile || profile.is_guest) {
          handleTriggerSignUp();
          return;
      }
      const invite_code = Math.random().toString(36).substring(2, 10).toUpperCase();
      const newLeague: UserLeague = {
          id: uuidv4(),
          name,
          description: description || undefined,
          image_url: image_url || undefined,
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
      setUserLeagues(prev => [...prev, newLeague]);
      setLeagueMembers(prev => [...prev, newAdminMember]);
      addToast(`League "${name}" created!`, 'success');
      setShowCreateLeagueModal(false);
      setActiveLeagueId(newLeague.id);
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
      const newMember: LeagueMember = {
          id: uuidv4(),
          league_id: league.id,
          user_id: profile.id,
          role: 'member',
          joined_at: new Date().toISOString(),
      };
      setLeagueMembers(prev => [...prev, newMember]);
      addToast(`Welcome to ${league.name}!`, 'success');
      setActiveLeagueId(league.id);
      setJoinLeagueCode(null);
  };

  const handleLeaveLeague = (leagueId: string) => {
      if (!profile) return;
      const memberEntry = leagueMembers.find(m => m.league_id === leagueId && m.user_id === profile.id);
      if (!memberEntry) return;

      let updatedLeagues = [...userLeagues];
      let updatedMembers = leagueMembers.filter(m => m.id !== memberEntry.id);

      if (memberEntry.role === 'admin') {
          const otherMembers = updatedMembers
              .filter(m => m.league_id === leagueId)
              .sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime());

          if (otherMembers.length > 0) {
              const newAdmin = otherMembers[0];
              updatedMembers = updatedMembers.map(m => m.id === newAdmin.id ? { ...m, role: 'admin' } : m);
              const league = userLeagues.find(l => l.id === leagueId);
              if (league) {
                  updatedLeagues = updatedLeagues.map(l => l.id === leagueId ? { ...l, created_by: newAdmin.user_id } : l);
              }
              addToast(`You left the league. Ownership transferred.`, 'info');
          } else {
              updatedLeagues = updatedLeagues.filter(l => l.id !== leagueId);
              addToast('League deleted as you were the last member.', 'info');
          }
      } else {
          addToast('You have left the league.', 'info');
      }

      setUserLeagues(updatedLeagues);
      setLeagueMembers(updatedMembers);
      setActiveLeagueId(null);
      setModalAction(null);
  };

  const handleDeleteLeague = (leagueId: string) => {
      setUserLeagues(prev => prev.filter(l => l.id !== leagueId));
      setLeagueMembers(prev => prev.filter(m => m.league_id !== leagueId));
      addToast('League deleted.', 'success');
      setActiveLeagueId(null);
      setModalAction(null);
  };
  
  const handleUpdateLeagueDetails = (leagueId: string, name: string, description: string, image_url: string | null) => {
      setUserLeagues(prev => prev.map(l => l.id === leagueId ? {...l, name, description: description || undefined, image_url: image_url || undefined} : l));
      addToast('League details updated!', 'success');
  };

  const handleRemoveLeagueMember = (leagueId: string, userId: string) => {
      setLeagueMembers(prev => prev.filter(m => !(m.league_id === leagueId && m.user_id === userId)));
      addToast('Member removed.', 'info');
  };

  const handleResetInviteCode = (leagueId: string) => {
      const newCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      setUserLeagues(prev => prev.map(l => l.id === leagueId ? {...l, invite_code: newCode} : l));
      addToast('Invite code has been reset.', 'success');
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
  }

  // --- Admin Test Mode Handlers ---
  const handleSetTestMode = (enabled: boolean) => {
    setIsTestMode(enabled);
    localStorage.setItem('sportime_test_mode', JSON.stringify(enabled));
    addToast(`Test Mode ${enabled ? 'Enabled' : 'Disabled'}`, 'info');
  };

  const handleResetTestUsers = async () => {
    await handleSignOut(); // Signs out current user, creates a new guest session
    setAllUsers([]); // Clears the list of registered users
    addToast('All test user accounts have been reset.', 'success');
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
      const challenge = challenges.find(c => c.id === viewingLeaderboardFor);
      const userEntry = userChallengeEntries.find(e => e.challengeId === viewingLeaderboardFor);
      if (challenge && userEntry) {
        return <LeaderboardPage
          challenge={challenge}
          matches={challengeMatches}
          userEntry={userEntry}
          onBack={() => setViewingLeaderboardFor(null)}
        />;
      }
    }

    if (activeChallengeId) {
      const challenge = challenges.find(c => c.id === activeChallengeId);
      const userEntry = userChallengeEntries.find(e => e.challengeId === activeChallengeId);
      if (challenge && userEntry) {
        return <ChallengeRoomPage
          challenge={challenge}
          matches={challengeMatches.filter(m => m.challengeId === activeChallengeId)}
          userEntry={userEntry}
          onUpdateDailyBets={handleUpdateDailyBets}
          onSetDailyBooster={handleSetDailyBooster}
          onBack={() => setActiveChallengeId(null)}
          onViewLeaderboard={() => setViewingLeaderboardFor(activeChallengeId)}
          boosterInfoPreferences={boosterInfoPreferences}
          onUpdateBoosterPreferences={handleUpdateBoosterPreferences}
        />;
      }
    }

    if (viewingSwipeLeaderboardFor) {
      const matchDay = swipeMatchDays.find(md => md.id === viewingSwipeLeaderboardFor);
      const userEntry = userSwipeEntries.find(e => e.matchDayId === viewingSwipeLeaderboardFor);
      if (matchDay && userEntry) {
        return <SwipeLeaderboardPage
          matchDay={matchDay}
          userEntry={userEntry}
          onBack={() => setViewingSwipeLeaderboardFor(null)}
        />;
      }
    }

    if (activeSwipeGameId) {
      const matchDay = swipeMatchDays.find(md => md.id === activeSwipeGameId);
      const userEntry = userSwipeEntries.find(e => e.matchDayId === activeSwipeGameId);

      if (matchDay && userEntry) {
        const isEditable = matchDay.status === 'Upcoming';
        
        if (swipeGameViewMode === 'swiping' && isEditable) {
          return <SwipeGamePage
            matchDay={matchDay}
            userEntry={userEntry}
            onSwipePrediction={handleSwipePrediction}
            hasSeenSwipeTutorial={hasSeenSwipeTutorial}
            onDismissTutorial={handleDismissSwipeTutorial}
            onExit={handleExitSwiping}
          />;
        } else {
          return <SwipeRecapPage
            allMatchDays={swipeMatchDays.filter(md => userSwipeEntries.some(e => e.matchDayId === md.id))}
            selectedMatchDayId={activeSwipeGameId}
            userEntry={userEntry}
            onBack={() => setActiveSwipeGameId(null)}
            onUpdatePrediction={isEditable ? handleUpdateSwipePrediction : undefined}
            onViewLeaderboard={() => setViewingSwipeLeaderboardFor(activeSwipeGameId)}
            onSelectMatchDay={handlePlaySwipeGame}
            onEditPicks={isEditable ? handleEditSwipePicks : undefined}
          />;
        }
      }
    }
    
    if (activeFantasyGameId) {
      const game = fantasyGames.find(g => g.id === activeFantasyGameId);
      if (game) {
        return <FantasyGameWeekPage
          game={game}
          userTeams={userFantasyTeams}
          allPlayers={fantasyPlayers}
          onBack={() => setActiveFantasyGameId(null)}
        />;
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
                onUpdateDetails={handleUpdateLeagueDetails}
                onRemoveMember={handleRemoveLeagueMember}
                onResetInviteCode={handleResetInviteCode}
                onLeave={() => setModalAction({type: 'leave', leagueId: league.id})}
                onDelete={() => setModalAction({type: 'delete', leagueId: league.id})}
            />;
        }
    }

    switch (page) {
      case 'matches':
        return <MatchesPage matches={matches} bets={bets} onBet={handleBetClick} />;
      case 'challenges':
        return <GamesListPage challenges={challenges} swipeMatchDays={swipeMatchDays} fantasyGames={fantasyGames} userChallengeEntries={userChallengeEntries} userSwipeEntries={userSwipeEntries} userFantasyTeams={userFantasyTeams} onJoinChallenge={handleJoinChallenge} onViewChallenge={setActiveChallengeId} onJoinSwipeGame={handleJoinSwipeGame} onPlaySwipeGame={handlePlaySwipeGame} onViewFantasyGame={handleViewFantasyGame} />;
      case 'leagues':
          if (!profile) return null;
          const userMemberOf = leagueMembers.filter(m => m.user_id === profile.id).map(m => m.league_id);
          const myLeagues = userLeagues.filter(l => userMemberOf.includes(l.id));
          return <LeaguesListPage 
              leagues={myLeagues}
              onCreate={() => setShowCreateLeagueModal(true)}
              onViewLeague={setActiveLeagueId}
          />;
      case 'admin':
        return <AdminPage matches={matches} onAddMatch={handleAddMatch} onUpdateMatch={handleUpdateMatch} onResolveMatch={handleResolveMatch} levels={levelsConfig} badges={badges} onAddLevel={handleAddLevel} onUpdateLevel={handleUpdateLevel} onDeleteLevel={handleDeleteLevel} onAddBadge={handleAddBadge} onUpdateBadge={handleUpdateBadge} onDeleteBadge={handleDeleteBadge} challenges={[]} challengeMatches={[]} swipeMatchDays={[]} onAddChallenge={() => {}} onAddChallengeMatch={() => {}} onResolveChallengeMatch={() => {}} onUpdateChallengeStatus={() => {}} onAddSwipeMatchDay={() => {}} onResolveSwipeMatch={() => {}} onUpdateSwipeMatchDayStatus={() => {}} isTestMode={isTestMode} onSetTestMode={handleSetTestMode} onResetTestUsers={handleResetTestUsers} profile={profile} onSetCoinBalance={handleSetCoinBalance} addToast={addToast} />;
      case 'profile':
        if (profile && !profile.is_guest) {
          return <ProfilePage profile={profile} levels={levelsConfig} allBadges={badges} userBadges={userBadges} onUpdateProfile={handleUpdateProfile} onUpdateEmail={handleUpdateEmail} onSignOut={handleSignOut} onDeleteAccount={handleDeleteAccount} />;
        }
        return null;
      default:
        return <GamesListPage challenges={challenges} swipeMatchDays={swipeMatchDays} fantasyGames={fantasyGames} userChallengeEntries={userChallengeEntries} userSwipeEntries={userSwipeEntries} userFantasyTeams={userFantasyTeams} onJoinChallenge={handleJoinChallenge} onViewChallenge={setActiveChallengeId} onJoinSwipeGame={handleJoinSwipeGame} onPlaySwipeGame={handlePlaySwipeGame} onViewFantasyGame={handleViewFantasyGame} />;
    }
  }
  
  const userBetForModal = modalState.match ? bets.find(b => b.matchId === modalState.match!.id) : undefined;

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-100"><div className="text-2xl font-semibold text-gray-500">Loading...</div></div>;
  }

  // --- Auth Flow Rendering ---
  if (authFlow === 'signing_up' || joinLeagueCode && profile?.is_guest) {
    return <SignUpStep onMagicLinkSent={handleMagicLinkSent} onBack={handleCancelSignUp} />;
  }
  if (authFlow === 'onboarding' && profile) {
    return <OnboardingPage profile={profile} onComplete={handleCompleteOnboarding} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-blue-50 to-pink-100">
      {isTestMode && (
        <div className="bg-yellow-100 text-yellow-800 text-sm text-center py-1 font-semibold shadow-sm">
          ⚠️ Test Mode Active — Email verification is bypassed
        </div>
      )}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <div className="max-w-md mx-auto px-4 pt-4 pb-28 space-y-4">
        <Header profile={profile} onViewProfile={() => handlePageChange('profile')} onSignIn={handleTriggerSignUp} />
        {renderPage()}
      </div>

      <FooterNav activePage={page} onPageChange={handlePageChange} />

      {modalState.match && modalState.prediction && ( <BetModal isOpen={modalState.isOpen} onClose={() => setModalState({ ...modalState, isOpen: false })} match={modalState.match} prediction={modalState.prediction} odds={modalState.odds} balance={coinBalance} onConfirm={handleConfirmBet} userBet={userBetForModal} onCancelBet={handleCancelBet} /> )}
      {joinChallengeModalState.isOpen && joinChallengeModalState.challenge && ( <JoinChallengeConfirmationModal isOpen={joinChallengeModalState.isOpen} onClose={() => setJoinChallengeModalState({ isOpen: false, challenge: null })} onConfirm={handleConfirmJoinChallenge} challenge={joinChallengeModalState.challenge} userBalance={coinBalance} /> )}
      {joinSwipeGameModalState.isOpen && joinSwipeGameModalState.game && ( <JoinSwipeGameConfirmationModal isOpen={joinSwipeGameModalState.isOpen} onClose={() => setJoinSwipeGameModalState({ isOpen: false, game: null })} onConfirm={handleConfirmJoinSwipeGame} game={joinSwipeGameModalState.game} userBalance={coinBalance} /> )}
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
    </div>
  );
}

export default App;
