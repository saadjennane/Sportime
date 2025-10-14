import React, { useMemo } from 'react';
import { ChallengeMatch, ChallengeBet, Profile } from '../types';
import { TrendingUp, Zap } from 'lucide-react';
import { LEVEL_BET_LIMITS } from '../config/constants';

interface ChallengeBetControllerProps {
  match: ChallengeMatch;
  bet?: ChallengeBet;
  onBetChange: (prediction: 'teamA' | 'draw' | 'teamB' | null, amount: number) => void;
  disabled: boolean;
  maxAmount: number;
  isBoosterArmed: boolean;
  onApplyBooster: () => void;
  isBoosted: boolean;
  boosterType?: 'x2' | 'x3';
  profile: Profile;
}

export const ChallengeBetController: React.FC<ChallengeBetControllerProps> = ({ match, bet, onBetChange, disabled, maxAmount, isBoosterArmed, onApplyBooster, isBoosted, boosterType, profile }) => {
  const { teamA, teamB, odds } = match;
  const selectedPrediction = bet?.prediction;
  const amount = bet?.amount || '';

  const betLimit = profile.level ? LEVEL_BET_LIMITS[profile.level] : 500;
  const effectiveMaxAmount = betLimit ? Math.min(maxAmount, betLimit) : maxAmount;

  const handlePredictionClick = (prediction: 'teamA' | 'draw' | 'teamB') => {
    if (disabled) return;
    const currentAmount = bet?.amount || 0;
    if (prediction === selectedPrediction) {
      onBetChange(null, 0);
    } else {
      onBetChange(prediction, currentAmount);
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled || !selectedPrediction) return;
    let newAmount = parseInt(e.target.value) || 0;
    if (newAmount > effectiveMaxAmount) {
      newAmount = effectiveMaxAmount;
    }
    if (newAmount < 0) {
      newAmount = 0;
    }
    onBetChange(selectedPrediction, newAmount);
  };

  const potentialGain = useMemo(() => {
    if (bet && bet.amount > 0 && bet.prediction) {
      let gain = (bet.amount * match.odds[bet.prediction]);
      if (isBoosted) {
          if (boosterType === 'x2') gain *= 2;
          if (boosterType === 'x3') gain *= 3;
      }
      return gain;
    }
    return 0;
  }, [bet, match.odds, isBoosted, boosterType]);

  const quickBetAmounts = useMemo(() => {
    const defaults = [100, 200, 500];
    const availableAmounts = defaults.filter(a => a < effectiveMaxAmount);
    if (effectiveMaxAmount > 0) {
        availableAmounts.push(effectiveMaxAmount);
    }
    const finalAmounts = [...new Set(availableAmounts)];
    return finalAmounts.slice(0, 4);
  }, [effectiveMaxAmount]);

  const BetOption: React.FC<{
    label: string;
    odd: number;
    prediction: 'teamA' | 'draw' | 'teamB';
  }> = ({ label, odd, prediction }) => {
    const isSelected = selectedPrediction === prediction;
    const isWinningOutcome = match.status === 'played' && match.result === prediction;

    return (
      <button
        onClick={() => handlePredictionClick(prediction)}
        disabled={disabled}
        className={`flex-1 p-2 border-2 rounded-lg text-center transition-all ${
          isSelected ? 'bg-electric-blue/20 border-electric-blue' : 'bg-deep-navy border-disabled hover:border-electric-blue/50'
        } ${disabled ? 'cursor-not-allowed bg-navy-accent' : ''} ${isWinningOutcome ? '!bg-lime-glow/20 !border-lime-glow' : ''}`}
      >
        <div className="text-sm font-semibold text-text-primary">{label}</div>
        <div className="text-xs text-electric-blue">@{odd.toFixed(2)}</div>
      </button>
    );
  };

  return (
    <div className={`bg-navy-accent rounded-xl p-3 space-y-3 border-2 relative ${selectedPrediction ? 'border-electric-blue/50' : 'border-transparent'} ${disabled && match.status === 'played' ? 'opacity-70' : ''}`}>
      {isBoosted && (
        <span className={`absolute -top-2 -right-2 text-xs font-bold px-2 py-1 rounded-full text-white shadow-lg ${boosterType === 'x2' ? 'bg-blue-500' : 'bg-red-500'}`}>
          {boosterType === 'x2' ? 'x2 🔥' : 'x3 🚀'}
        </span>
      )}
      <div className="flex justify-between items-center">
        <p className="text-sm font-bold text-text-primary pr-10">{teamA.emoji} {teamA.name} vs {teamB.emoji} {teamB.name}</p>
        {match.status === 'played' && (
          <span className="text-xs font-bold px-2 py-1 rounded-full bg-disabled text-text-disabled">
            Played
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <BetOption label={teamA.name} odd={odds.teamA} prediction="teamA" />
        <BetOption label="Draw" odd={odds.draw} prediction="draw" />
        <BetOption label={teamB.name} odd={odds.teamB} prediction="teamB" />
      </div>
      <div>
        <input
          type="number"
          value={amount}
          onChange={handleAmountChange}
          placeholder="Bet amount"
          disabled={!selectedPrediction || disabled}
          max={effectiveMaxAmount}
          min="0"
          className="w-full p-2 bg-deep-navy border-2 border-disabled rounded-lg focus:border-electric-blue focus:outline-none disabled:bg-navy-accent disabled:cursor-not-allowed"
        />
        {betLimit && Number(amount) > betLimit && (
            <p className="text-xs text-hot-red mt-1 text-center">Max bet for your level is {betLimit} coins.</p>
        )}
        {selectedPrediction && !disabled && quickBetAmounts.length > 0 && (
          <div className="flex gap-2 mt-2">
            {quickBetAmounts.map((qAmount) => (
              <button
                key={qAmount}
                onClick={() => onBetChange(selectedPrediction, qAmount)}
                className="flex-1 py-1.5 px-2 bg-deep-navy hover:bg-electric-blue/20 rounded-lg text-xs font-semibold text-text-secondary hover:text-electric-blue transition-colors"
              >
                {qAmount === effectiveMaxAmount ? 'All In' : qAmount.toLocaleString()}
              </button>
            ))}
          </div>
        )}
      </div>
      {potentialGain > 0 && !disabled && (
        <div className="flex items-center justify-end gap-2 text-lime-glow">
          <TrendingUp size={14} />
          <span className="text-xs font-semibold">
            Potential Gain: +{potentialGain.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>
      )}
      {isBoosterArmed && (
        <button
          onClick={onApplyBooster}
          className="w-full flex items-center justify-center gap-2 text-sm p-2 bg-warm-yellow/20 text-warm-yellow rounded-lg hover:bg-warm-yellow/30 font-semibold mt-2"
        >
          <Zap size={14} /> Apply Booster to this Match
        </button>
      )}
    </div>
  );
};
