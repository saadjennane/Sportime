import React, { useState } from 'react';
import { Plus, Users, Loader2, X, Crown, LogIn } from 'lucide-react';
import { PullToRefresh } from '../components/PullToRefresh';

interface SquadListItem {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  member_count?: number;
  role?: string;
}

interface LeaguesListPageProps {
  leagues: SquadListItem[];
  isLoading?: boolean;
  onCreate: () => void;
  onViewLeague: (id: string) => void;
  onJoin?: (code: string) => void | Promise<any>;
  onRefresh?: () => Promise<any> | void;
}

const isOwner = (role?: string) => role === 'admin' || role === 'owner';

const LeaguesListPage: React.FC<LeaguesListPageProps> = ({ leagues, isLoading, onCreate, onViewLeague, onJoin, onRefresh }) => {
  const [joinOpen, setJoinOpen] = useState(false);
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);

  const submitJoin = async () => {
    if (!code.trim() || !onJoin) return;
    setJoining(true);
    try { await onJoin(code.trim()); setJoinOpen(false); setCode(''); }
    finally { setJoining(false); }
  };

  const list = (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-2">
        <h1 className="text-2xl font-bold text-text-primary">Your Squads</h1>
        <div className="flex items-center gap-2">
          {onJoin && (
            <button onClick={() => setJoinOpen(true)}
              className="flex items-center gap-1.5 text-sm font-semibold bg-navy-accent text-text-secondary px-3 py-3 rounded-lg hover:text-electric-blue">
              <LogIn size={16} /> Join
            </button>
          )}
          <button onClick={onCreate}
            className="flex items-center gap-2 text-sm font-semibold bg-lime-glow/20 text-lime-glow px-4 py-3 rounded-lg hover:bg-lime-glow/30">
            <Plus size={16} /> Create
          </button>
        </div>
      </div>

      {isLoading && leagues.length === 0 ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-electric-blue" size={32} /></div>
      ) : leagues.length === 0 ? (
        <div className="card-base p-8 text-center animate-scale-in">
          <div className="text-6xl mb-4">🤷‍♀️</div>
          <p className="text-text-secondary font-medium">You haven't joined any squads yet.</p>
          <p className="text-sm text-text-disabled mt-2 mb-4">Create your own or join one with an invite code.</p>
          <div className="flex gap-2 justify-center">
            <button onClick={onCreate} className="flex items-center gap-1.5 text-sm font-semibold bg-lime-glow/20 text-lime-glow px-4 py-2.5 rounded-lg hover:bg-lime-glow/30">
              <Plus size={16} /> Create Squad
            </button>
            {onJoin && (
              <button onClick={() => setJoinOpen(true)} className="flex items-center gap-1.5 text-sm font-semibold bg-navy-accent text-text-secondary px-4 py-2.5 rounded-lg hover:text-electric-blue">
                <LogIn size={16} /> Join with code
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {leagues.map(league => (
            <button
              key={league.id}
              onClick={() => onViewLeague(league.id)}
              className="w-full card-base p-4 text-left transition-all hover:shadow-xl hover:border-neon-cyan/50"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-deep-navy rounded-lg flex items-center justify-center border-2 border-neon-cyan/20 flex-shrink-0">
                  {league.image_url ? (
                    <img src={league.image_url} alt={league.name} className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <Users className="w-8 h-8 text-neon-cyan/50" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-text-primary truncate">{league.name}</h3>
                    {isOwner(league.role) && (
                      <span className="flex items-center gap-0.5 text-[10px] font-bold text-warm-yellow bg-warm-yellow/15 px-1.5 py-0.5 rounded-full flex-shrink-0">
                        <Crown size={10} /> OWNER
                      </span>
                    )}
                  </div>
                  {league.description && <p className="text-sm text-text-secondary truncate">{league.description}</p>}
                  <p className="text-xs text-text-disabled mt-1 flex items-center gap-1">
                    <Users size={12} /> {league.member_count ?? 0} member{(league.member_count ?? 0) === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      {onRefresh ? <PullToRefresh onRefresh={async () => { await onRefresh(); }}>{list}</PullToRefresh> : list}

      {/* Join with code */}
      {joinOpen && (
        <div className="fixed inset-0 bg-deep-navy/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-[70] animate-scale-in" onClick={() => setJoinOpen(false)}>
          <div className="modal-base w-full sm:max-w-sm p-5 space-y-4 rounded-t-2xl sm:rounded-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-text-primary">Join a squad</h2>
              <button onClick={() => setJoinOpen(false)} className="p-1.5 text-text-secondary hover:bg-white/10 rounded-full"><X size={20} /></button>
            </div>
            <p className="text-sm text-text-secondary">Enter the invite code shared by a squad member.</p>
            <input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              onKeyDown={e => { if (e.key === 'Enter') submitJoin(); }}
              placeholder="INVITE CODE"
              autoFocus
              className="input-base w-full text-center text-lg font-bold tracking-widest uppercase"
            />
            <button onClick={submitJoin} disabled={!code.trim() || joining} className="primary-button w-full">
              {joining ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'Join Squad'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default LeaguesListPage;
