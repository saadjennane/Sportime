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
import { Match, Bet, Challenge, ChallengeMatch, UserChallengeEntry, ChallengeStatus, DailyChallengeEntry, BoosterSelection, SwipeMatchDay, UserSwipeEntry, SwipePredictionOutcome, Profile, LevelConfig, Badge, UserBadge, League, LeagueMember } from './types';
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
import { mockBadges, mockLevelsConfig } from './data/mockProgression';
import { mockUserProfile, mockUserBadgesData } from './data/mockUsers';
import MatchesPage from './pages/MatchesPage';
import { FantasyGameWeekPage } from './pages/FantasyGameWeekPage';
import LeaguesListPage from './pages/leagues/LeaguesListPage';
import LeagueDetailPage from './pages/leagues/LeagueDetailPage';
import LeagueJoinPage from './pages/leagues/LeagueJoinPage';
import { mockLeaguesData } from './data/mockLeagues';
import { USE_SUPABASE } from './config/env';


export type Page = 'challenges' | 'matches' | 'profile' | 'admin' | 'leagues';

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
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const { toasts, addToast, removeToast } = useToast();

  const [page, setPage] = useState<Page>('leagues');
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
  const [userSwipeEntries, setUserSwipeEntries] = useState<UserSwipeEntry[]>(initialUserSwipeEntries);
  const [fantasyGames, setFantasyGames] = useState<any[]>([mockFantasyGame]);
  const [fantasyPlayers, setFantasyPlayers] = useState<FantasyPlayer[]>(mockFantasyPlayers);
  const [userFantasyTeams, setUserFantasyTeams] = useState<UserFantasyTeam[]>(mockUserFantasyTeams);
  
  // --- Progression State ---
  const [levelsConfig, setLevelsConfig] = useState<LevelConfig[]>(mockLevelsConfig);
  const [badges, setBadges] = useState<Badge[]>(mockBadges);
  const [userBadges, setUserBadges] = useState<UserBadge[]>(mockUserBadgesData);

  // --- League State (Using Mock Data) ---
  const [leagues, setLeagues] = useState<League[]>(mockLeaguesData);
  const [activeLeague, setActiveLeague] = useState<League | null>(null);
  const [viewingInviteCode, setViewingInviteCode] = useState<string | null>(null);

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

  // Parse URL for league invites
  useEffect(() => {
    const path = window.location.pathname;
    const joinMatch = path.match(/\/join\/([a-zA-Z0-9_-]+)/);
    if (joinMatch && joinMatch[1]) {
      setViewingInviteCode(joinMatch[1]);
    }
  }, []);

  // Main Auth Effect
  useEffect(() => {
    if (!USE_SUPABASE) {
      setLoading(true);
      setTimeout(() => {
        setProfile(mockUserProfile);
        setUserBadges(mockUserBadgesData);
        setUserFantasyTeams(mockUserFantasyTeams);
        setLeagues(mockLeaguesData);
        setLoading(false);
      }, 500); // Simulate network delay
      return;
    }

    // --- Real Supabase Auth Logic ---
    const getInitialData = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);

      if (session) {
        const { data: profileData, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (error) {
          addToast('Could not fetch your profile.', 'error');
        } else {
          setProfile(profileData);
        }
      }
      setLoading(false);
    };

    getInitialData();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (_event === 'SIGNED_IN' && session) {
        // Fetch profile on sign in
      } else if (_event === 'SIGNED_OUT') {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [addToast]);

  const coinBalance = profile?.coins_balance ?? 0;

  const handleSetCoinBalance = async (newBalance: number) => {
    if (profile) {
      setProfile({ ...profile, coins_balance: newBalance });
    }
  };

  const handleSignOut = async () => {
    setProfile(null);
    setPage('challenges');
    addToast('You have been signed out.', 'info');
  };

  const handleUpdateProfile = async (updatedData: { username: string; newProfilePic: File | null; }) => {
    if (!profile) return;
    addToast('Profile updated (mock)!', 'success');
    setProfile({
        ...profile,
        username: updatedData.username,
        profile_picture_url: updatedData.newProfilePic ? URL.createObjectURL(updatedData.newProfilePic) : profile.profile_picture_url,
    });
  };

  const handleUpdateEmail = async (newEmail: string) => {
    addToast('Email verification sent (mock).', 'info');
  };

  const handleDeleteAccount = async () => {
    addToast('Account deleted (mock).', 'success');
    await handleSignOut();
  };

  // --- League Handlers (Mock Data) ---
  const handleCreateLeague = async (name: string, description: string | null): Promise<League | null> => {
    return new Promise(resolve => {
      setTimeout(() => {
        if (!profile) {
          addToast('You must be signed in.', 'error');
          resolve(null);
          return;
        }
        const newLeague: League = {
          id: uuidv4(),
          name,
          description,
          image_url: null,
          invite_code: Math.random().toString(36).substring(2, 10).toUpperCase(),
          created_by: profile.id,
          created_at: new Date().toISOString(),
          member_count: 1,
          members: [{
            role: 'admin',
            user: {
              id: profile.id,
              username: profile.username,
              profile_picture_url: profile.profile_picture_url || null,
            }
          }]
        };
        setLeagues(prev => [...prev, newLeague]);
        addToast(`League '${name}' created!`, 'success');
        setActiveLeague(newLeague);
        resolve(newLeague);
      }, 500);
    });
  };

  const handleJoinLeague = (inviteCode: string) => {
    if (!profile) return;
    const leagueToJoin = leagues.find(l => l.invite_code === inviteCode);
    if (!leagueToJoin) {
      addToast('Invalid invite code.', 'error');
      return;
    }
    if (leagueToJoin.members?.some(m => m.user.id === profile.id)) {
      addToast('You are already a member.', 'info');
      setActiveLeague(leagueToJoin);
      setViewingInviteCode(null);
      return;
    }

    const newMember: LeagueMember = {
      role: 'member',
      user: {
        id: profile.id,
        username: profile.username,
        profile_picture_url: profile.profile_picture_url || null,
      }
    };

    const updatedLeague: League = {
      ...leagueToJoin,
      members: [...(leagueToJoin.members || []), newMember],
      member_count: (leagueToJoin.member_count || 0) + 1,
    };

    setLeagues(prev => prev.map(l => l.id === leagueToJoin.id ? updatedLeague : l));
    addToast(`Successfully joined '${leagueToJoin.name}'!`, 'success');
    setActiveLeague(updatedLeague);
    setViewingInviteCode(null);
  };

  const handleLeaveLeague = (leagueId: string) => {
    if (!profile) return;
    const league = leagues.find(l => l.id === leagueId);
    if (!league) return;

    const updatedMembers = league.members?.filter(m => m.user.id !== profile.id);

    if (updatedMembers && updatedMembers.length > 0) {
      let updatedLeague = { ...league, members: updatedMembers, member_count: updatedMembers.length };
      // Transfer ownership if admin leaves
      if (league.created_by === profile.id) {
        updatedLeague.created_by = updatedMembers[0].user.id;
        updatedMembers[0].role = 'admin';
      }
      setLeagues(prev => prev.map(l => l.id === leagueId ? updatedLeague : l));
    } else {
      // Delete league if last member leaves
      setLeagues(prev => prev.filter(l => l.id !== leagueId));
    }
    addToast('You have left the league.', 'info');
    setActiveLeague(null);
  };

  const handleResetInviteCode = (leagueId: string) => {
    const newCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    setLeagues(prev => prev.map(l => l.id === leagueId ? { ...l, invite_code: newCode } : l));
    if (activeLeague?.id === leagueId) {
      setActiveLeague(prev => prev ? { ...prev, invite_code: newCode } : null);
    }
    addToast('Invite link has been reset!', 'success');
  };

  const handleUpdateLeague = (leagueId: string, name: string, description: string | null) => {
    setLeagues(prev => prev.map(l => l.id === leagueId ? { ...l, name, description } : l));
    if (activeLeague?.id === leagueId) {
      setActiveLeague(prev => prev ? { ...prev, name, description } : null);
    }
    addToast('League updated successfully!', 'success');
  };

  const handleDeleteLeague = (leagueId: string) => {
    setLeagues(prev => prev.filter(l => l.id !== leagueId));
    addToast('League deleted.', 'info');
    setActiveLeague(null);
  };

  const handleViewLeague = (leagueId: string) => {
    const league = leagues.find(l => l.id === leagueId);
    if (league) {
      setActiveLeague(league);
    } else {
      addToast('Could not find league.', 'error');
    }
  };

  // --- Other handlers (unchanged) ---
  const handleBetClick = (match: Match, prediction: 'teamA' | 'draw' | 'teamB', odds: number) => setModalState({ isOpen: true, match, prediction, odds });
  const handleConfirmBet = (amount: number, prediction: 'teamA' | 'draw' | 'teamB', odds: number) => { /* ... */ };
  const handleCancelBet = (matchId: string) => { /* ... */ };
  const handleAddMatch = (newMatchData: Omit<Match, 'id' | 'status'>) => { /* ... */ };
  const handleUpdateMatch = (updatedMatch: Match) => { /* ... */ };
  const handleResolveMatch = (matchId: string, result: 'teamA' | 'draw' | 'teamB', score: { teamA: number, teamB: number }) => { /* ... */ };
  const handleJoinChallenge = (challengeId: string) => { /* ... */ };
  const handleConfirmJoinChallenge = async () => { /* ... */ };
  const handleUpdateDailyBets = async (challengeId: string, day: number, newBets: any[]) => { /* ... */ };
  const handleSetDailyBooster = async (challengeId: string, day: number, booster: any) => { /* ... */ };
  const handleUpdateChallengeStatus = (challengeId: string, status: ChallengeStatus) => { /* ... */ };
  const handleUpdateBoosterPreferences = (booster: 'x2' | 'x3') => { /* ... */ };
  const handleJoinSwipeGame = (gameId: string) => { /* ... */ };
  const handleConfirmJoinSwipeGame = async () => { /* ... */ };
  const handlePlaySwipeGame = (matchDayId: string) => { /* ... */ };
  const handleSwipePrediction = useCallback(async (matchDayId: string, matchId: string, prediction: SwipePredictionOutcome) => { /* ... */ }, [profile, addToast]);
  const handleUpdateSwipePrediction = handleSwipePrediction;
  const handleFinalizeSwipePicks = async (matchDayId: string) => { /* ... */ };
  const handleDismissSwipeTutorial = (dontShowAgain: boolean) => { /* ... */ };
  const handleViewFantasyGame = (gameId: string) => setActiveFantasyGameId(gameId);
  const handleAddLevel = async (levelData: Omit<LevelConfig, 'id'>) => { /* ... */ };
  const handleUpdateLevel = async (levelData: LevelConfig) => { /* ... */ };
  const handleDeleteLevel = async (levelId: string) => { /* ... */ };
  const handleAddBadge = async (badgeData: Omit<Badge, 'id' | 'created_at'>) => { /* ... */ };
  const handleUpdateBadge = async (badgeData: Badge) => { /* ... */ };
  const handleDeleteBadge = async (badgeId: string) => { /* ... */ };

  // --- Page Navigation ---
  const handlePageChange = (newPage: Page) => {
    setPage(newPage);
    setActiveChallengeId(null);
    setViewingLeaderboardFor(null);
    setActiveSwipeGameId(null);
    setViewingSwipeLeaderboardFor(null);
    setActiveFantasyGameId(null);
    setActiveLeague(null);
    setViewingInviteCode(null);
    // Clear history state to avoid confusion
    window.history.pushState({}, '', '/');
  }

  const renderPage = () => {
    // League Flow
    if (viewingInviteCode) {
      return <LeagueJoinPage 
        inviteCode={viewingInviteCode} 
        onJoin={handleJoinLeague} 
        onBack={() => { setViewingInviteCode(null); window.history.pushState({}, '', '/'); }} 
        profile={profile}
        fetchLeaguePreview={(code) => leagues.find(l => l.invite_code === code) || null}
      />;
    }
    if (activeLeague) {
      return <LeagueDetailPage 
        league={activeLeague} 
        profile={profile!} 
        onBack={() => setActiveLeague(null)}
        onUpdate={handleUpdateLeague}
        onDelete={handleDeleteLeague}
        onLeave={handleLeaveLeague}
        onResetInvite={handleResetInviteCode}
        addToast={addToast}
      />;
    }
    if (page === 'leagues') {
      return <LeaguesListPage 
        leagues={leagues} 
        onViewLeague={handleViewLeague} 
        onCreateLeague={handleCreateLeague}
        onRefresh={() => addToast('Leagues refreshed!', 'info')}
      />;
    }

    // Fantasy Game Flow
    if (activeFantasyGameId) {
      const game = fantasyGames.find(g => g.id === activeFantasyGameId);
      if (game) {
        return <FantasyGameWeekPage game={game} userTeams={userFantasyTeams} allPlayers={fantasyPlayers} onBack={() => setActiveFantasyGameId(null)} />;
      }
    }
    
    // Betting Challenge Flow
    if (viewingLeaderboardFor) {
      // ...
    }
    if (activeChallengeId) {
      // ...
    }

    // Swipe Game Flow
    if (viewingSwipeLeaderboardFor) {
      // ...
    }
    if (activeSwipeGameId) {
      // ...
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
          return <ProfilePage 
            profile={profile} 
            levels={levelsConfig} 
            allBadges={badges} 
            userBadges={userBadges}
            onUpdateProfile={handleUpdateProfile}
            onUpdateEmail={handleUpdateEmail}
            onSignOut={handleSignOut}
            onDeleteAccount={handleDeleteAccount}
          />;
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
        <Header profile={profile} onViewProfile={() => handlePageChange('profile')} />
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
