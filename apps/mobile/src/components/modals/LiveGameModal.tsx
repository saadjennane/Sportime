import React, { useState } from 'react';
import { X, Gift, Coins, Loader2, Info } from 'lucide-react';

interface LiveGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchId: string | null;
  matchName: string | null;
  onSelectMode: (mode: 'free' | 'ranked') => void;
  isLoading?: boolean;
}

type InfoMode = 'free' | 'ranked' | null;

export const LiveGameModal: React.FC<LiveGameModalProps> = ({
  isOpen,
  onClose,
  matchName,
  onSelectMode,
  isLoading = false
}) => {
  const [showInfo, setShowInfo] = useState<InfoMode>(null);

  if (!isOpen) return null;

  // Info content for each mode
  const renderInfoContent = (mode: InfoMode) => {
    if (mode === 'free') {
      return (
        <div className="text-left space-y-3">
          <div className="flex items-center gap-2">
            <Gift className="text-lime-glow" size={20} />
            <h3 className="font-bold text-text-primary">Free Betting Game</h3>
          </div>
          <p className="text-text-secondary text-sm">Play without risking your coins!</p>
          <ul className="text-sm text-text-secondary space-y-1">
            <li>• Start with 1000 virtual coins</li>
            <li>• Bet on live match events</li>
            <li>• Top 3 players win real rewards:</li>
            <li className="pl-3">🥇 1st: 500 coins + Apex Ticket</li>
            <li className="pl-3">🥈 2nd: 300 coins</li>
            <li className="pl-3">🥉 3rd: 100 coins</li>
          </ul>
          <p className="text-xs text-lime-glow">Perfect for practicing or casual fun!</p>
        </div>
      );
    }
    if (mode === 'ranked') {
      return (
        <div className="text-left space-y-3">
          <div className="flex items-center gap-2">
            <Coins className="text-warm-yellow" size={20} />
            <h3 className="font-bold text-text-primary">Stakes Betting Game</h3>
          </div>
          <p className="text-text-secondary text-sm">Play for real coins!</p>
          <ul className="text-sm text-text-secondary space-y-1">
            <li>• Entry fee: Based on your level</li>
            <li>• Your entry becomes your starting balance</li>
            <li>• Bet on live match events</li>
            <li>• All your winnings go to your wallet</li>
          </ul>
          <p className="text-xs text-warm-yellow">Higher risk, higher reward!</p>
        </div>
      );
    }
    return null;
  };

  // If showing info, render info modal
  if (showInfo) {
    return (
      <div className="fixed inset-0 bg-deep-navy/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
        <div className="modal-base max-w-sm w-full p-6 space-y-5 relative">
          <button
            onClick={() => setShowInfo(null)}
            className="absolute top-4 right-4 p-2 text-text-secondary hover:bg-white/10 rounded-full"
          >
            <X size={24} />
          </button>
          {renderInfoContent(showInfo)}
          <button
            onClick={() => setShowInfo(null)}
            className="w-full primary-button"
          >
            Got it!
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-deep-navy/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
      <div className="modal-base max-w-sm w-full p-6 space-y-5 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-text-secondary hover:bg-white/10 rounded-full"
        >
          <X size={24} />
        </button>

        <div className="text-center">
          <h2 className="text-2xl font-bold text-text-primary">⚡ Live Game</h2>
          {matchName && <p className="text-text-secondary text-sm mt-1">{matchName}</p>}
        </div>

        <div className="space-y-3 pt-4">
          {/* Free Mode */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onSelectMode('free')}
              disabled={isLoading}
              className="flex-1 text-left p-4 rounded-xl bg-deep-navy hover:bg-navy-accent border-2 border-lime-glow/30 hover:border-lime-glow transition-all disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <Gift className="text-lime-glow flex-shrink-0" size={24} />
                <div>
                  <h4 className="font-bold text-text-primary">Free Betting Game</h4>
                  <p className="text-sm text-text-secondary">No coins at risk • Win rewards!</p>
                </div>
              </div>
            </button>
            <button
              onClick={() => setShowInfo('free')}
              className="p-3 rounded-lg bg-navy-accent/50 text-text-secondary hover:text-lime-glow hover:bg-navy-accent transition-all"
            >
              <Info size={20} />
            </button>
          </div>

          {/* Stakes Mode */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onSelectMode('ranked')}
              disabled={isLoading}
              className="flex-1 text-left p-4 rounded-xl bg-deep-navy hover:bg-navy-accent border-2 border-warm-yellow/30 hover:border-warm-yellow transition-all disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <Coins className="text-warm-yellow flex-shrink-0" size={24} />
                <div>
                  <h4 className="font-bold text-text-primary">Stakes Betting Game</h4>
                  <p className="text-sm text-text-secondary">Bet real coins • Keep winnings!</p>
                </div>
              </div>
            </button>
            <button
              onClick={() => setShowInfo('ranked')}
              className="p-3 rounded-lg bg-navy-accent/50 text-text-secondary hover:text-warm-yellow hover:bg-navy-accent transition-all"
            >
              <Info size={20} />
            </button>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center gap-2 text-text-secondary">
            <Loader2 className="animate-spin" size={16} />
            <span className="text-sm">Creating game...</span>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full text-text-secondary hover:text-text-primary transition-colors text-sm pt-2"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
