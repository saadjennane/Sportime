import React, { useState, useEffect } from 'react';
import { X, Trophy, Gift, Coins, Loader2, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useMockStore } from '../../store/useMockStore';
import { ConfettiExplosion } from '../shared/ConfettiExplosion';

interface PaidTournamentResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournament: {
    id: string;
    finalRanking: { id: string; rank: number }[];
    prizePool: number;
    rewardTier: 'Rookie' | 'Pro' | 'Elite';
    participationBonus: number;
  } | null;
}

export const PaidTournamentResultsModal: React.FC<PaidTournamentResultsModalProps> = ({ isOpen, onClose, tournament }) => {
  const [loading, setLoading] = useState(true);
  const [distributed, setDistributed] = useState(false);
  const { distributePrizes, currentUserId } = useMockStore();

  const playerRank = tournament?.finalRanking.find(p => p.id === currentUserId)?.rank;

  useEffect(() => {
    if (isOpen && tournament && !distributed) {
      setLoading(true);
      setTimeout(() => {
        distributePrizes({
          tournamentId: tournament.id,
          players: tournament.finalRanking,
          prizePool: tournament.prizePool,
          rewardTier: tournament.rewardTier,
          participationBonus: tournament.participationBonus,
        });
        setLoading(false);
        setDistributed(true);
      }, 2000); // Simulate distribution delay
    } else if (!isOpen) {
      // Reset state when modal is closed
      setLoading(true);
      setDistributed(false);
    }
  }, [isOpen, tournament, distributed, distributePrizes]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-deep-navy/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
      <div className="modal-base max-w-sm w-full p-6 space-y-6 relative overflow-hidden">
        {playerRank && playerRank <= 3 && distributed && <ConfettiExplosion />}
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-text-secondary hover:bg-white/10 rounded-full z-10">
          <X size={24} />
        </button>
        
        <div className="text-center">
          {loading ? (
            <div className="animate-pulse">
              <div className="inline-block p-4 rounded-full mb-3 bg-navy-accent">
                <Gift className="w-10 h-10 text-text-disabled" />
              </div>
              <h2 className="text-2xl font-bold text-text-primary">Distributing Rewards...</h2>
              <p className="text-text-secondary mt-2">Prizes are on their way to the winners!</p>
              <Loader2 className="w-8 h-8 text-electric-blue mx-auto mt-4 animate-spin" />
            </div>
          ) : (
            <div className="animate-scale-in">
              <div className="inline-block p-4 rounded-full mb-3 bg-lime-glow/10">
                <CheckCircle className="w-10 h-10 text-lime-glow" />
              </div>
              <h2 className="text-2xl font-bold text-text-primary">Rewards Distributed!</h2>
              <p className="text-text-secondary mt-2">All rewards have been delivered. Check your profile to view your coins and spins.</p>
              <button onClick={onClose} className="w-full primary-button mt-6">
                Awesome!
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
