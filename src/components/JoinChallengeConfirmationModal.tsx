import React from "react";
import { X, Coins, ShieldAlert, CheckCircle } from "lucide-react";
import { Challenge } from "../types";

interface JoinChallengeConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  challenge: Challenge;
  userBalance: number;
}

export const JoinChallengeConfirmationModal: React.FC<
  JoinChallengeConfirmationModalProps
> = ({ isOpen, onClose, onConfirm, challenge, userBalance }) => {
  if (!isOpen) return null;

  const hasSufficientFunds = userBalance >= challenge.entryCost;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 space-y-5 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-2xl font-bold text-center text-gray-900">
          Join Challenge
        </h2>

        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center space-y-2">
          <p className="text-lg font-bold text-purple-700">{challenge.name}</p>
          <div>
            <p className="text-sm text-slate-500">Entry Cost</p>
            <div className="flex items-center justify-center gap-2">
              <Coins className="w-6 h-6 text-amber-500" />
              <p className="text-3xl font-bold text-slate-800">
                {challenge.entryCost.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {hasSufficientFunds ? (
          <div className="bg-green-50 border border-green-200 text-green-800 p-3 rounded-xl flex items-center gap-3">
            <CheckCircle size={20} />
            <p className="text-sm font-medium">
              You have enough coins to join. This amount will be deducted from
              your balance.
            </p>
          </div>
        ) : (
          <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-xl flex items-center gap-3">
            <ShieldAlert size={20} />
            <p className="text-sm font-medium">
              You do not have enough coins to join this challenge.
            </p>
          </div>
        )}

        <div className="space-y-3 pt-2">
          <button
            onClick={onConfirm}
            disabled={!hasSufficientFunds}
            className="w-full py-3.5 px-6 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all shadow-lg shadow-purple-500/30"
          >
            {hasSufficientFunds ? "Confirm & Join" : "Insufficient Funds"}
          </button>
          <button
            onClick={onClose}
            className="w-full py-3 px-6 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-slate-700 transition-colors"
          >
            Cancel
          </button>
          <div className="text-center">
            <span className="text-sm text-gray-500">
              Your Balance:{" "}
              <span className="font-semibold">
                {userBalance.toLocaleString()} coins
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
