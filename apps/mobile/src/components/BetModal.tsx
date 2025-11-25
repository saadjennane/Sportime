import React, { useState, useEffect, useMemo } from 'react';
import { X, Coins, TrendingUp } from 'lucide-react';
import { Match, Bet } from '../types';

// Helper function to render team icon (extracted to avoid inline function issues)
const renderTeamIcon = (
  team: Match['teamA'],
  options?: { wrapperClass?: string; sizeClass?: string }
) => {
  const wrapperClass = options?.wrapperClass ?? 'mb-1';
  const sizeClass = options?.sizeClass ?? 'w-12 h-12';
  if (team.logo) {
    return (
      <div className={`${wrapperClass} flex justify-center`}>
        <img src={team.logo} alt={team.name} className={`${sizeClass} object-contain`} />
      </div>
    );
  }
  const fallback =
    team.emoji && team.emoji.length === 1 ? team.emoji : (team.name?.charAt(0).toUpperCase() || '?');
  return (
    <div className={`${wrapperClass} flex items-center justify-center`}>
      <span className={`${sizeClass} rounded-full bg-deep-navy flex items-center justify-center text-2xl font-bold text-electric-blue`}>
        {fallback}
      </span>
    </div>
  );
};

// PredictionOption component - EXTRACTED OUTSIDE to prevent React Error #300
interface PredictionOptionProps {
  label: string;
  team?: Match['teamA'];
  currentOdds: number;
  predictionKey: 'teamA' | 'draw' | 'teamB';
  isActive: boolean;
  onSelect: (predictionKey: 'teamA' | 'draw' | 'teamB', odds: number) => void;
}

const PredictionOption: React.FC<PredictionOptionProps> = ({
  label,
  team,
  currentOdds,
  predictionKey,
  isActive,
  onSelect,
}) => {
  const safeOdds = typeof currentOdds === 'number' && Number.isFinite(currentOdds) ? currentOdds : 0;
  const icon =
    team !== undefined ? (
      renderTeamIcon(team, { wrapperClass: 'mb-1', sizeClass: 'w-12 h-12' })
    ) : (
      <div className="mb-1 flex items-center justify-center">
        <span className="w-12 h-12 rounded-full bg-deep-navy flex items-center justify-center text-2xl font-bold text-electric-blue">
          🤝
        </span>
      </div>
    );
  return (
    <button
      onClick={() => onSelect(predictionKey, safeOdds)}
      className={`flex-1 flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all duration-200 ${
        isActive
          ? 'bg-electric-blue/10 border-electric-blue shadow-inner'
          : 'bg-deep-navy border-disabled hover:border-electric-blue/50'
      }`}
    >
      {icon}
      <span className="text-xs font-bold text-text-primary">{label}</span>
      <span className="text-sm font-semibold text-electric-blue">@{safeOdds.toFixed(2)}</span>
    </button>
  );
};

interface BetModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: Match;
  prediction: 'teamA' | 'draw' | 'teamB';
  odds: number;
  balance: number;
  betLimit?: number | null;
  onConfirm: (amount: number, prediction: 'teamA' | 'draw' | 'teamB', odds: number) => void;
  userBet?: Bet;
  onCancelBet: (matchId: string) => void;
}

export const BetModal: React.FC<BetModalProps> = ({
  isOpen,
  onClose,
  match,
  prediction,
  odds,
  balance,
  betLimit,
  onConfirm,
  userBet,
  onCancelBet
}) => {
  const [amount, setAmount] = useState<string>('');
  const [selectedPrediction, setSelectedPrediction] = useState(prediction);
  const [selectedOdds, setSelectedOdds] = useState(odds);

  useEffect(() => {
    if (isOpen) {
      if (userBet) {
        setSelectedPrediction(userBet.prediction);
        const safeUserOdds = typeof userBet.odds === 'number' && Number.isFinite(userBet.odds) ? userBet.odds : 0;
        setSelectedOdds(safeUserOdds);
        setAmount(userBet.amount.toString());
      } else {
        setSelectedPrediction(prediction);
        const safePropOdds = typeof odds === 'number' && Number.isFinite(odds) ? odds : 0;
        setSelectedOdds(safePropOdds);
        setAmount('');
      }
    }
  }, [isOpen, prediction, odds, userBet]);

  if (!isOpen) return null;

  const numAmount = parseInt(amount) || 0;
  const availableFunds = balance + (userBet?.amount ?? 0);
  const maxPerLevel = betLimit ?? null;
  const effectiveMax = Math.max(
    0,
    maxPerLevel !== null ? Math.min(maxPerLevel, availableFunds) : availableFunds
  );
  const safeSelectedOdds = typeof selectedOdds === 'number' && Number.isFinite(selectedOdds) ? selectedOdds : 0;
  const potentialWin = numAmount * safeSelectedOdds;
  const overBalance = numAmount > availableFunds;
  const overLevelLimit = maxPerLevel !== null && numAmount > maxPerLevel;
  const isConfirmDisabled = numAmount <= 0 || overBalance || overLevelLimit;

  const quickAmounts = useMemo(() => {
    if (effectiveMax <= 0) return [] as number[];
    const presets = [100, 250, 500, 1000, 2500, 5000];
    const filtered = presets
      .filter((value) => value > 0 && value <= effectiveMax)
      .slice(0, 4);
    if (!filtered.includes(effectiveMax) && effectiveMax > 0) {
      filtered.push(effectiveMax);
    }
    const unique = Array.from(new Set(filtered.map((value) => Math.floor(value))));
    unique.sort((a, b) => a - b);
    return unique;
  }, [effectiveMax]);

  const handleConfirm = () => {
    if (!isConfirmDisabled) {
      onConfirm(numAmount, selectedPrediction, safeSelectedOdds);
      onClose();
    }
  };

  const handleCancelBetClick = () => {
    onCancelBet(match.id);
    onClose();
  };

  const formatQuickAmount = (value: number) => {
    if (value >= 1000) {
      return `${value / 1000}K`;
    }
    return value.toString();
  };

  const handlePredictionChange = (newPrediction: 'teamA' | 'draw' | 'teamB', newOdds: number) => {
    setSelectedPrediction(newPrediction);
    setSelectedOdds(newOdds);
  };

  return (
    <div className="fixed inset-0 bg-deep-navy/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
      <div className="modal-base max-w-sm w-full p-6 space-y-5">

        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-text-primary">{userBet ? 'Modify Bet' : 'Place Bet'}</h2>
          <button
            onClick={onClose}
            className="p-2 text-text-secondary hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="bg-deep-navy border border-disabled rounded-2xl p-4">
          <div className="flex justify-between items-center text-xs font-semibold text-text-disabled uppercase mb-2">
            <span>Match</span>
            <span>{match.kickoffTime}</span>
          </div>
          <div className="flex items-center justify-center gap-4 text-center">
            <div className="flex-1">
              {renderTeamIcon(match.teamA)}
              <div className="text-sm font-bold text-text-primary">{match.teamA.name}</div>
            </div>
            <div className="text-lg font-bold text-disabled">vs</div>
            <div className="flex-1">
              {renderTeamIcon(match.teamB)}
              <div className="text-sm font-bold text-text-primary">{match.teamB.name}</div>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-text-disabled uppercase mb-2">
            Your Prediction
          </label>
          <div className="flex gap-2">
            <PredictionOption
              label={match.teamA.name.split(' ')[0]}
              team={match.teamA}
              currentOdds={match.odds.teamA}
              predictionKey="teamA"
              isActive={selectedPrediction === 'teamA'}
              onSelect={handlePredictionChange}
            />
            <PredictionOption
              label="Draw"
              team={undefined}
              currentOdds={match.odds.draw}
              predictionKey="draw"
              isActive={selectedPrediction === 'draw'}
              onSelect={handlePredictionChange}
            />
            <PredictionOption
              label={match.teamB.name.split(' ')[0]}
              team={match.teamB}
              currentOdds={match.odds.teamB}
              predictionKey="teamB"
              isActive={selectedPrediction === 'teamB'}
              onSelect={handlePredictionChange}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-text-disabled uppercase mb-2">
            Bet Amount
          </label>
          <div className="relative">
            <Coins className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-warm-yellow" />
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="input-base pl-12 text-lg"
              min="0"
              max={effectiveMax}
            />
          </div>
          {maxPerLevel !== null && (
            <p className="text-xs text-text-secondary mt-2">
              Level limit: <span className="font-semibold text-warm-yellow">{maxPerLevel.toLocaleString()} coins</span>
            </p>
          )}
          {overLevelLimit && (
            <p className="text-xs text-hot-red mt-1">You can bet up to {maxPerLevel?.toLocaleString()} coins at your current level.</p>
          )}
          {overBalance && (
            <p className="text-xs text-hot-red mt-1">Insufficient balance (available: {(availableFunds).toLocaleString()} coins).</p>
          )}
          {quickAmounts.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {quickAmounts.map((quickAmount) => (
                <button
                  key={quickAmount}
                  onClick={() => setAmount(quickAmount.toString())}
                  className="flex-1 min-w-[80px] py-2 px-2 bg-deep-navy hover:bg-electric-blue/20 rounded-lg text-sm font-semibold text-text-secondary hover:text-electric-blue transition-colors"
                >
                  {quickAmount === effectiveMax ? 'Max' : formatQuickAmount(quickAmount)}
                </button>
              ))}
              {effectiveMax > 0 && (
                <button
                  onClick={() => setAmount(Math.floor(effectiveMax).toString())}
                  className="py-2 px-3 bg-electric-blue text-white rounded-lg text-sm font-semibold hover:bg-electric-blue/90 transition-colors"
                >
                  All In
                </button>
              )}
            </div>
          )}
        </div>

        <div className="bg-lime-glow/10 border border-lime-glow/20 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-lime-glow" />
              <span className="text-sm font-medium text-lime-glow/90">Potential Win</span>
            </div>
            <span className="text-xl font-bold text-lime-glow">
              {potentialWin.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          {userBet ? (
            <div className="flex gap-3">
              <button
                onClick={handleCancelBetClick}
                className="flex-1 py-3.5 px-6 bg-hot-red/20 hover:bg-hot-red/30 rounded-xl font-bold text-hot-red transition-colors"
              >
                Cancel Bet
              </button>
              <button
                onClick={handleConfirm}
                disabled={isConfirmDisabled}
                className="primary-button flex-1"
              >
                Modify Bet
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3.5 px-6 bg-disabled hover:bg-disabled/80 rounded-xl font-bold text-text-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={isConfirmDisabled}
                className="primary-button flex-1"
              >
                Confirm Bet
              </button>
            </div>
          )}
          <div className="text-center">
            <span className="text-sm text-text-secondary">
              Balance: <span className="font-semibold text-warm-yellow">{balance.toLocaleString()} coins</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
