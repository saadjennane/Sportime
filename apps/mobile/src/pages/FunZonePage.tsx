import React, { useState, useEffect } from 'react';
import { Profile, SpinTier } from '../types';
import { useMockStore } from '../store/useMockStore';
import { ProgressionBar } from '../components/funzone/ProgressionBar';
import { SpinwheelCard } from '../components/funzone/SpinwheelCard';
import { CasualGameCard } from '../components/funzone/CasualGameCard';
import { SpinwheelModal } from '../components/funzone/SpinwheelModal';
import { prefetchSpinSegments } from '../services/spinSegmentsService';
import { prefetchPlayerIndex } from '../services/playerIndexService';
import { prefetchPlayerToday, prefetchLineupToday, prefetchConnectionsToday, prefetchGridToday } from '../services/puzzleService';
import { prefetchGridIndex } from '../services/gridService';
import GuessPlayerGame from './GuessPlayerGame';
import GuessLineupGame from './GuessLineupGame';
import GuessConnectionsGame from './GuessConnectionsGame';
import GuessGridGame from './GuessGridGame';

interface FunZonePageProps {
  profile: Profile | null;
  onOpenSpinWheel: (tier: SpinTier) => void;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

const FunZonePage: React.FC<FunZonePageProps> = ({ profile, onOpenSpinWheel, addToast }) => {
  const { funzone, userTickets } = useMockStore();
  const [openTier, setOpenTier] = useState<SpinTier | null>(null);
  const [openPlayerPuzzle, setOpenPlayerPuzzle] = useState(false);
  const [openLineupPuzzle, setOpenLineupPuzzle] = useState(false);
  const [openConnections, setOpenConnections] = useState(false);
  const [openGrid, setOpenGrid] = useState(false);

  // Prefetch wheel content so the modal opens instantly (only re-downloads on change).
  useEffect(() => { prefetchSpinSegments(); prefetchPlayerIndex(); prefetchPlayerToday(); prefetchLineupToday(); prefetchConnectionsToday(); prefetchGridToday(); prefetchGridIndex(); }, []);

  // Any wheel opens the modal; the server RPC enforces eligibility (cooldown / no spins).
  const handleSpinwheelClick = (tier: SpinTier) => setOpenTier(tier);

  const checkTicketAvailability = (tier: SpinTier): boolean => {
    if (tier === 'premium') return profile?.is_subscriber ?? false;
    if (!profile) return false;
    const now = new Date();
    return userTickets.some(ticket =>
      ticket.user_id === profile.id && ticket.type === tier && !ticket.is_used && new Date(ticket.expires_at) > now
    );
  };

  return (
    <>
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-text-primary">FunZone 🎮</h1>
          <p className="text-text-secondary mt-1">Play, progress, and spin your way to rewards!</p>
        </div>

        <ProgressionBar currentWins={funzone.userProgress} />

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-text-primary">Daily Puzzle</h2>
          <button onClick={() => setOpenConnections(true)}
            className="w-full text-left p-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-electric-blue/10 border border-purple-500/30 active:scale-[0.99] transition-transform">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-deep-navy/40 flex items-center justify-center text-2xl flex-shrink-0">🧠</div>
              <div className="flex-1 min-w-0">
                <p className="font-extrabold text-text-primary">Football Connections</p>
                <p className="text-xs text-text-secondary">Make 4 groups of 4 players 🔥</p>
              </div>
              <span className="text-purple-400 font-bold text-sm">Play →</span>
            </div>
          </button>
          <button onClick={() => setOpenPlayerPuzzle(true)}
            className="w-full text-left p-4 rounded-2xl bg-gradient-to-br from-warm-yellow/20 to-hot-red/10 border border-warm-yellow/30 active:scale-[0.99] transition-transform">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-deep-navy/40 flex items-center justify-center text-2xl flex-shrink-0">🕵️</div>
              <div className="flex-1 min-w-0">
                <p className="font-extrabold text-text-primary">Guess the Player</p>
                <p className="text-xs text-text-secondary">From a transfer trail · keep your streak 🔥</p>
              </div>
              <span className="text-warm-yellow font-bold text-sm">Play →</span>
            </div>
          </button>
          <button onClick={() => setOpenLineupPuzzle(true)}
            className="w-full text-left p-4 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-electric-blue/10 border border-emerald-500/30 active:scale-[0.99] transition-transform">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-deep-navy/40 flex items-center justify-center text-2xl flex-shrink-0">🧩</div>
              <div className="flex-1 min-w-0">
                <p className="font-extrabold text-text-primary">Guess the Lineup</p>
                <p className="text-xs text-text-secondary">Find the missing player on the pitch 🔥</p>
              </div>
              <span className="text-emerald-400 font-bold text-sm">Play →</span>
            </div>
          </button>
          <button onClick={() => setOpenGrid(true)}
            className="w-full text-left p-4 rounded-2xl bg-gradient-to-br from-hot-red/20 to-warm-yellow/10 border border-hot-red/30 active:scale-[0.99] transition-transform">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-deep-navy/40 flex items-center justify-center text-2xl flex-shrink-0">⬛</div>
              <div className="flex-1 min-w-0">
                <p className="font-extrabold text-text-primary">Box2Box</p>
                <p className="text-xs text-text-secondary">Fill the 3×3 grid in 3 min 🔥</p>
              </div>
              <span className="text-hot-red font-bold text-sm">Play →</span>
            </div>
          </button>
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-text-primary">Spinwheels</h2>
          <div className="grid grid-cols-3 gap-2">
            <SpinwheelCard tier="free" onClick={() => handleSpinwheelClick('free')} isAvailable={checkTicketAvailability('free')} />
            <SpinwheelCard tier="amateur" onClick={() => handleSpinwheelClick('amateur')} isAvailable={checkTicketAvailability('amateur')} />
            <SpinwheelCard tier="master" onClick={() => handleSpinwheelClick('master')} isAvailable={checkTicketAvailability('master')} />
            <SpinwheelCard tier="apex" onClick={() => handleSpinwheelClick('apex')} isAvailable={checkTicketAvailability('apex')} />
            <SpinwheelCard tier="premium" onClick={() => handleSpinwheelClick('premium')} isAvailable={checkTicketAvailability('premium')} />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-text-primary">Casual Games</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {funzone.availableGames.map(game => (
              <CasualGameCard key={game.id} game={game} />
            ))}
          </div>
        </div>
      </div>

      {profile && openTier && (
        <SpinwheelModal
          isOpen={!!openTier}
          onClose={() => setOpenTier(null)}
          tier={openTier}
          userId={profile.id}
          addToast={addToast}
        />
      )}
      {profile && openConnections && (
        <GuessConnectionsGame userId={profile.id} onBack={() => setOpenConnections(false)} addToast={addToast} />
      )}
      {profile && openGrid && (
        <GuessGridGame userId={profile.id} onBack={() => setOpenGrid(false)} addToast={addToast} />
      )}
      {profile && openPlayerPuzzle && (
        <GuessPlayerGame userId={profile.id} onBack={() => setOpenPlayerPuzzle(false)} addToast={addToast} />
      )}
      {profile && openLineupPuzzle && (
        <GuessLineupGame userId={profile.id} onBack={() => setOpenLineupPuzzle(false)} addToast={addToast} />
      )}
    </>
  );
};

export default FunZonePage;
