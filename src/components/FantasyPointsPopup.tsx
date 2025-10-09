import React from "react";
import { FantasyPlayer } from "../types";
import { X } from "lucide-react";

interface FantasyPointsPopupProps {
  player: FantasyPlayer;
  onClose: () => void;
}

export const FantasyPointsPopup: React.FC<FantasyPointsPopupProps> = ({
  player,
  onClose,
}) => {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-xs w-full p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <img
              src={player.photo}
              alt={player.name}
              className="w-12 h-12 rounded-full object-cover"
            />
            <div>
              <p className="font-bold">{player.name}</p>
              <p className="text-sm text-purple-700 font-bold">
                {player.livePoints ?? 0} points
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:bg-gray-100 rounded-full -mt-2 -mr-2"
          >
            <X size={20} />
          </button>
        </div>
        <div className="bg-gray-50 p-3 rounded-lg space-y-2">
          <h4 className="text-xs font-bold uppercase text-gray-500">
            Points Breakdown
          </h4>
          {player.livePointsBreakdown &&
            Object.entries(player.livePointsBreakdown).map(
              ([action, points]) => (
                <div key={action} className="flex justify-between text-sm">
                  <span className="text-gray-600">{action}</span>
                  <span
                    className={`font-semibold ${points > 0 ? "text-green-600" : "text-red-600"}`}
                  >
                    {points > 0 ? `+${points}` : points}
                  </span>
                </div>
              ),
            )}
        </div>
      </div>
    </div>
  );
};
