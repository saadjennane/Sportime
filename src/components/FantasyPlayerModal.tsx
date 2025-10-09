import React from "react";
import { FantasyPlayer, PlayerPosition } from "../types";
import { X, Key, Dices, Star, Shirt } from "lucide-react";

interface FantasyPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  position: PlayerPosition;
  allPlayers: FantasyPlayer[];
  onSelectPlayer: (player: FantasyPlayer) => void;
}

const CategoryIcon: React.FC<{ category: "Star" | "Key" | "Wild" }> = ({
  category,
}) => {
  switch (category) {
    case "Star":
      return <Star size={14} className="text-yellow-400 fill-yellow-400" />;
    case "Key":
      return <Key size={14} className="text-gray-400 -rotate-90" />;
    case "Wild":
      return <Dices size={14} className="text-green-400" />;
    default:
      return null;
  }
};

export const FantasyPlayerModal: React.FC<FantasyPlayerModalProps> = ({
  isOpen,
  onClose,
  position,
  allPlayers,
  onSelectPlayer,
}) => {
  if (!isOpen) return null;

  const availablePlayers = allPlayers.filter((p) => p.position === position);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full h-[80vh] flex flex-col p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Select a {position}</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-full"
          >
            <X size={24} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {availablePlayers.map((player) => (
            <button
              key={player.id}
              onClick={() => {
                onSelectPlayer(player);
                onClose();
              }}
              className="w-full flex items-center gap-3 p-3 bg-gray-50 hover:bg-purple-50 rounded-xl transition-colors text-left"
            >
              <img
                src={player.photo}
                alt={player.name}
                className="w-12 h-12 rounded-full object-cover bg-gray-200"
              />
              <div className="flex-1">
                <p className="font-bold text-sm">{player.name}</p>
                <p className="text-xs text-gray-500">{player.teamName}</p>
              </div>
              <div className="text-center">
                <CategoryIcon category={player.category} />
                <p className="text-xs font-semibold">
                  {player.avgFantasyScore.toFixed(1)}
                </p>
              </div>
              <div className="text-center w-12">
                <p className="text-xs text-gray-500">Fatigue</p>
                <p className="font-bold text-sm">{player.fatigue}%</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
