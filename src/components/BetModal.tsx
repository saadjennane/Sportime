import React, { useState, useEffect } from "react";
import { X, Coins, TrendingUp } from "lucide-react";
import { Match, Bet } from "../types";

interface BetModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: Match;
  prediction: "teamA" | "draw" | "teamB";
  odds: number;
  balance: number;
  onConfirm: (
    amount: number,
    prediction: "teamA" | "draw" | "teamB",
    odds: number,
  ) => void;
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
  onCancelBet,
}) => {
  const [amount, setAmount] = useState<string>("");
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
        setAmount("");
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
  };

  const quickAmounts = [100, 500, 1000, 2500];

  const handlePredictionChange = (
    newPrediction: "teamA" | "draw" | "teamB",
    newOdds: number,
  ) => {
    setSelectedPrediction(newPrediction);
    setSelectedOdds(newOdds);
  };

  const PredictionOption: React.FC<{
    label: string;
    emoji: string;
    currentOdds: number;
    predictionKey: "teamA" | "draw" | "teamB";
  }> = ({ label, emoji, currentOdds, predictionKey }) => {
    const isActive = selectedPrediction === predictionKey;
    return (
      <button
        onClick={() => handlePredictionChange(predictionKey, currentOdds)}
        className={`flex-1 flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all duration-200 ${
          isActive
            ? "bg-purple-100 border-purple-500 shadow-inner"
            : "bg-slate-50 border-slate-200 hover:border-purple-300"
        }`}
      >
        <span className="text-2xl mb-1">{emoji}</span>
        <span className="text-xs font-bold text-gray-800">{label}</span>
        <span className="text-sm font-semibold text-purple-600">
          @{currentOdds.toFixed(2)}
        </span>
      </button>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">
            {userBet ? "Modify Bet" : "Place Bet"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
          <div className="flex justify-between items-center text-xs font-semibold text-slate-500 uppercase mb-2">
            <span>Match</span>
            <span>{match.kickoffTime}</span>
          </div>
          <div className="flex items-center justify-center gap-4 text-center">
            <div className="flex-1">
              <div className="text-3xl mb-1">{match.teamA.emoji}</div>
              <div className="text-sm font-bold text-gray-800">
                {match.teamA.name}
              </div>
            </div>
            <div className="text-lg font-bold text-slate-400">vs</div>
            <div className="flex-1">
              <div className="text-3xl mb-1">{match.teamB.emoji}</div>
              <div className="text-sm font-bold text-gray-800">
                {match.teamB.name}
              </div>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">
            Your Prediction
          </label>
          <div className="flex gap-2">
            <PredictionOption
              label={match.teamA.name.split(" ")[0]}
              emoji={match.teamA.emoji}
              currentOdds={match.odds.teamA}
              predictionKey="teamA"
            />
            <PredictionOption
              label="Draw"
              emoji="🤝"
              currentOdds={match.odds.draw}
              predictionKey="draw"
            />
            <PredictionOption
              label={match.teamB.name.split(" ")[0]}
              emoji={match.teamB.emoji}
              currentOdds={match.odds.teamB}
              predictionKey="teamB"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">
            Bet Amount
          </label>
          <div className="relative">
            <Coins className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-amber-500" />
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-lg font-semibold focus:border-purple-500 focus:ring-purple-500 focus:outline-none transition-colors"
              min="0"
              max={balance}
            />
          </div>
          <div className="flex gap-2 mt-2">
            {quickAmounts.map((quickAmount) => (
              <button
                key={quickAmount}
                onClick={() => setAmount(quickAmount.toString())}
                className="flex-1 py-2 px-2 bg-slate-100 hover:bg-purple-100 rounded-lg text-sm font-semibold text-slate-700 hover:text-purple-700 transition-colors"
              >
                {formatQuickAmount(quickAmount)}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-green-800">
                Potential Win
              </span>
            </div>
            <span className="text-xl font-bold text-green-700">
              {potentialWin.toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}
            </span>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          {userBet ? (
            <div className="flex gap-3">
              <button
                onClick={handleCancelBetClick}
                className="flex-1 py-3.5 px-6 bg-red-100 hover:bg-red-200 rounded-xl font-bold text-red-700 transition-colors"
              >
                Cancel Bet
              </button>
              <button
                onClick={handleConfirm}
                disabled={isConfirmDisabled}
                className="flex-1 py-3.5 px-6 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white rounded-xl font-bold transition-all shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40"
              >
                Modify Bet
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3.5 px-6 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={isConfirmDisabled}
                className="flex-1 py-3.5 px-6 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40"
              >
                Confirm Bet
              </button>
            </div>
          )}
          <div className="text-center">
            <span className="text-sm text-gray-500">
              Balance:{" "}
              <span className="font-semibold">
                {balance.toLocaleString()} coins
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
