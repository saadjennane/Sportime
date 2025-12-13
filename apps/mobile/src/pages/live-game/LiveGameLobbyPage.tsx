import React, { useEffect, useState, useCallback } from 'react';
import { ArrowLeft, Users, Coins, Clock, Loader2, Gift, Trophy, Zap, Target, ChevronRight, AlertCircle, Check, List } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { supabase } from '../../lib/supabaseClient';
import { getUserEntry, getLeaderboard, joinLiveGame, placeBet, confirmBet, fetchLiveMarkets, LiveMarket } from '../../services/liveGameService';
import type { LiveBetCategory } from '../../types';

interface LiveGameLobbyPageProps {
  gameId: string;
  fixtureId: string;
  mode: 'free' | 'ranked';
  onBack: () => void;
}

interface FixtureDetails {
  id: string;
  date: string;
  homeTeam: { name: string; logo?: string };
  awayTeam: { name: string; logo?: string };
  homeScore?: number;
  awayScore?: number;
  status: string;
}

interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatar?: string;
  balance: number;
  totalGains: number;
}

// Market Categories for betting
interface MarketCategory {
  id: LiveBetCategory;
  name: string;
  icon: string;
  description: string;
  color: string;
}

const MARKET_CATEGORIES: MarketCategory[] = [
  { id: 'result', name: 'Result', icon: '🏆', description: '1X2, handicaps', color: 'bg-electric-blue/20 text-electric-blue' },
  { id: 'goals', name: 'Goals', icon: '⚽', description: 'O/U, BTTS, next goal', color: 'bg-lime-glow/20 text-lime-glow' },
  { id: 'scorers', name: 'Scorers', icon: '👤', description: 'Goal scorer, shots', color: 'bg-warm-yellow/20 text-warm-yellow' },
  { id: 'cards', name: 'Cards', icon: '🟨', description: 'Bookings, total cards', color: 'bg-orange-500/20 text-orange-400' },
  { id: 'corners', name: 'Corners', icon: '📐', description: 'Corner markets', color: 'bg-purple-500/20 text-purple-400' },
  { id: 'clean_sheet', name: 'Clean', icon: '🧤', description: 'Clean sheet bets', color: 'bg-teal-500/20 text-teal-400' },
  { id: 'quick', name: 'Quick', icon: '⚡', description: 'Goal intervals', color: 'bg-hot-red/20 text-hot-red' },
  { id: 'extra_time', name: 'ET', icon: '⏱️', description: 'Extra time', color: 'bg-cyan-500/20 text-cyan-400' },
  { id: 'penalties', name: 'Pens', icon: '🥅', description: 'Shootout', color: 'bg-pink-500/20 text-pink-400' },
  { id: 'other', name: 'Other', icon: '📊', description: 'Other markets', color: 'bg-gray-500/20 text-gray-400' },
];

// Knockout rounds where Extra Time and Penalties categories are available
const KNOCKOUT_ROUNDS = ['Final', 'Semi', 'Quarter', 'Round of 16', 'Round of 32', 'Round of 8', 'Knockout', '1/8', '1/4', '1/2'];

// Mock markets for demo (will come from API)
interface Market {
  id: number;
  name: string;
  category: LiveBetCategory;
  options: { label: string; value: string; odds: number }[];
}

const MOCK_MARKETS: Market[] = [
  {
    id: 1,
    name: 'Match Result',
    category: 'result',
    options: [
      { label: 'Home Win', value: 'home', odds: 2.10 },
      { label: 'Draw', value: 'draw', odds: 3.25 },
      { label: 'Away Win', value: 'away', odds: 3.40 },
    ],
  },
  {
    id: 2,
    name: 'Next Goal',
    category: 'goals',
    options: [
      { label: 'Home Team', value: 'home', odds: 1.85 },
      { label: 'No Goal', value: 'none', odds: 6.50 },
      { label: 'Away Team', value: 'away', odds: 2.20 },
    ],
  },
  {
    id: 3,
    name: 'Total Goals Over/Under',
    category: 'goals',
    options: [
      { label: 'Over 2.5', value: 'over_2.5', odds: 1.90 },
      { label: 'Under 2.5', value: 'under_2.5', odds: 1.95 },
    ],
  },
  {
    id: 4,
    name: 'Next Card',
    category: 'cards',
    options: [
      { label: 'Home Team', value: 'home', odds: 1.75 },
      { label: 'No Card Next 10min', value: 'none', odds: 3.50 },
      { label: 'Away Team', value: 'away', odds: 2.05 },
    ],
  },
];

const LiveGameLobbyPage: React.FC<LiveGameLobbyPageProps> = ({
  gameId,
  fixtureId,
  mode,
  onBack,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [fixture, setFixture] = useState<FixtureDetails | null>(null);
  const [gameStatus, setGameStatus] = useState<'upcoming' | 'live' | 'finished'>('upcoming');
  const [playerCount, setPlayerCount] = useState(0);
  const [userEntry, setUserEntry] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Betting state
  const [showBettingPanel, setShowBettingPanel] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<LiveBetCategory | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [selectedOption, setSelectedOption] = useState<{ label: string; value: string; odds: number } | null>(null);
  const [betAmount, setBetAmount] = useState<number>(100);
  const [isPlacingBet, setIsPlacingBet] = useState(false);
  const [betSuccess, setBetSuccess] = useState(false);

  // My Bets state
  const [userBets, setUserBets] = useState<{
    id: string;
    marketName: string;
    choice: string;
    choiceLabel: string;
    amount: number;
    odds: number;
    status: 'pending' | 'confirming' | 'confirmed' | 'won' | 'lost';
    potentialWin: number;
    placedAt: Date;
    confirmCountdown?: number; // Seconds remaining until confirmation (8s TV delay)
  }[]>([]);
  const [activeTab, setActiveTab] = useState<'markets' | 'mybets'>('markets');

  // Countdown timer for pending bets (TV sync delay)
  useEffect(() => {
    const interval = setInterval(() => {
      setUserBets(prev => prev.map(bet => {
        if (bet.status === 'pending' && bet.confirmCountdown !== undefined && bet.confirmCountdown > 0) {
          return { ...bet, confirmCountdown: bet.confirmCountdown - 1 };
        }
        return bet;
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Live markets state
  const [liveMarkets, setLiveMarkets] = useState<LiveMarket[]>([]);
  const [isLoadingMarkets, setIsLoadingMarkets] = useState(false);
  const [isKnockoutMatch, setIsKnockoutMatch] = useState(false);
  const [fixtureApiId, setFixtureApiId] = useState<number | null>(null);

  // Fetch fixture details
  useEffect(() => {
    const fetchFixtureDetails = async () => {
      if (!supabase || !fixtureId) return;

      try {
        const { data, error } = await supabase
          .from('fb_fixtures')
          .select(`
            id,
            api_id,
            date,
            goals_home,
            goals_away,
            status,
            round,
            home_team:home_team_id(name, logo),
            away_team:away_team_id(name, logo)
          `)
          .eq('id', fixtureId)
          .single();

        if (error) throw error;

        if (data) {
          setFixture({
            id: data.id,
            date: data.date,
            homeTeam: {
              name: data.home_team?.name || 'TBD',
              logo: data.home_team?.logo,
            },
            awayTeam: {
              name: data.away_team?.name || 'TBD',
              logo: data.away_team?.logo,
            },
            homeScore: data.goals_home,
            awayScore: data.goals_away,
            status: data.status || 'NS',
          });

          // Store API ID for live markets
          if (data.api_id) {
            setFixtureApiId(data.api_id);
          }

          // Check if this is a knockout match (for ET/Penalties categories)
          if (data.round) {
            const isKnockout = KNOCKOUT_ROUNDS.some(kr =>
              data.round.toLowerCase().includes(kr.toLowerCase())
            );
            setIsKnockoutMatch(isKnockout);
          }

          // Determine game status based on fixture status
          const liveStatuses = ['1H', 'HT', '2H', 'ET', 'P', 'BT', 'LIVE'];
          const finishedStatuses = ['FT', 'AET', 'PEN', 'PST', 'CANC', 'ABD', 'AWD', 'WO'];
          const status = data.status || 'NS';

          if (finishedStatuses.includes(status)) {
            setGameStatus('finished');
          } else if (liveStatuses.includes(status)) {
            setGameStatus('live');
          } else {
            setGameStatus('upcoming');
          }
        }
      } catch (err) {
        console.error('[LiveGameLobbyPage] Error fetching fixture:', err);
        setError('Failed to load match details');
      }
    };

    fetchFixtureDetails();
  }, [fixtureId]);

  // Fetch game details, user entry and leaderboard
  useEffect(() => {
    const fetchGameData = async () => {
      if (!supabase || !gameId) return;

      try {
        // Get game details
        const { data: gameData, error: gameError } = await supabase
          .from('live_games')
          .select('status, entry_cost')
          .eq('id', gameId)
          .single();

        if (gameError) throw gameError;

        // Get player count
        const { count } = await supabase
          .from('live_game_entries')
          .select('id', { count: 'exact' })
          .eq('live_game_id', gameId);

        setPlayerCount(count || 0);

        // Get current user
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) {
          const entry = await getUserEntry(gameId, userData.user.id);
          setUserEntry(entry);
        }

        // Get leaderboard
        const lb = await getLeaderboard(gameId);
        setLeaderboard(lb);

      } catch (err) {
        console.error('[LiveGameLobbyPage] Error fetching game data:', err);
        setError('Failed to load game data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchGameData();
  }, [gameId]);

  // Join the game
  const handleJoinGame = async () => {
    setIsJoining(true);
    try {
      const entry = await joinLiveGame(gameId);
      setUserEntry(entry);
      setPlayerCount(prev => prev + 1);
    } catch (err: any) {
      console.error('[LiveGameLobbyPage] Error joining game:', err);
      setError(err?.message || 'Failed to join game');
    } finally {
      setIsJoining(false);
    }
  };

  // Load live markets from API
  const loadLiveMarkets = useCallback(async () => {
    if (!fixtureApiId || gameStatus !== 'live') return;

    setIsLoadingMarkets(true);
    try {
      const markets = await fetchLiveMarkets(fixtureApiId);
      if (markets.length > 0) {
        setLiveMarkets(markets);
      }
    } catch (err) {
      console.error('[LiveGameLobbyPage] Error loading live markets:', err);
    } finally {
      setIsLoadingMarkets(false);
    }
  }, [fixtureApiId, gameStatus]);

  // Load live markets when game becomes live
  useEffect(() => {
    if (gameStatus === 'live' && fixtureApiId) {
      loadLiveMarkets();

      // Refresh markets every 30 seconds
      const interval = setInterval(loadLiveMarkets, 30000);
      return () => clearInterval(interval);
    }
  }, [gameStatus, fixtureApiId, loadLiveMarkets]);

  // Place a bet
  const CONFIRMATION_DELAY = 8; // 8 seconds delay for TV sync protection

  const handlePlaceBet = async () => {
    if (!userEntry || !selectedMarket || !selectedOption || betAmount < 50) return;

    setIsPlacingBet(true);
    setError(null);

    try {
      const bet = await placeBet(userEntry.id, {
        category: selectedMarket.category,
        marketId: selectedMarket.id,
        marketName: selectedMarket.name,
        choice: selectedOption.value,
        choiceLabel: selectedOption.label,
        amount: betAmount,
        odds: selectedOption.odds,
      });

      if (bet) {
        // Update local balance
        setUserEntry((prev: any) => ({
          ...prev,
          balance: prev.balance - betAmount,
        }));

        // Add to user bets list with countdown
        setUserBets(prev => [...prev, {
          id: bet.id,
          marketName: selectedMarket.name,
          choice: selectedOption.value,
          choiceLabel: selectedOption.label,
          amount: betAmount,
          odds: selectedOption.odds,
          status: 'pending',
          potentialWin: Math.round(betAmount * selectedOption.odds),
          placedAt: new Date(),
          confirmCountdown: CONFIRMATION_DELAY,
        }]);

        setBetSuccess(true);
        setShowBettingPanel(false);
        setActiveTab('mybets'); // Switch to My Bets tab to show countdown

        // Auto-confirm after 8 second delay (TV sync protection)
        setTimeout(async () => {
          await confirmBet(bet.id);
          // Update bet status in list
          setUserBets(prev => prev.map(b =>
            b.id === bet.id ? { ...b, status: 'confirmed' as const, confirmCountdown: undefined } : b
          ));
          setBetSuccess(false);
          setSelectedMarket(null);
          setSelectedOption(null);
        }, CONFIRMATION_DELAY * 1000);
      }
    } catch (err: any) {
      console.error('[LiveGameLobbyPage] Error placing bet:', err);
      setError(err?.message || 'Failed to place bet');
    } finally {
      setIsPlacingBet(false);
    }
  };

  // Use live markets if available, fallback to mock
  const marketsToShow = liveMarkets.length > 0 ? liveMarkets : MOCK_MARKETS;

  // Filter markets by category
  const filteredMarkets = selectedCategory
    ? marketsToShow.filter(m => m.category === selectedCategory)
    : marketsToShow;

  // Filter visible categories:
  // 1. Hide ET/Penalties for non-knockout matches
  // 2. Hide categories with no markets (dynamic filtering based on available markets)
  const visibleCategories = MARKET_CATEGORIES.filter(cat => {
    // ET and Penalties only for knockout matches
    if ((cat.id === 'extra_time' || cat.id === 'penalties') && !isKnockoutMatch) {
      return false;
    }
    // Hide categories with no markets
    const hasMarkets = marketsToShow.some(m => m.category === cat.id);
    return hasMarkets;
  });

  // Bet amounts
  const BET_AMOUNTS = [50, 100, 200, 500];

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-deep-navy flex items-center justify-center safe-area-inset">
        <Loader2 className="animate-spin text-electric-blue" size={48} />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-deep-navy overflow-y-auto safe-area-inset">
      <div className="max-w-md mx-auto">
      {/* Header */}
      <div className="sticky top-0 bg-deep-navy/95 backdrop-blur-sm z-10 border-b border-white/10">
        <div className="px-3 sm:px-4 py-3 flex items-center gap-2 sm:gap-3">
          <button
            onClick={onBack}
            className="p-2 -ml-2 text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeft size={22} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-text-primary text-sm sm:text-base truncate">
              {mode === 'free' ? 'Free Betting Game' : 'Stakes Betting Game'}
            </h1>
            <p className="text-xs text-text-secondary">Live Game</p>
          </div>
          {userEntry && (
            <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-full bg-lime-glow/20">
              <Coins size={14} className="text-lime-glow" />
              <span className="text-xs sm:text-sm font-bold text-lime-glow">{userEntry.balance.toLocaleString()}</span>
            </div>
          )}
          <div className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-full ${
            mode === 'free' ? 'bg-lime-glow/20 text-lime-glow' : 'bg-warm-yellow/20 text-warm-yellow'
          }`}>
            {mode === 'free' ? <Gift size={14} /> : <Coins size={14} />}
            <span className="text-xs font-bold hidden sm:inline">{mode === 'free' ? 'Free' : 'Stakes'}</span>
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-4 space-y-3 sm:space-y-4 pb-24">
        {/* Error message */}
        {error && (
          <div className="bg-hot-red/10 border border-hot-red/20 text-hot-red p-3 rounded-xl text-sm flex items-start gap-2">
            <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Success message */}
        {betSuccess && (
          <div className="bg-lime-glow/10 border border-lime-glow/20 text-lime-glow p-3 rounded-xl text-sm flex items-center gap-2 animate-pulse">
            <Check size={18} />
            <span>Bet placed successfully!</span>
          </div>
        )}

        {/* Match Card - Compact for mobile */}
        {fixture && (
          <div className="card-base p-3 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              {/* Home Team */}
              <div className="flex-1 min-w-0 flex flex-col items-center gap-1.5 sm:gap-2">
                <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {fixture.homeTeam.logo ? (
                    <img src={fixture.homeTeam.logo} alt="" className="w-7 h-7 sm:w-10 sm:h-10 object-contain" />
                  ) : (
                    <span className="text-lg sm:text-2xl">⚽</span>
                  )}
                </div>
                <span className="text-xs sm:text-sm font-medium text-text-primary text-center line-clamp-2">
                  {fixture.homeTeam.name}
                </span>
              </div>

              {/* Score / VS */}
              <div className="px-2 sm:px-4 flex flex-col items-center flex-shrink-0">
                {gameStatus === 'live' && (
                  <span className="text-xs font-bold text-hot-red animate-pulse mb-1">LIVE</span>
                )}
                {fixture.homeScore !== undefined && fixture.homeScore !== null ? (
                  <div className="text-2xl sm:text-3xl font-bold text-text-primary">
                    {fixture.homeScore} - {fixture.awayScore}
                  </div>
                ) : (
                  <div className="text-xl sm:text-2xl font-bold text-text-disabled">VS</div>
                )}
                <span className="text-xs text-text-secondary mt-1">
                  {format(parseISO(fixture.date), 'MMM d, HH:mm')}
                </span>
              </div>

              {/* Away Team */}
              <div className="flex-1 min-w-0 flex flex-col items-center gap-1.5 sm:gap-2">
                <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {fixture.awayTeam.logo ? (
                    <img src={fixture.awayTeam.logo} alt="" className="w-7 h-7 sm:w-10 sm:h-10 object-contain" />
                  ) : (
                    <span className="text-lg sm:text-2xl">⚽</span>
                  )}
                </div>
                <span className="text-xs sm:text-sm font-medium text-text-primary text-center line-clamp-2">
                  {fixture.awayTeam.name}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Game Status + Player count */}
        <div className="card-base p-3 sm:p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center ${
              gameStatus === 'live' ? 'bg-hot-red/20' :
              gameStatus === 'finished' ? 'bg-electric-blue/20' :
              'bg-warm-yellow/20'
            }`}>
              {gameStatus === 'live' ? <Zap className="text-hot-red" size={18} /> :
               gameStatus === 'finished' ? <Trophy className="text-electric-blue" size={18} /> :
               <Clock className="text-warm-yellow" size={18} />}
            </div>
            <div>
              <p className="font-bold text-text-primary text-sm sm:text-base">
                {gameStatus === 'live' ? 'Match is Live!' :
                 gameStatus === 'finished' ? 'Match Finished' :
                 'Waiting for Kickoff'}
              </p>
              <p className="text-xs text-text-secondary">
                {gameStatus === 'live' ? 'Place your bets now' :
                 gameStatus === 'finished' ? 'Check the final results' :
                 'Betting opens when match starts'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-text-secondary">
            <Users size={16} />
            <span className="font-bold text-sm">{playerCount}</span>
          </div>
        </div>

        {/* Join Game button (if not joined) */}
        {!userEntry && (
          <button
            onClick={handleJoinGame}
            disabled={isJoining}
            className="w-full primary-button py-3 sm:py-4"
          >
            {isJoining ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="animate-spin" size={18} />
                Joining...
              </span>
            ) : (
              'Join Game'
            )}
          </button>
        )}

        {/* Betting Section - Only show if user joined and game is live or upcoming */}
        {userEntry && (gameStatus === 'live' || gameStatus === 'upcoming') && (
          <>
            {/* Market Categories */}
            <div className="card-base p-3 sm:p-4">
              <h3 className="font-bold text-text-primary mb-3 flex items-center gap-2 text-sm sm:text-base">
                <Target size={18} className="text-electric-blue" />
                Betting Markets
              </h3>
              <div className="grid grid-cols-4 gap-2">
                {visibleCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                    className={`flex flex-col items-center p-2 sm:p-3 rounded-xl transition-all ${
                      selectedCategory === cat.id
                        ? `${cat.color} border-2 border-current`
                        : 'bg-navy-accent/50 hover:bg-navy-accent border-2 border-transparent'
                    }`}
                  >
                    <span className="text-lg sm:text-xl">{cat.icon}</span>
                    <span className="text-xs font-medium text-text-primary mt-1 truncate w-full text-center">
                      {cat.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tabs: Markets / My Bets */}
            <div className="flex gap-2 px-1">
              <button
                onClick={() => setActiveTab('markets')}
                className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'markets'
                    ? 'bg-electric-blue text-white'
                    : 'bg-navy-accent/50 text-text-secondary hover:bg-navy-accent'
                }`}
              >
                <Target size={16} />
                Markets
              </button>
              <button
                onClick={() => setActiveTab('mybets')}
                className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 relative ${
                  activeTab === 'mybets'
                    ? 'bg-electric-blue text-white'
                    : 'bg-navy-accent/50 text-text-secondary hover:bg-navy-accent'
                }`}
              >
                <List size={16} />
                My Bets
                {userBets.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-warm-yellow text-deep-navy text-xs font-bold flex items-center justify-center">
                    {userBets.length}
                  </span>
                )}
              </button>
            </div>

            {/* My Bets Tab Content */}
            {activeTab === 'mybets' && (
              <div className="card-base p-3 sm:p-4 space-y-3">
                <h3 className="font-bold text-text-primary text-sm sm:text-base">
                  Your Bets
                </h3>
                {userBets.length === 0 ? (
                  <div className="text-center py-8 text-text-secondary">
                    <p>No bets placed yet</p>
                    <p className="text-xs mt-1">Tap on a market to place your first bet</p>
                  </div>
                ) : (
                  userBets.map((bet) => (
                    <div key={bet.id} className="bg-navy-accent/30 rounded-xl p-3 overflow-hidden relative">
                      {/* Countdown progress bar (only shown during 8s TV delay) */}
                      {bet.status === 'pending' && bet.confirmCountdown !== undefined && bet.confirmCountdown > 0 && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-warm-yellow/20">
                          <div
                            className="h-full bg-warm-yellow transition-all duration-1000 ease-linear"
                            style={{ width: `${(bet.confirmCountdown / 8) * 100}%` }}
                          />
                        </div>
                      )}
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-text-primary text-sm">{bet.marketName}</span>
                        {/* Show countdown badge or status badge */}
                        {bet.status === 'pending' && bet.confirmCountdown !== undefined && bet.confirmCountdown > 0 ? (
                          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-warm-yellow/20">
                            <div className="w-2 h-2 rounded-full bg-warm-yellow animate-pulse" />
                            <span className="text-xs font-bold text-warm-yellow">{bet.confirmCountdown}s</span>
                          </div>
                        ) : (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            bet.status === 'confirmed' ? 'bg-lime-glow/20 text-lime-glow' :
                            bet.status === 'pending' ? 'bg-warm-yellow/20 text-warm-yellow' :
                            bet.status === 'won' ? 'bg-lime-glow/20 text-lime-glow' :
                            'bg-hot-red/20 text-hot-red'
                          }`}>
                            {bet.status}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-text-primary font-bold">{bet.choiceLabel}</p>
                          <p className="text-xs text-text-secondary">
                            {bet.amount} coins @ {bet.odds.toFixed(2)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lime-glow font-bold">+{bet.potentialWin}</p>
                          <p className="text-xs text-text-secondary">potential</p>
                        </div>
                      </div>
                      {/* Syncing message during countdown */}
                      {bet.status === 'pending' && bet.confirmCountdown !== undefined && bet.confirmCountdown > 0 && (
                        <p className="text-xs text-text-secondary mt-2 text-center">
                          Syncing with TV delay...
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Markets List - Only show when markets tab is active */}
            {activeTab === 'markets' && (
            <div className="card-base p-3 sm:p-4 space-y-3">
              <h3 className="font-bold text-text-primary text-sm sm:text-base">
                {selectedCategory
                  ? MARKET_CATEGORIES.find(c => c.id === selectedCategory)?.name
                  : 'All Markets'}
                {isLoadingMarkets && <Loader2 className="inline-block ml-2 animate-spin" size={14} />}
              </h3>

              {gameStatus === 'upcoming' && (
                <div className="bg-warm-yellow/10 text-warm-yellow p-2 rounded-lg text-xs flex items-center gap-2">
                  <Clock size={14} />
                  <span>Betting opens when match starts</span>
                </div>
              )}

              {filteredMarkets.map((market) => (
                <div key={market.id} className="bg-navy-accent/30 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-text-primary text-sm">{market.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      MARKET_CATEGORIES.find(c => c.id === market.category)?.color || 'bg-white/10'
                    }`}>
                      {MARKET_CATEGORIES.find(c => c.id === market.category)?.icon}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {market.options.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          if (gameStatus === 'live') {
                            setSelectedMarket(market);
                            setSelectedOption(opt);
                            setShowBettingPanel(true);
                          }
                        }}
                        disabled={gameStatus !== 'live'}
                        className={`p-2 sm:p-3 rounded-lg text-center transition-all ${
                          selectedMarket?.id === market.id && selectedOption?.value === opt.value
                            ? 'bg-electric-blue text-white'
                            : gameStatus === 'live'
                              ? 'bg-deep-navy hover:bg-navy-accent'
                              : 'bg-deep-navy/50 cursor-not-allowed opacity-60'
                        }`}
                      >
                        <div className="text-xs text-text-secondary truncate">{opt.label}</div>
                        <div className="font-bold text-electric-blue text-sm sm:text-base">{opt.odds.toFixed(2)}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            )}
          </>
        )}

        {/* Leaderboard Preview */}
        {leaderboard.length > 0 && (
          <div className="card-base p-3 sm:p-4">
            <h3 className="font-bold text-text-primary mb-3 flex items-center gap-2 text-sm sm:text-base">
              <Trophy size={18} className="text-warm-yellow" />
              Leaderboard
            </h3>
            <div className="space-y-2">
              {leaderboard.slice(0, 5).map((entry) => (
                <div
                  key={entry.userId}
                  className="flex items-center p-2 rounded-lg bg-navy-accent/50"
                >
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mr-2 sm:mr-3 flex-shrink-0 ${
                    entry.rank === 1 ? 'bg-warm-yellow text-deep-navy' :
                    entry.rank === 2 ? 'bg-gray-300 text-deep-navy' :
                    entry.rank === 3 ? 'bg-amber-600 text-white' :
                    'bg-navy-accent text-text-secondary'
                  }`}>
                    {entry.rank}
                  </span>
                  <span className="flex-1 font-medium text-text-primary truncate text-sm">
                    {entry.username}
                  </span>
                  <span className="font-bold text-lime-glow text-sm">
                    {entry.balance.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      </div>

      {/* Betting Panel - Bottom Sheet (Mobile Optimized) */}
      {showBettingPanel && selectedMarket && selectedOption && userEntry && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center">
          <div className="w-full max-w-md bg-navy-accent rounded-t-3xl p-4 pb-8 animate-slide-up safe-area-inset-bottom">
            {/* Handle bar */}
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-4" />

            {/* Compact header with pick and odds */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex-1">
                <p className="text-xs text-text-secondary">{selectedMarket.name}</p>
                <p className="font-bold text-text-primary">{selectedOption.label}</p>
              </div>
              <div className="bg-electric-blue/20 px-3 py-1.5 rounded-lg">
                <span className="font-bold text-electric-blue text-lg">{selectedOption.odds.toFixed(2)}</span>
              </div>
            </div>

            {/* Bet Amount Selection - Compact */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-text-secondary text-xs">Bet amount</span>
                <span className="text-xs text-text-secondary">
                  Balance: <span className="text-lime-glow font-bold">{userEntry.balance.toLocaleString()}</span>
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {BET_AMOUNTS.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setBetAmount(amount)}
                    disabled={amount > userEntry.balance}
                    className={`py-2.5 rounded-xl font-bold text-sm transition-all ${
                      betAmount === amount
                        ? 'bg-warm-yellow text-deep-navy'
                        : amount > userEntry.balance
                          ? 'bg-navy-accent/30 text-text-disabled cursor-not-allowed'
                          : 'bg-deep-navy text-text-primary hover:bg-navy-accent'
                    }`}
                  >
                    {amount}
                  </button>
                ))}
              </div>
            </div>

            {/* Potential Win - Compact */}
            <div className="bg-lime-glow/10 rounded-xl p-2.5 mb-3 flex items-center justify-between">
              <span className="text-text-secondary text-sm">Potential win</span>
              <span className="font-bold text-lime-glow">
                +{Math.round(betAmount * selectedOption.odds).toLocaleString()}
              </span>
            </div>

            {/* 8-second delay warning */}
            <div className="bg-warm-yellow/10 border border-warm-yellow/20 rounded-xl p-2.5 mb-4 flex items-start gap-2">
              <Clock size={16} className="text-warm-yellow flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-warm-yellow text-xs font-medium">8-second confirmation delay</p>
                <p className="text-text-secondary text-xs mt-0.5">
                  Protects against TV broadcast delay. Check status in "My Bets".
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowBettingPanel(false);
                  setSelectedMarket(null);
                  setSelectedOption(null);
                }}
                className="flex-1 py-3 rounded-xl font-bold text-text-secondary bg-deep-navy"
              >
                Cancel
              </button>
              <button
                onClick={handlePlaceBet}
                disabled={isPlacingBet || betAmount > userEntry.balance}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-electric-blue hover:bg-electric-blue/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPlacingBet ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="animate-spin" size={18} />
                    Placing...
                  </span>
                ) : (
                  `Bet ${betAmount}`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveGameLobbyPage;
