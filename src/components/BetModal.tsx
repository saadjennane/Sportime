import React, { useState, useEffect } from 'react';
import { X, Coins, TrendingUp } from 'lucide-react';
import { Match, Bet } from '../types';

interface BetModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: Match;
  prediction: 'teamA' | 'draw' | 'teamB';
  odds: number;
  balance: number;
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
        setSelectedOdds(userBet.odds);
        setAmount(userBet.amount.toString());
      } else {
        setSelectedPrediction(prediction);
        setSelectedOdds(odds);
        setAmount('');
      }
    }
  }, [isOpen, prediction, odds, userBet]);

  if (!isOpen) return null;

  const numAmount = parseInt(amount) || 0;
  const potentialWin = numAmount * selectedOdds;
  const isConfirmDisabled = numAmount <= 0 || numAmount > balance;

  const handleConfirm = () => {
    if (!isConfirmDisabled) {
      onConfirm(numAmount, selectedPrediction, selectedOdds);
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
  }

  const quickAmounts = [100, 500, 1000, 2500];

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

  const handlePredictionChange = (newPrediction: 'teamA' | 'draw' | 'teamB', newOdds: number) => {
    setSelectedPrediction(newPrediction);
    setSelectedOdds(newOdds);
  };

  const PredictionOption: React.FC<{
    label: string;
    team?: Match['teamA'];
    currentOdds: number;
    predictionKey: 'teamA' | 'draw' | 'teamB';
  }> = ({ label, team, currentOdds, predictionKey }) => {
    const isActive = selectedPrediction === predictionKey;
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
        onClick={() => handlePredictionChange(predictionKey, currentOdds)}
        className={`flex-1 flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all duration-200 ${
          isActive
            ? 'bg-electric-blue/10 border-electric-blue shadow-inner'
            : 'bg-deep-navy border-disabled hover:border-electric-blue/50'
        }`}
      >
        {icon}
        <span className="text-xs font-bold text-text-primary">{label}</span>
        <span className="text-sm font-semibold text-electric-blue">@{currentOdds.toFixed(2)}</span>
      </button>
    );
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
            />
            <PredictionOption
              label="Draw"
              team={undefined}
              currentOdds={match.odds.draw}
              predictionKey="draw"
            />
            <PredictionOption
              label={match.teamB.name.split(' ')[0]}
              team={match.teamB}
              currentOdds={match.odds.teamB}
              predictionKey="teamB"
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
              max={balance}
            />
          </div>
          <div className="flex gap-2 mt-2">
            {quickAmounts.map((quickAmount) => (
              <button
                key={quickAmount}
                onClick={() => setAmount(quickAmount.toString())}
                className="flex-1 py-2 px-2 bg-deep-navy hover:bg-electric-blue/20 rounded-lg text-sm font-semibold text-text-secondary hover:text-electric-blue transition-colors"
              >
                {formatQuickAmount(quickAmount)}
              </button>
            ))}
          </div>
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
