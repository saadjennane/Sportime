import React from "react";
import { X, Info } from "lucide-react";

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 space-y-5 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="flex items-center gap-3">
          <div className="bg-purple-100 p-2 rounded-full">
            <Info className="w-6 h-6 text-purple-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Challenge Rules</h2>
        </div>

        <div className="space-y-4 text-gray-600 text-sm">
          <p>
            <strong>1. Join the Challenge:</strong> Pay the entry cost to
            receive your starting challenge balance.
          </p>
          <p>
            <strong>2. Place Your Bets:</strong> You must allocate your entire
            challenge balance across the available matches before the first
            match begins.
          </p>
          <p>
            <strong>3. Bets are Locked:</strong> Once the challenge status
            becomes 'Ongoing', you cannot change your bets.
          </p>
          <p>
            <strong>4. Calculate Winnings:</strong> As matches finish, your
            winnings are calculated based on your predictions and the odds.
          </p>
          <p>
            <strong>5. The Winner:</strong> The player with the highest final
            coin balance at the end of the challenge wins the top spot on the
            leaderboard!
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 mt-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition-colors"
        >
          Got it!
        </button>
      </div>
    </div>
  );
};
