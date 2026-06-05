import React, { useState } from 'react';
import { Profile, SpinTier } from '../types';
import { useMockStore } from '../store/useMockStore';
import { ProgressionBar } from '../components/funzone/ProgressionBar';
import { SpinwheelCard } from '../components/funzone/SpinwheelCard';
import { CasualGameCard } from '../components/funzone/CasualGameCard';
import { FreeSpinwheelModal } from '../components/funzone/FreeSpinwheelModal';
import { SpinwheelPreviewModal } from '../components/funzone/SpinwheelPreviewModal';
import { differenceInHours } from 'date-fns';

interface FunZonePageProps {
  profile: Profile | null;
  onOpenSpinWheel: (tier: SpinTier) => void;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

const FunZonePage: React.FC<FunZonePageProps> = ({ profile, onOpenSpinWheel, addToast }) => {
  const { funzone, userTickets } = useMockStore();
  const [isFreeSpinModalOpen, setIsFreeSpinModalOpen] = useState(false);
  const [previewingTier, setPreviewingTier] = useState<SpinTier | null>(null);

  const isFreeSpinAvailable = !funzone.dailySpinLastUsed || differenceInHours(new Date(), new Date(funzone.dailySpinLastUsed)) >= 24;

  const handleSpinwheelClick = (tier: SpinTier) => {
    if (tier === 'free') {
      if (isFreeSpinAvailable) {
        setIsFreeSpinModalOpen(true);
      } else {
        addToast('You can only spin the free wheel once a day.', 'info');
      }
    } else {
      // For now, all other wheels are locked and show a preview
      setPreviewingTier(tier);
    }
  };

  const checkTicketAvailability = (tier: SpinTier): boolean => {
    if (tier === 'free') return isFreeSpinAvailable;
    if (tier === 'premium') return profile?.is_subscriber ?? false;

    if (!profile) return false;

    const now = new Date();
    return userTickets.some(ticket =>
      ticket.user_id === profile.id &&
      ticket.type === tier &&
      !ticket.is_used &&
      new Date(ticket.expires_at) > now
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

      {profile && (
        <FreeSpinwheelModal
          isOpen={isFreeSpinModalOpen}
          onClose={() => setIsFreeSpinModalOpen(false)}
          userId={profile.id}
          addToast={addToast}
        />
      )}

      <SpinwheelPreviewModal
        isOpen={!!previewingTier}
        onClose={() => setPreviewingTier(null)}
        tier={previewingTier!}
      />
    </>
  );
};

export default FunZonePage;
