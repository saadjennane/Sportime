import React from "react";
import { X } from "lucide-react";
import { Booster } from "../types";

interface BoosterSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  boosters: Booster[];
  onSelect: (booster: Booster) => void;
}

export const BoosterSelectionModal: React.FC<BoosterSelectionModalProps> = ({
  isOpen,
  onClose,
  boosters,
  onSelect,
}) => {
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

        <div className="flex flex-col items-center gap-2 text-center">
          <h2 className="text-2xl font-bold text-gray-900">Select a Booster</h2>
          <p className="text-sm text-gray-500">
            You can use one booster per GameWeek.
          </p>
        </div>

        <div className="space-y-3">
          {boosters.map((booster) => (
            <div
              key={booster.id}
              className={`p-4 rounded-xl border-2 transition-all ${booster.used ? "bg-gray-100 border-gray-200 opacity-60" : "bg-white border-gray-200"}`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`p-2 rounded-lg ${booster.used ? "bg-gray-200" : "bg-purple-100"}`}
                >
                  {booster.icon}
                </div>
                <div className="flex-1">
                  <h3
                    className={`font-bold ${booster.used ? "text-gray-500" : "text-gray-800"}`}
                  >
                    {booster.name}
                  </h3>
                  <p className="text-xs text-gray-500">{booster.description}</p>
                </div>
                {booster.used ? (
                  <span className="text-xs font-bold text-gray-500 bg-gray-200 px-3 py-1 rounded-full">
                    Used
                  </span>
                ) : (
                  <button
                    onClick={() => {
                      onSelect(booster);
                      onClose();
                    }}
                    className="font-semibold text-sm text-purple-600 bg-purple-100 hover:bg-purple-200 px-4 py-2 rounded-lg"
                  >
                    Select
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
