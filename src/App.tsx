import React, { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { differenceInDays, parseISO } from 'date-fns';
import { Header } from './components/Header';
import { BetModal } from './components/BetModal';
import { FooterNav } from './components/FooterNav';
import { mockMatches } from './data/mockMatches';
import { mockChallenges, mockChallengeMatches } from './data/mockChallenges';
import { mockSwipeMatchDays } from './data/mockSwipeGames';
import { mockFantasyGame, mockFantasyPlayers, mockUserFantasyTeams } from './data/mockFantasy.tsx';
import { Match, Bet, Challenge, ChallengeMatch, UserChallengeEntry, ChallengeStatus, DailyChallengeEntry, BoosterSelection, SwipeMatchDay, UserSwipeEntry, SwipePredictionOutcome, Profile, LevelConfig, Badge, UserBadge, FantasyGame, UserFantasyTeam, FantasyPlayer } from './types';
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
import { Session } from '@supabase/supabase-js';
import { MagicLinkModal } from './components/MagicLinkModal';
import { useToast } from './hooks/useToast';
import { ToastContainer } from './components/Toast';
import ProfilePage from './pages/ProfilePage';
import { mockBadges, mockLevelsConfig, mockUserBadges } from './data/mockProgression';
import MatchesPage from './pages/MatchesPage';
import { FantasyGameWeekPage } from './pages/FantasyGameWeekPage';


export type Page = 'challenges' | 'matches' | 'profile' | 'admin';

const MOCK_SIGNED_IN = true;
const MOCK_EMAIL = 'saadjennane@gmail.com';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const { toasts, addToast, removeToast } = useToast();

  const [page, setPage] = useState<Page>('challenges');
  const [matches, setMatches] = useState<Match[]>(mockMatches);
  const [bets, setBets] = useState<Bet[]>([]);
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    match: Match | null;
    prediction: 'teamA' | 'draw' | 'teamB' | null;
    odds: number;
  }>({
    isOpen: false,
    match: null,
    prediction: null,
    odds: 0
  });

  // --- Game State ---
  const [challenges, setChallenges] = useState<Challenge[]>(mockChallenges);
  const [challengeMatches, setChallengeMatches] = useState<ChallengeMatch[]>(mockChallengeMatches);
  const [userChallengeEntries, setUserChallengeEntries] = useState<UserChallengeEntry[]>([]);
  const [swipeMatchDays, setSwipeMatchDays] = useState<SwipeMatchDay[]>(mockSwipeMatchDays);
  const [userSwipeEntries, setUserSwipeEntries] = useState<UserSwipeEntry[]>([]);
  const [fantasyGames, setFantasyGames] = useState<FantasyGame[]>([mockFantasyGame]);
  const [fantasyPlayers, setFantasyPlayers] = useState<FantasyPlayer[]>(mockFantasyPlayers);
  const [userFantasyTeams, setUserFantasyTeams] = useState<UserFantasyTeam[]>(mockUserFantasyTeams);
  
  // --- Progression State ---
  const [levelsConfig, setLevelsConfig] = useState<LevelConfig[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [userBadges, setUserBadges] = useState<UserBadge[]>(mockUserBadges);

  // --- UI State ---
  const [activeChallengeId, setActiveChallengeId] = useState<string | null>(null);
  const [viewingLeaderboardFor, setViewingLeaderboardFor] = useState<string | null>(null);
  const [activeSwipeGameId, setActiveSwipeGameId] = useState<string | null>(null);
  const [viewingSwipeLeaderboardFor, setViewingSwipeLeaderboardFor] = useState<string | null>(null);
  const [activeFantasyGameId, setActiveFantasyGameId] = useState<string | null>(null);
  const [boosterInfoPreferences, setBoosterInfoPreferences] = useState<{ x2: boolean, x3: boolean }>({ x2: false, x3: false });
  const [joinChallengeModalState, setJoinChallengeModalState] = useState<{ isOpen: boolean; challenge: Challenge | null; }>({ isOpen: false, challenge: null });
  const [joinSwipeGameModalState, setJoinSwipeGameModalState] = useState<{ isOpen: boolean; game: SwipeMatchDay | null; }>({ isOpen: false, game: null });
  const [magicLinkModalOpen, setMagicLinkModalOpen] = useState(false);
  const [hasSeenSwipeTutorial, setHasSeenSwipeTutorial] = useState(false);
  const [swipeGameViewMode, setSwipeGameViewMode] = useState<'swiping' | 'recap'>('swiping');

  // Effect for static data (runs once)
  useEffect(() => {
    const fetchStaticData = async () => {
      const { data: levelsData } = await supabase.from('levels_config').select('*');
      const { data: badgesData } = await supabase.from('badges').select('*');
      setLevelsConfig((levelsData && levelsData.length > 0) ? levelsData : mockLevelsConfig);
      setBadges((badgesData && badgesData.length > 0) ? badgesData : mockBadges);
    };
    fetchStaticData();
  }, []);

  // Main Auth Effect
  useEffect(() => {
    if (MOCK_SIGNED_IN) {
      setLoading(true);
      const mockProfile: Profile = {
        id: 'mock-user-saad-jennane',
        email: MOCK_EMAIL,
        username: MOCK_EMAIL.split('@')[0],
        coins_balance: 50000,
        created_at: new Date().toISOString(),
        is_guest: false,
        level: 'Pro',
        xp: 2500,
        is_admin: true,
      };
      setProfile(mockProfile);
      setUserBadges(mockUserBadges);
      setUserFantasyTeams(mockUserFantasyTeams);
      setLoading(false);
      return; // Skip real auth logic
    }

    setLoading(true);
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        // ... (real auth logic remains unchanged)
      }
    );
    
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setProfile({ id: uuidv4(), username: 'Guest', coins_balance: 1000, created_at: new Date().toISOString(), is_guest: true });
        setUserBadges(mockUserBadges);
        setLoading(false);
      }
    };
    getInitialSession();

    return () => subscription.unsubscribe();
  }, [addToast]);

  const coinBalance = profile?.coins_balance ?? 0;

  const handleSetCoinBalance = async (newBalance: number) => {
    if (profile) {
      setProfile({ ...profile, coins_balance: newBalance });
      if (!profile.is_guest) {
        await supabase.from('users').update({ coins_balance: newBalance }).eq('id', profile.id);
      }
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setPage('challenges');
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

  // --- Betting Challenge Handlers ---
  const handleJoinChallenge = (challengeId: string) => {
    if (profile?.is_guest) {
      setMagicLinkModalOpen(true);
      return;
    }
    const challengeToJoin = challenges.find(c => c.id === challengeId);
    if (challengeToJoin) {
      setJoinChallengeModalState({ isOpen: true, challenge: challengeToJoin });
    }
  };

  const handleConfirmJoinChallenge = async () => {
    const challenge = joinChallengeModalState.challenge;
    if (!challenge || !profile || coinBalance < challenge.entryCost || userChallengeEntries.some(e => e.challengeId === challenge.id)) {
      setJoinChallengeModalState({ isOpen: false, challenge: null });
      return;
    }
    
    handleSetCoinBalance(coinBalance - challenge.entryCost);

    const startDate = parseISO(challenge.startDate);
    const endDate = parseISO(challenge.endDate);
    const numDays = differenceInDays(endDate, startDate) + 1;
    const dailyEntries: DailyChallengeEntry[] = Array.from({ length: numDays }, (_, i) => ({ day: i + 1, bets: [] }));
    const newEntry: UserChallengeEntry = { challengeId: challenge.id, dailyEntries };

    if (!profile.is_guest) {
      await supabase.from('user_challenge_entries').insert([{ ...newEntry, user_id: profile.id }]);
    }
    setUserChallengeEntries([...userChallengeEntries, newEntry]);
    setJoinChallengeModalState({ isOpen: false, challenge: null });
  };

  const handleUpdateDailyBets = async (challengeId: string, day: number, newBets: ChallengeBet[]) => {
    const newEntries = userChallengeEntries.map(entry =>
      entry.challengeId === challengeId
        ? { ...entry, dailyEntries: entry.dailyEntries.map(daily => daily.day === day ? { ...daily, bets: newBets } : daily) }
        : entry
    );
    setUserChallengeEntries(newEntries);
    if (!profile?.is_guest) {
      const entryToUpdate = newEntries.find(e => e.challengeId === challengeId);
      if (entryToUpdate) {
        await supabase.from('user_challenge_entries').update({ dailyEntries: entryToUpdate.dailyEntries }).match({ user_id: profile.id, challengeId });
      }
    }
  };

  const handleSetDailyBooster = async (challengeId: string, day: number, booster: BoosterSelection | undefined) => {
    const newEntries = userChallengeEntries.map(entry =>
      entry.challengeId === challengeId
        ? { ...entry, dailyEntries: entry.dailyEntries.map(daily => daily.day === day ? { ...daily, booster } : daily) }
        : entry
    );
    setUserChallengeEntries(newEntries);
    if (!profile?.is_guest) {
      const entryToUpdate = newEntries.find(e => e.challengeId === challengeId);
      if (entryToUpdate) {
        await supabase.from('user_challenge_entries').update({ dailyEntries: entryToUpdate.dailyEntries }).match({ user_id: profile.id, challengeId });
      }
    }
  };
  
  const handleUpdateChallengeStatus = (challengeId: string, status: ChallengeStatus) => {
    setChallenges(prev => prev.map(c => c.id === challengeId ? {...c, status} : c));
  };

  const handleUpdateBoosterPreferences = (booster: 'x2' | 'x3') => {
    setBoosterInfoPreferences(prev => ({ ...prev, [booster]: true }));
  };
  
  // --- Swipe Game Handlers ---
  const handleJoinSwipeGame = (gameId: string) => {
    if (profile?.is_guest) {
      setMagicLinkModalOpen(true);
      return;
    }
    const gameToJoin = swipeMatchDays.find(g => g.id === gameId);
    if (gameToJoin) {
      setJoinSwipeGameModalState({ isOpen: true, game: gameToJoin });
    }
  };

  const handleConfirmJoinSwipeGame = async () => {
    const game = joinSwipeGameModalState.game;
    if (!game || !profile || coinBalance < game.entryCost || userSwipeEntries.some(e => e.matchDayId === game.id)) {
      setJoinSwipeGameModalState({ isOpen: false, game: null });
      return;
    }
    handleSetCoinBalance(coinBalance - game.entryCost);
    const newEntry: UserSwipeEntry = { matchDayId: game.id, predictions: [], isFinalized: false };
    
    if (!profile.is_guest) {
      await supabase.from('user_swipe_entries').insert([{ ...newEntry, user_id: profile.id }]);
    }
    setUserSwipeEntries([...userSwipeEntries, newEntry]);
    setJoinSwipeGameModalState({ isOpen: false, game: null });
    setSwipeGameViewMode('swiping');
    setActiveSwipeGameId(game.id);
  };

  const handlePlaySwipeGame = (matchDayId: string) => {
    const userEntry = userSwipeEntries.find(e => e.matchDayId === matchDayId);
    if (userEntry?.isFinalized) {
      setSwipeGameViewMode('recap');
    } else {
      setSwipeGameViewMode('swiping');
    }
    setActiveSwipeGameId(matchDayId);
  };

  const handleSwipePrediction = async (matchDayId: string, matchId: string, prediction: SwipePredictionOutcome) => {
    const newEntries = userSwipeEntries.map(entry => {
      if (entry.matchDayId === matchDayId) {
        const newPredictions = [...entry.predictions];
        const existingPredIndex = newPredictions.findIndex(p => p.matchId === matchId);
        if (existingPredIndex > -1) {
          newPredictions[existingPredIndex] = { matchId, prediction };
        } else {
          newPredictions.push({ matchId, prediction });
        }
        return { ...entry, predictions: newPredictions };
      }
      return entry;
    });
    setUserSwipeEntries(newEntries);
    if (!profile?.is_guest) {
      const entryToUpdate = newEntries.find(e => e.matchDayId === matchDayId);
      if(entryToUpdate) {
        await supabase.from('user_swipe_entries').update({ predictions: entryToUpdate.predictions }).match({ user_id: profile.id, matchDayId });
      }
    }
  };

  const handleUpdateSwipePrediction = handleSwipePrediction;

  const handleFinalizeSwipePicks = async (matchDayId: string) => {
    const newEntries = userSwipeEntries.map(e => e.matchDayId === matchDayId ? { ...e, isFinalized: true } : e);
    setUserSwipeEntries(newEntries);
    if (!profile?.is_guest) {
      await supabase.from('user_swipe_entries').update({ isFinalized: true }).match({ user_id: profile.id, matchDayId });
    }
    setSwipeGameViewMode('recap');
  };
  
  const handleDismissSwipeTutorial = (dontShowAgain: boolean) => {
    if (dontShowAgain) setHasSeenSwipeTutorial(true);
  };

  // --- Fantasy Game Handlers ---
  const handleViewFantasyGame = (gameId: string) => {
    setActiveFantasyGameId(gameId);
  };
  
  // --- Progression Handlers ---
  const handleAddLevel = async (levelData: Omit<LevelConfig, 'id'>) => {
    const { data, error } = await supabase.from('levels_config').insert([levelData]).select().single();
    if (data) setLevelsConfig(prev => [...prev, data].sort((a, b) => a.min_xp - b.min_xp));
    if (error) addToast(`Error adding level: ${error.message}`, 'error');
  };

  const handleUpdateLevel = async (levelData: LevelConfig) => {
    const { data, error } = await supabase.from('levels_config').update(levelData).eq('id', levelData.id).select().single();
    if (data) setLevelsConfig(prev => prev.map(l => l.id === data.id ? data : l).sort((a, b) => a.min_xp - b.min_xp));
    if (error) addToast(`Error updating level: ${error.message}`, 'error');
  };

  const handleDeleteLevel = async (levelId: string) => {
    const { error } = await supabase.from('levels_config').delete().eq('id', levelId);
    if (!error) setLevelsConfig(prev => prev.filter(l => l.id !== levelId));
    else addToast(`Error deleting level: ${error.message}`, 'error');
  };

  const handleAddBadge = async (badgeData: Omit<Badge, 'id' | 'created_at'>) => {
    const { data, error } = await supabase.from('badges').insert([badgeData]).select().single();
    if (data) setBadges(prev => [...prev, data]);
    if (error) addToast(`Error adding badge: ${error.message}`, 'error');
  };

  const handleUpdateBadge = async (badgeData: Badge) => {
    const { data, error } = await supabase.from('badges').update(badgeData).eq('id', badgeData.id).select().single();
    if (data) setBadges(prev => prev.map(b => b.id === data.id ? data : b));
    if (error) addToast(`Error updating badge: ${error.message}`, 'error');
  };

  const handleDeleteBadge = async (badgeId: string) => {
    const { error } = await supabase.from('badges').delete().eq('id', badgeId);
    if (!error) setBadges(prev => prev.filter(b => b.id !== badgeId));
    else addToast(`Error deleting badge: ${error.message}`, 'error');
  };

  // --- Page Navigation ---
  const handlePageChange = (newPage: Page) => {
    setPage(newPage);
    setActiveChallengeId(null);
    setViewingLeaderboardFor(null);
    setActiveSwipeGameId(null);
    setViewingSwipeLeaderboardFor(null);
    setActiveFantasyGameId(null);
  }

  const renderPage = () => {
    // Fantasy Game Flow
    if (activeFantasyGameId) {
      const game = fantasyGames.find(g => g.id === activeFantasyGameId);
      if (game) {
        return <FantasyGameWeekPage 
          game={game} 
          userTeams={userFantasyTeams} 
          allPlayers={fantasyPlayers} 
          onBack={() => setActiveFantasyGameId(null)} 
        />
      }
    }
    
    // Betting Challenge Flow
    if (viewingLeaderboardFor) {
      const challenge = challenges.find(c => c.id === viewingLeaderboardFor);
      const matchesForChallenge = challengeMatches.filter(m => m.challengeId === viewingLeaderboardFor);
      const userEntry = userChallengeEntries.find(e => e.challengeId === viewingLeaderboardFor);
      if (challenge && userEntry) {
        return <LeaderboardPage challenge={challenge} matches={matchesForChallenge} userEntry={userEntry} onBack={() => setViewingLeaderboardFor(null)} />
      }
    }
    if (activeChallengeId) {
      const challenge = challenges.find(c => c.id === activeChallengeId);
      const matchesForChallenge = challengeMatches.filter(m => m.challengeId === activeChallengeId);
      const userEntry = userChallengeEntries.find(e => e.challengeId === activeChallengeId);
      if (challenge && userEntry) {
        return <ChallengeRoomPage challenge={challenge} matches={matchesForChallenge} userEntry={userEntry} onUpdateDailyBets={handleUpdateDailyBets} onSetDailyBooster={handleSetDailyBooster} onBack={() => setActiveChallengeId(null)} onViewLeaderboard={setViewingLeaderboardFor} boosterInfoPreferences={boosterInfoPreferences} onUpdateBoosterPreferences={handleUpdateBoosterPreferences} />
      }
    }

    // Swipe Game Flow
    if (viewingSwipeLeaderboardFor) {
      const matchDay = swipeMatchDays.find(md => md.id === viewingSwipeLeaderboardFor);
      const userEntry = userSwipeEntries.find(e => e.matchDayId === viewingSwipeLeaderboardFor);
      if (matchDay && userEntry) {
        return <SwipeLeaderboardPage matchDay={matchDay} userEntry={userEntry} onBack={() => setViewingSwipeLeaderboardFor(null)} />
      }
    }
    if (activeSwipeGameId) {
      const matchDay = swipeMatchDays.find(md => md.id === activeSwipeGameId);
      const userEntry = userSwipeEntries.find(e => e.matchDayId === activeSwipeGameId);
      if (matchDay && userEntry) {
        if (swipeGameViewMode === 'recap') {
          return <SwipeRecapPage matchDay={matchDay} userEntry={userEntry} onBack={() => setActiveSwipeGameId(null)} onUpdatePrediction={handleUpdateSwipePrediction} onViewLeaderboard={setViewingSwipeLeaderboardFor} onToggleView={() => setSwipeGameViewMode('swiping')} />;
        }
        return <SwipeGamePage matchDay={matchDay} userEntry={userEntry} onSwipePrediction={handleSwipePrediction} onAllSwipesDone={() => handleFinalizeSwipePicks(matchDay.id)} hasSeenSwipeTutorial={hasSeenSwipeTutorial} onDismissTutorial={handleDismissSwipeTutorial} onExit={() => setSwipeGameViewMode('recap')} />;
      }
    }

    switch (page) {
      case 'matches':
        return <MatchesPage matches={matches} bets={bets} onBet={handleBetClick} />;
      case 'challenges':
        return <GamesListPage 
          challenges={challenges} 
          swipeMatchDays={swipeMatchDays} 
          fantasyGames={fantasyGames}
          userChallengeEntries={userChallengeEntries} 
          userSwipeEntries={userSwipeEntries}
          userFantasyTeams={userFantasyTeams}
          onJoinChallenge={handleJoinChallenge} 
          onViewChallenge={setActiveChallengeId} 
          onJoinSwipeGame={handleJoinSwipeGame} 
          onPlaySwipeGame={handlePlaySwipeGame} 
          onViewFantasyGame={handleViewFantasyGame}
        />;
      case 'admin':
        return <AdminPage 
          matches={matches} 
          onAddMatch={handleAddMatch} 
          onUpdateMatch={handleUpdateMatch} 
          onResolveMatch={handleResolveMatch} 
          levels={levelsConfig}
          badges={badges}
          onAddLevel={handleAddLevel}
          onUpdateLevel={handleUpdateLevel}
          onDeleteLevel={handleDeleteLevel}
          onAddBadge={handleAddBadge}
          onUpdateBadge={handleUpdateBadge}
          onDeleteBadge={handleDeleteBadge}
          // Obsolete props below, will be removed
          challenges={[]} 
          challengeMatches={[]} 
          swipeMatchDays={[]} 
          onAddChallenge={() => {}} 
          onAddChallengeMatch={() => {}} 
          onResolveChallengeMatch={() => {}} 
          onUpdateChallengeStatus={() => {}} 
          onAddSwipeMatchDay={() => {}} 
          onResolveSwipeMatch={() => {}} 
          onUpdateSwipeMatchDayStatus={() => {}}
        />;
      case 'profile':
        if (profile) {
          return <ProfilePage profile={profile} levels={levelsConfig} allBadges={badges} userBadges={userBadges} />;
        }
        return null;
      default:
        return <GamesListPage 
          challenges={challenges} 
          swipeMatchDays={swipeMatchDays} 
          fantasyGames={fantasyGames}
          userChallengeEntries={userChallengeEntries} 
          userSwipeEntries={userSwipeEntries}
          userFantasyTeams={userFantasyTeams}
          onJoinChallenge={handleJoinChallenge} 
          onViewChallenge={setActiveChallengeId} 
          onJoinSwipeGame={handleJoinSwipeGame} 
          onPlaySwipeGame={handlePlaySwipeGame}
          onViewFantasyGame={handleViewFantasyGame}
        />;
    }
  }
  
  const userBetForModal = modalState.match ? bets.find(b => b.matchId === modalState.match!.id) : undefined;

  if (loading && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-2xl font-semibold text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-blue-50 to-pink-100">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <div className="max-w-md mx-auto px-4 pt-4 pb-28 space-y-4">
        <Header profile={profile} onSignOut={handleSignOut} onSignIn={() => setMagicLinkModalOpen(true)} />
        {renderPage()}
      </div>

      <FooterNav activePage={page} onPageChange={handlePageChange} />

      {modalState.match && modalState.prediction && (
        <BetModal isOpen={modalState.isOpen} onClose={() => setModalState({ ...modalState, isOpen: false })} match={modalState.match} prediction={modalState.prediction} odds={modalState.odds} balance={coinBalance} onConfirm={handleConfirmBet} userBet={userBetForModal} onCancelBet={handleCancelBet} />
      )}

      {joinChallengeModalState.isOpen && joinChallengeModalState.challenge && (
        <JoinChallengeConfirmationModal isOpen={joinChallengeModalState.isOpen} onClose={() => setJoinChallengeModalState({ isOpen: false, challenge: null })} onConfirm={handleConfirmJoinChallenge} challenge={joinChallengeModalState.challenge} userBalance={coinBalance} />
      )}

      {joinSwipeGameModalState.isOpen && joinSwipeGameModalState.game && (
        <JoinSwipeGameConfirmationModal isOpen={joinSwipeGameModalState.isOpen} onClose={() => setJoinSwipeGameModalState({ isOpen: false, game: null })} onConfirm={handleConfirmJoinSwipeGame} game={joinSwipeGameModalState.game} userBalance={coinBalance} />
      )}
      
      <MagicLinkModal isOpen={magicLinkModalOpen} onClose={() => setMagicLinkModalOpen(false)} />
    </div>
  );
}

export default App;
