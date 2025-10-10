import React, { useState } from 'react';
import { League } from '../../types';
import { Plus, Shield, Users, RefreshCw } from 'lucide-react';
import { CreateLeagueModal } from '../../components/leagues/CreateLeagueModal';

interface LeaguesListPageProps {
  leagues: League[];
  onViewLeague: (leagueId: string) => void;
  onCreateLeague: (name: string, description: string | null) => void;
  onRefresh: () => void;
}

const LeaguesListPage: React.FC<LeaguesListPageProps> = ({ leagues, onViewLeague, onCreateLeague, onRefresh }) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  return (
    <div className="space-y-6 animate-scale-in">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">My Leagues</h2>
        <div className="flex items-center gap-2">
            <button onClick={onRefresh} className="p-2 bg-white rounded-lg shadow-sm text-gray-600 hover:text-purple-600">
                <RefreshCw size={20} />
            </button>
            <button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-2 text-sm font-semibold bg-purple-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-purple-700">
                <Plus size={16} /> Create
            </button>
        </div>
      </div>

      {leagues.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="text-6xl mb-4">🛡️</div>
          <p className="text-gray-600 font-medium">You haven't joined any leagues yet.</p>
          <p className="text-sm text-gray-500 mt-2">Create one or join with an invite link!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {leagues
            .filter(league => league && league.id) // Add this filter for robustness
            .map(league => (
            <button key={league.id} onClick={() => onViewLeague(league.id)} className="w-full bg-white rounded-2xl shadow-lg p-4 text-left hover:shadow-xl hover:scale-105 transition-all">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg flex items-center justify-center">
                    {league.image_url ? <img src={league.image_url} alt={league.name} className="w-full h-full object-cover rounded-lg" /> : <Shield size={24} className="text-purple-500" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">{league.name}</h3>
                    <p className="text-xs text-gray-500 truncate">{league.description || 'No description'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-sm font-semibold text-gray-600">
                  <Users size={14} />
                  <span>{league.member_count}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <CreateLeagueModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={onCreateLeague}
      />
    </div>
  );
};

export default LeaguesListPage;
