import React, { useState } from 'react';
import { Profile, SpinTier } from '../types';
import { useMockStore } from '../store/useMockStore';
import { ProgressionBar } from '../components/funzone/ProgressionBar';
import { SpinwheelCard } from '../components/funzone/SpinwheelCard';
import { CasualGameCard } from '../components/funzone/CasualGameCard';
import { FreeSpinwheelModal } from '../components/funzone/FreeSpinwheelModal';
import { differenceInHours } from 'date-fns';

interface FunZonePageProps {
  profile: Profile | null;
  onOpenSpinWheel: (tier: SpinTier) => void;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

const FunZonePage: React.FC<FunZonePageProps> = ({ profile, onOpenSpinWheel, addToast }) => {
  const { funzone } = useMockStore();
  const [isFreeSpinModalOpen, setIsFreeSpinModalOpen] = useState(false);

  const isFreeSpinAvailable = !funzone.dailySpinLastUsed || differenceInHours(new Date(), new Date(funzone.dailySpinLastUsed)) >= 24;

  const handleSpinwheelClick = (tier: SpinTier) => {
    if (tier === 'free') {
      if (isFreeSpinAvailable) {
        setIsFreeSpinModalOpen(true);
      } else {
        addToast('You can only spin the free wheel once a day.', 'info');
      }
    } else {
      addToast(`The ${tier} spinwheel is coming soon!`, 'info');
      // onOpenSpinWheel(tier); // This would open the paid wheels
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-text-primary">FunZone 🎮</h1>
        <p className="text-text-secondary mt-1">Play, progress, and spin your way to rewards!</p>
      </div>

      <ProgressionBar currentWins={funzone.userProgress} />

      <div className="space-y-2">
        <h2 className="text-xl font-bold text-text-primary">Spinwheels</h2>
        <div className="flex space-x-4 overflow-x-auto pb-4 -mx-4 px-4 no-scrollbar">
          <SpinwheelCard tier="free" onSpin={() => handleSpinwheelClick('free')} isAvailable={isFreeSpinAvailable} />
          <SpinwheelCard tier="rookie" onSpin={() => handleSpinwheelClick('rookie')} />
          <SpinwheelCard tier="pro" onSpin={() => handleSpinwheelClick('pro')} />
          <SpinwheelCard tier="elite" onSpin={() => handleSpinwheelClick('elite')} />
          <SpinwheelCard tier="premium" onSpin={() => handleSpinwheelClick('premium')} />
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

      {profile && (
        <FreeSpinwheelModal
          isOpen={isFreeSpinModalOpen}
          onClose={() => setIsFreeSpinModalOpen(false)}
          userId={profile.id}
          addToast={addToast}
        />
      )}
    </div>
  );
};

export default FunZonePage;
