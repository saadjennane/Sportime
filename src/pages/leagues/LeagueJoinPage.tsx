import React, { useState, useEffect } from 'react';
import { League, Profile } from '../../types';
import { Users, Loader2 } from 'lucide-react';

interface LeagueJoinPageProps {
  inviteCode: string;
  onJoin: (inviteCode: string) => void;
  onBack: () => void;
  profile: Profile | null;
  fetchLeaguePreview: (inviteCode: string) => League | null;
}

const LeagueJoinPage: React.FC<LeagueJoinPageProps> = ({ inviteCode, onJoin, onBack, profile, fetchLeaguePreview }) => {
  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    setLoading(true);
    const foundLeague = fetchLeaguePreview(inviteCode);
    if (foundLeague) {
      setLeague(foundLeague);
    } else {
      setError('This league link is invalid or has expired.');
    }
    setLoading(false);
  }, [inviteCode, fetchLeaguePreview]);

  const handleJoin = async () => {
    setIsJoining(true);
    await onJoin(inviteCode);
    setIsJoining(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center animate-scale-in">
      {loading ? (
        <Loader2 className="animate-spin w-12 h-12 text-purple-600" />
      ) : error ? (
        <div className="bg-white rounded-2xl shadow-lg p-8 space-y-4">
          <div className="text-5xl">😞</div>
          <h2 className="text-xl font-bold text-red-600">Join Failed</h2>
          <p className="text-gray-600">{error}</p>
          <button onClick={onBack} className="mt-4 px-6 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg">
            Go Back
          </button>
        </div>
      ) : league && (
        <div className="bg-white rounded-2xl shadow-lg p-8 space-y-4">
          <div className="w-24 h-24 bg-gradient-to-br from-purple-100 to-blue-100 rounded-xl flex items-center justify-center mx-auto">
            {league.image_url ? <img src={league.image_url} alt={league.name} className="w-full h-full object-cover rounded-xl" /> : <Users size={48} className="text-purple-500" />}
          </div>
          <h2 className="text-2xl font-bold text-gray-800">{league.name}</h2>
          <p className="text-sm text-gray-500">{league.description || 'Join this league to compete with friends!'}</p>
          <div className="flex items-center justify-center gap-2 text-gray-600">
            <Users size={16} />
            <span className="font-semibold">{league.member_count} members</span>
          </div>
          <button 
            onClick={handleJoin}
            disabled={isJoining || profile?.is_guest}
            className="w-full mt-4 px-6 py-3 bg-purple-600 text-white font-bold rounded-lg shadow-md hover:bg-purple-700 disabled:bg-gray-400"
          >
            {isJoining ? <Loader2 className="animate-spin mx-auto" /> : profile?.is_guest ? 'Sign in to Join' : 'Join League'}
          </button>
        </div>
      )}
    </div>
  );
};

export default LeagueJoinPage;
