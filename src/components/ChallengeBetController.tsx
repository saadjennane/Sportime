import React, { useMemo } from 'react';
import { ChallengeMatch, ChallengeBet } from '../types';
import { TrendingUp, Zap } from 'lucide-react';

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
}

export const ChallengeBetController: React.FC<ChallengeBetControllerProps> = ({ match, bet, onBetChange, disabled, maxAmount, isBoosterArmed, onApplyBooster, isBoosted, boosterType }) => {
  const { teamA, teamB, odds } = match;
  const selectedPrediction = bet?.prediction;
  const amount = bet?.amount || '';

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
    if (newAmount > maxAmount) {
      newAmount = maxAmount;
    }
    if (newAmount < 0) {
      newAmount = 0;
    }
    onBetChange(selectedPrediction, newAmount);
  };

  const potentialProfit = useMemo(() => {
    if (bet && bet.amount > 0 && bet.prediction) {
      let profit = (bet.amount * match.odds[bet.prediction]) - bet.amount;
      if (isBoosted) {
          if (boosterType === 'x2') profit *= 2;
          if (boosterType === 'x3') profit *= 3;
      }
      return profit;
    }
    return 0;
  }, [bet, match.odds, isBoosted, boosterType]);

  const quickBetAmounts = useMemo(() => {
    const defaults = [100, 200, 500];
    const availableAmounts = defaults.filter(a => a < maxAmount);
    if (maxAmount > 0) {
        availableAmounts.push(maxAmount);
    }
    const finalAmounts = [...new Set(availableAmounts)];
    return finalAmounts.slice(0, 4);
  }, [maxAmount]);

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
          isSelected ? 'bg-purple-100 border-purple-500' : 'bg-gray-50 border-gray-200 hover:border-purple-300'
        } ${disabled ? 'cursor-not-allowed bg-gray-100' : ''} ${isWinningOutcome ? '!bg-green-100 !border-green-500' : ''}`}
      >
        <div className="text-sm font-semibold text-gray-800">{label}</div>
        <div className="text-xs text-gray-500">@{odd.toFixed(2)}</div>
      </button>
    );
  };

  return (
    <div className={`bg-white rounded-xl p-3 space-y-3 border-2 relative ${selectedPrediction ? 'border-purple-200' : 'border-transparent'} ${disabled && match.status === 'played' ? 'opacity-70' : ''}`}>
      {isBoosted && (
        <span className={`absolute -top-2 -right-2 text-xs font-bold px-2 py-1 rounded-full text-white shadow-lg ${boosterType === 'x2' ? 'bg-blue-500' : 'bg-red-500'}`}>
          {boosterType === 'x2' ? 'x2 🔥' : 'x3 🚀'}
        </span>
      )}
      <div className="flex justify-between items-center">
        <p className="text-sm font-bold text-gray-800 pr-10">{teamA.emoji} {teamA.name} vs {teamB.emoji} {teamB.name}</p>
        {match.status === 'played' && (
          <span className="text-xs font-bold px-2 py-1 rounded-full bg-gray-200 text-gray-700">
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
          max={maxAmount}
          min="0"
          className="w-full p-2 bg-gray-50 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
        {selectedPrediction && !disabled && quickBetAmounts.length > 0 && (
          <div className="flex gap-2 mt-2">
            {quickBetAmounts.map((qAmount) => (
              <button
                key={qAmount}
                onClick={() => onBetChange(selectedPrediction, qAmount)}
                className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-purple-100 rounded-lg text-xs font-semibold text-slate-700 hover:text-purple-700 transition-colors"
              >
                {qAmount === maxAmount ? 'All In' : qAmount.toLocaleString()}
              </button>
            ))}
          </div>
        )}
      </div>
      {potentialProfit > 0 && !disabled && (
        <div className="flex items-center justify-end gap-2 text-green-700">
          <TrendingUp size={14} />
          <span className="text-xs font-semibold">
            Potential Profit: +{potentialProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>
      )}
      {isBoosterArmed && (
        <button
          onClick={onApplyBooster}
          className="w-full flex items-center justify-center gap-2 text-sm p-2 bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200 font-semibold mt-2"
        >
          <Zap size={14} /> Apply Booster to this Match
        </button>
      )}
    </div>
  );
};
