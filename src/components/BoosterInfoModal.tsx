import React, { useState } from "react";
import { X, Zap } from "lucide-react";

interface BoosterInfoModalProps {
  boosterType: "x2" | "x3";
  isOpen: boolean;
  onClose: () => void;
  onActivate: () => void;
  onSetDontShowAgain: () => void;
}

export const BoosterInfoModal: React.FC<BoosterInfoModalProps> = ({
  boosterType,
  isOpen,
  onClose,
  onActivate,
  onSetDontShowAgain,
}) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  if (!isOpen) return null;

  const details = {
    x2: {
      title: "x2 Profit Booster",
      description: "Doubles the net profit of one winning bet for this day.",
      example:
        "Bet 100 at 2.0 odds → Win 200 → Profit 100 → With x2, you get 200 points!",
      penalty: "There is no penalty if your boosted bet loses.",
      color: "blue",
    },
    x3: {
      title: "x3 High-Risk Booster",
      description: "Triples the net profit of one winning bet for this day.",
      example:
        "Bet 100 at 2.0 odds → Win 200 → Profit 100 → With x3, you get 300 points!",
      penalty:
        "Warning: If your boosted bet loses, you get a -200 point penalty.",
      color: "red",
    },
  };

  const boosterDetails = details[boosterType];

  const colorClasses = {
    blue: {
      bg: "bg-blue-600",
      hoverBg: "hover:bg-blue-700",
      lightBg: "bg-blue-100",
      text: "text-blue-600",
    },
    red: {
      bg: "bg-red-600",
      hoverBg: "hover:bg-red-700",
      lightBg: "bg-red-100",
      text: "text-red-600",
    },
  };

  const currentColors = colorClasses[boosterDetails.color as "blue" | "red"];

  const handleActivate = () => {
    if (dontShowAgain) {
      onSetDontShowAgain();
    }
    onActivate();
  };

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
          <div className={`${currentColors.lightBg} p-3 rounded-full`}>
            <Zap className={`w-6 h-6 ${currentColors.text}`} />
          </div>
          <h2 className={`text-2xl font-bold text-gray-900`}>
            {boosterDetails.title}
          </h2>
        </div>

        <div className="space-y-3 text-gray-600 text-sm">
          <p>{boosterDetails.description}</p>
          <p className="bg-gray-50 p-2 rounded-lg italic">
            E.g., {boosterDetails.example}
          </p>
          <p
            className={`font-semibold ${boosterDetails.color === "red" ? currentColors.text : ""}`}
          >
            {boosterDetails.penalty}
          </p>
        </div>

        <div className="pt-2 space-y-3">
          <div className="flex items-center">
            <input
              id="dont-show-again"
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            <label
              htmlFor="dont-show-again"
              className="ml-2 block text-sm text-gray-700"
            >
              Don't show this again
            </label>
          </div>

          <div className="flex justify-center pt-2">
            <button
              onClick={handleActivate}
              className={`w-full py-3 px-6 ${currentColors.bg} ${currentColors.hoverBg} text-white rounded-xl font-bold transition-all`}
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
