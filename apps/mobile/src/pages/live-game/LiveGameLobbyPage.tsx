import React, { useEffect, useState } from 'react';
import { ArrowLeft, Users, Coins, Clock, Loader2, Gift, Trophy, Zap } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { supabase } from '../../lib/supabaseClient';
import { getUserEntry, getLeaderboard, joinLiveGame } from '../../services/liveGameService';

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

  // Fetch fixture details
  useEffect(() => {
    const fetchFixtureDetails = async () => {
      if (!supabase || !fixtureId) return;

      try {
        const { data, error } = await supabase
          .from('fb_fixtures')
          .select(`
            id,
            date,
            home_score,
            away_score,
            status_short,
            home_team:fb_teams!fb_fixtures_home_team_id_fkey(name, logo),
            away_team:fb_teams!fb_fixtures_away_team_id_fkey(name, logo)
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
            homeScore: data.home_score,
            awayScore: data.away_score,
            status: data.status_short || 'NS',
          });

          // Determine game status based on fixture status
          const liveStatuses = ['1H', 'HT', '2H', 'ET', 'P', 'BT', 'LIVE'];
          const finishedStatuses = ['FT', 'AET', 'PEN', 'PST', 'CANC', 'ABD', 'AWD', 'WO'];

          if (finishedStatuses.includes(data.status_short)) {
            setGameStatus('finished');
          } else if (liveStatuses.includes(data.status_short)) {
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

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-deep-navy flex items-center justify-center">
        <Loader2 className="animate-spin text-electric-blue" size={48} />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-deep-navy overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-deep-navy/95 backdrop-blur-sm z-10 border-b border-white/10">
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 -ml-2 text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-text-primary">
              {mode === 'free' ? 'Free Betting Game' : 'Stakes Betting Game'}
            </h1>
            <p className="text-xs text-text-secondary">Live Game Lobby</p>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${
            mode === 'free' ? 'bg-lime-glow/20 text-lime-glow' : 'bg-warm-yellow/20 text-warm-yellow'
          }`}>
            {mode === 'free' ? <Gift size={16} /> : <Coins size={16} />}
            <span className="text-xs font-bold">{mode === 'free' ? 'Free' : 'Stakes'}</span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Error message */}
        {error && (
          <div className="bg-hot-red/10 border border-hot-red/20 text-hot-red p-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* Match Card */}
        {fixture && (
          <div className="card-base p-5">
            <div className="flex items-center justify-between">
              {/* Home Team */}
              <div className="flex-1 flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
                  {fixture.homeTeam.logo ? (
                    <img src={fixture.homeTeam.logo} alt="" className="w-10 h-10 object-contain" />
                  ) : (
                    <span className="text-2xl">⚽</span>
                  )}
                </div>
                <span className="text-sm font-medium text-text-primary text-center line-clamp-2">
                  {fixture.homeTeam.name}
                </span>
              </div>

              {/* Score / VS */}
              <div className="px-4 flex flex-col items-center">
                {gameStatus === 'live' && (
                  <span className="text-xs font-bold text-hot-red animate-pulse mb-1">LIVE</span>
                )}
                {fixture.homeScore !== undefined && fixture.homeScore !== null ? (
                  <div className="text-3xl font-bold text-text-primary">
                    {fixture.homeScore} - {fixture.awayScore}
                  </div>
                ) : (
                  <div className="text-2xl font-bold text-text-disabled">VS</div>
                )}
                <span className="text-xs text-text-secondary mt-1">
                  {format(parseISO(fixture.date), 'MMM d, HH:mm')}
                </span>
              </div>

              {/* Away Team */}
              <div className="flex-1 flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
                  {fixture.awayTeam.logo ? (
                    <img src={fixture.awayTeam.logo} alt="" className="w-10 h-10 object-contain" />
                  ) : (
                    <span className="text-2xl">⚽</span>
                  )}
                </div>
                <span className="text-sm font-medium text-text-primary text-center line-clamp-2">
                  {fixture.awayTeam.name}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Game Status */}
        <div className="card-base p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              gameStatus === 'live' ? 'bg-hot-red/20' :
              gameStatus === 'finished' ? 'bg-electric-blue/20' :
              'bg-warm-yellow/20'
            }`}>
              {gameStatus === 'live' ? <Zap className="text-hot-red" size={20} /> :
               gameStatus === 'finished' ? <Trophy className="text-electric-blue" size={20} /> :
               <Clock className="text-warm-yellow" size={20} />}
            </div>
            <div>
              <p className="font-bold text-text-primary">
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
          <div className="flex items-center gap-2 text-text-secondary">
            <Users size={18} />
            <span className="font-bold">{playerCount}</span>
          </div>
        </div>

        {/* User Entry Status */}
        {userEntry ? (
          <div className="card-base p-4">
            <h3 className="font-bold text-text-primary mb-3 flex items-center gap-2">
              <Coins size={18} className="text-warm-yellow" />
              Your Balance
            </h3>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold text-lime-glow">
                {userEntry.balance.toLocaleString()}
              </span>
              <span className="text-text-secondary text-sm">
                Gains: +{userEntry.totalGains.toLocaleString()}
              </span>
            </div>
          </div>
        ) : (
          <button
            onClick={handleJoinGame}
            disabled={isJoining}
            className="w-full primary-button py-4"
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

        {/* Leaderboard Preview */}
        {leaderboard.length > 0 && (
          <div className="card-base p-4">
            <h3 className="font-bold text-text-primary mb-3 flex items-center gap-2">
              <Trophy size={18} className="text-warm-yellow" />
              Leaderboard
            </h3>
            <div className="space-y-2">
              {leaderboard.slice(0, 5).map((entry) => (
                <div
                  key={entry.userId}
                  className="flex items-center p-2 rounded-lg bg-navy-accent/50"
                >
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mr-3 ${
                    entry.rank === 1 ? 'bg-warm-yellow text-deep-navy' :
                    entry.rank === 2 ? 'bg-gray-300 text-deep-navy' :
                    entry.rank === 3 ? 'bg-amber-600 text-white' :
                    'bg-navy-accent text-text-secondary'
                  }`}>
                    {entry.rank}
                  </span>
                  <span className="flex-1 font-medium text-text-primary truncate">
                    {entry.username}
                  </span>
                  <span className="font-bold text-lime-glow">
                    {entry.balance.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Button for Live Games */}
        {userEntry && gameStatus === 'live' && (
          <button className="w-full primary-button py-4 bg-hot-red hover:bg-hot-red/90">
            <span className="flex items-center justify-center gap-2">
              <Zap size={20} />
              Place Bets
            </span>
          </button>
        )}
      </div>
    </div>
  );
};

export default LiveGameLobbyPage;
