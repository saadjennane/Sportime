import React, { useState, useEffect } from 'react';
import { X, Gift, Coins, Loader2, Info, ChevronLeft, Wallet } from 'lucide-react';
import { getTierLimits, getMaxEntryForTier } from '../../services/liveGameService';

interface LiveGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchId: string | null;
  matchName: string | null;
  onSelectMode: (mode: 'free' | 'ranked', entryCost?: number) => void;
  isLoading?: boolean;
  userBalance?: number;
  userTier?: string; // 'rookie', 'rising_star', 'pro', 'legend', 'goat'
}

type ViewMode = 'select' | 'stakes' | 'info-free' | 'info-ranked';

// Entry amount options
const ENTRY_OPTIONS = [100, 250, 500, 1000, 2500, 5000, 10000];

// Tier display names
const TIER_DISPLAY_NAMES: Record<string, string> = {
  rookie: 'Rookie',
  rising_star: 'Rising Star',
  pro: 'Pro',
  legend: 'Legend',
  goat: 'GOAT',
};

export const LiveGameModal: React.FC<LiveGameModalProps> = ({
  isOpen,
  onClose,
  matchName,
  onSelectMode,
  isLoading = false,
  userBalance = 0,
  userTier = 'rookie',
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('select');
  const [selectedEntry, setSelectedEntry] = useState<number>(100);
  const [tierLimits, setTierLimits] = useState<Record<string, number>>({});
  const [isLoadingLimits, setIsLoadingLimits] = useState(false);

  // Load tier limits on mount
  useEffect(() => {
    if (isOpen) {
      setIsLoadingLimits(true);
      getTierLimits()
        .then(limits => {
          setTierLimits(limits);
          // Set initial selection to first available option
          const maxEntry = getMaxEntryForTier(userTier, limits);
          const firstAvailable = ENTRY_OPTIONS.find(opt => opt <= maxEntry && opt <= userBalance);
          if (firstAvailable) setSelectedEntry(firstAvailable);
        })
        .catch(err => console.error('[LiveGameModal] Error loading tier limits:', err))
        .finally(() => setIsLoadingLimits(false));
    }
  }, [isOpen, userTier, userBalance]);

  // Reset view when modal closes
  useEffect(() => {
    if (!isOpen) {
      setViewMode('select');
      setSelectedEntry(100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const maxEntry = getMaxEntryForTier(userTier, tierLimits);
  const tierDisplayName = TIER_DISPLAY_NAMES[userTier.toLowerCase().replace(/\s+/g, '_')] || userTier;

  // Info content for each mode
  const renderInfoContent = (mode: 'free' | 'ranked') => {
    if (mode === 'free') {
      return (
        <div className="text-left space-y-3">
          <div className="flex items-center gap-2">
            <Gift className="text-lime-glow" size={20} />
            <h3 className="font-bold text-text-primary">Free Prediction Game</h3>
          </div>
          <p className="text-text-secondary text-sm">Play without risking your coins!</p>
          <ul className="text-sm text-text-secondary space-y-1">
            <li>• Start with 1000 virtual coins</li>
            <li>• Predict the final score + bonus questions</li>
            <li>• Top 3 players win real rewards:</li>
            <li className="pl-3">🥇 1st: 500 coins + Apex Ticket</li>
            <li className="pl-3">🥈 2nd: 300 coins</li>
            <li className="pl-3">🥉 3rd: 100 coins</li>
          </ul>
          <p className="text-xs text-lime-glow">Perfect for practicing or casual fun!</p>
        </div>
      );
    }
    return (
      <div className="text-left space-y-3">
        <div className="flex items-center gap-2">
          <Coins className="text-warm-yellow" size={20} />
          <h3 className="font-bold text-text-primary">Stakes Prediction Game</h3>
        </div>
        <p className="text-text-secondary text-sm">Play for real coins!</p>
        <ul className="text-sm text-text-secondary space-y-1">
          <li>• Choose your entry (limited by your level)</li>
          <li>• Your entry becomes your starting balance</li>
          <li>• Predict the final score + bonus questions</li>
          <li>• All your winnings go to your wallet</li>
        </ul>
        <p className="text-xs text-warm-yellow">Higher risk, higher reward!</p>
      </div>
    );
  };

  // Render info view
  if (viewMode === 'info-free' || viewMode === 'info-ranked') {
    const mode = viewMode === 'info-free' ? 'free' : 'ranked';
    return (
      <div className="fixed inset-0 bg-deep-navy/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
        <div className="modal-base max-w-sm w-full p-6 space-y-5 relative">
          <button
            onClick={() => setViewMode('select')}
            className="absolute top-4 left-4 p-2 text-text-secondary hover:bg-white/10 rounded-full"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-text-secondary hover:bg-white/10 rounded-full"
          >
            <X size={24} />
          </button>
          <div className="pt-8">
            {renderInfoContent(mode)}
          </div>
          <button
            onClick={() => setViewMode('select')}
            className="w-full primary-button"
          >
            Got it!
          </button>
        </div>
      </div>
    );
  }

  // Render stakes selection view
  if (viewMode === 'stakes') {
    const canStart = selectedEntry <= userBalance && selectedEntry <= maxEntry;

    return (
      <div className="fixed inset-0 bg-deep-navy/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
        <div className="modal-base max-w-sm w-full p-6 space-y-5 relative">
          <button
            onClick={() => setViewMode('select')}
            className="absolute top-4 left-4 p-2 text-text-secondary hover:bg-white/10 rounded-full"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-text-secondary hover:bg-white/10 rounded-full"
          >
            <X size={24} />
          </button>

          <div className="text-center pt-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Coins className="text-warm-yellow" size={24} />
              <h2 className="text-xl font-bold text-text-primary">Stakes Prediction Game</h2>
            </div>
            {matchName && <p className="text-text-secondary text-sm">{matchName}</p>}
          </div>

          {/* Entry selection */}
          <div className="space-y-3">
            <p className="text-sm text-text-secondary text-center">Choose your entry:</p>

            {isLoadingLimits ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="animate-spin text-text-secondary" size={24} />
              </div>
            ) : (
              <div className="flex flex-wrap justify-center gap-2">
                {ENTRY_OPTIONS.map(amount => {
                  const isOverTierLimit = amount > maxEntry;
                  const isOverBalance = amount > userBalance;
                  const isDisabled = isOverTierLimit || isOverBalance;
                  const isSelected = selectedEntry === amount;

                  return (
                    <button
                      key={amount}
                      onClick={() => !isDisabled && setSelectedEntry(amount)}
                      disabled={isDisabled}
                      className={`
                        px-4 py-2 rounded-lg font-bold text-sm transition-all
                        ${isSelected
                          ? 'bg-warm-yellow text-deep-navy ring-2 ring-warm-yellow ring-offset-2 ring-offset-deep-navy'
                          : isDisabled
                            ? 'bg-navy-accent/30 text-text-disabled cursor-not-allowed'
                            : 'bg-navy-accent text-text-primary hover:bg-navy-accent/80'
                        }
                      `}
                      title={isOverTierLimit ? `Level up to unlock (${tierDisplayName} max: ${maxEntry})` : isOverBalance ? 'Insufficient balance' : ''}
                    >
                      {amount.toLocaleString()}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* User info */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-text-secondary">
                <Wallet size={16} />
                Balance:
              </span>
              <span className={`font-bold ${userBalance < selectedEntry ? 'text-hot-red' : 'text-lime-glow'}`}>
                {userBalance.toLocaleString()} coins
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">Your level:</span>
              <span className="font-bold text-electric-blue">{tierDisplayName}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">Max entry:</span>
              <span className="font-bold text-warm-yellow">{maxEntry.toLocaleString()} coins</span>
            </div>
          </div>

          {/* Start button */}
          <button
            onClick={() => onSelectMode('ranked', selectedEntry)}
            disabled={isLoading || !canStart}
            className="w-full primary-button bg-warm-yellow hover:bg-warm-yellow/90 text-deep-navy disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="animate-spin" size={18} />
                Creating game...
              </span>
            ) : (
              `Start Game (${selectedEntry.toLocaleString()} coins)`
            )}
          </button>

          {!canStart && !isLoading && (
            <p className="text-center text-xs text-hot-red">
              {selectedEntry > userBalance
                ? 'Insufficient balance'
                : `${tierDisplayName} level max: ${maxEntry.toLocaleString()} coins`
              }
            </p>
          )}
        </div>
      </div>
    );
  }

  // Main selection view
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
                  <h4 className="font-bold text-text-primary">Free Prediction Game</h4>
                  <p className="text-sm text-text-secondary">No coins at risk • Win rewards!</p>
                </div>
              </div>
            </button>
            <button
              onClick={() => setViewMode('info-free')}
              className="p-3 rounded-lg bg-navy-accent/50 text-text-secondary hover:text-lime-glow hover:bg-navy-accent transition-all"
            >
              <Info size={20} />
            </button>
          </div>

          {/* Stakes Mode */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('stakes')}
              disabled={isLoading}
              className="flex-1 text-left p-4 rounded-xl bg-deep-navy hover:bg-navy-accent border-2 border-warm-yellow/30 hover:border-warm-yellow transition-all disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <Coins className="text-warm-yellow flex-shrink-0" size={24} />
                <div>
                  <h4 className="font-bold text-text-primary">Stakes Prediction Game</h4>
                  <p className="text-sm text-text-secondary">Bet real coins • Keep winnings!</p>
                </div>
              </div>
            </button>
            <button
              onClick={() => setViewMode('info-ranked')}
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
