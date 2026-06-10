import React, { useState, useEffect } from 'react';
import { Profile, SpinTier } from '../types';
import { useMockStore } from '../store/useMockStore';
import { ProgressionBar } from '../components/funzone/ProgressionBar';
import { SpinwheelCard } from '../components/funzone/SpinwheelCard';
import { CasualGameCard } from '../components/funzone/CasualGameCard';
import { SpinwheelModal } from '../components/funzone/SpinwheelModal';
import { prefetchSpinSegments } from '../services/spinSegmentsService';
import GuessScoreGame from './GuessScoreGame';
import GuessPlayerGame from './GuessPlayerGame';

interface FunZonePageProps {
  profile: Profile | null;
  onOpenSpinWheel: (tier: SpinTier) => void;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

const FunZonePage: React.FC<FunZonePageProps> = ({ profile, onOpenSpinWheel, addToast }) => {
  const { funzone, userTickets } = useMockStore();
  const [openTier, setOpenTier] = useState<SpinTier | null>(null);
  const [openPuzzle, setOpenPuzzle] = useState(false);
  const [openPlayerPuzzle, setOpenPlayerPuzzle] = useState(false);

  // Prefetch wheel content so the modal opens instantly (only re-downloads on change).
  useEffect(() => { prefetchSpinSegments(); }, []);

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
          <button onClick={() => setOpenPuzzle(true)}
            className="w-full text-left p-4 rounded-2xl bg-gradient-to-br from-electric-blue/20 to-lime-glow/10 border border-electric-blue/30 active:scale-[0.99] transition-transform">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-deep-navy/40 flex items-center justify-center text-2xl flex-shrink-0">⚽</div>
              <div className="flex-1 min-w-0">
                <p className="font-extrabold text-text-primary">Guess the Score</p>
                <p className="text-xs text-text-secondary">5 matches · timed · keep your streak 🔥</p>
              </div>
              <span className="text-electric-blue font-bold text-sm">Play →</span>
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
      {profile && openPuzzle && (
        <GuessScoreGame userId={profile.id} onBack={() => setOpenPuzzle(false)} addToast={addToast} />
      )}
      {profile && openPlayerPuzzle && (
        <GuessPlayerGame userId={profile.id} onBack={() => setOpenPlayerPuzzle(false)} addToast={addToast} />
      )}
    </>
  );
};

export default FunZonePage;
