import React from "react";
import { BoosterSelection } from "../types";
import { XCircle } from "lucide-react";

interface BoosterSelectorProps {
  day: number;
  activeBooster?: BoosterSelection;
  armingBoosterType?: "x2" | "x3";
  onBoosterClick: (type: "x2" | "x3") => void;
  onCancel: () => void;
}

interface BoosterButtonProps {
  type: "x2" | "x3";
  onClick: (type: "x2" | "x3") => void;
  onCancel: () => void;
  activeBooster?: BoosterSelection;
  armingBoosterType?: "x2" | "x3";
}

const BoosterButton: React.FC<BoosterButtonProps> = ({
  type,
  onClick,
  onCancel,
  activeBooster,
  armingBoosterType,
}) => {
  const boosterUsed = !!activeBooster;
  const isArmed = armingBoosterType === type;
  const isDisabled = boosterUsed && activeBooster.type !== type;
  const isApplied = activeBooster?.type === type;

  const baseClasses =
    "w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg border-2 transition-all duration-200";
  const colorClasses = {
    x2: {
      base: "bg-blue-100 text-blue-600 border-blue-300",
      armed: "ring-4 ring-blue-300 shadow-lg",
      disabled: "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed",
      applied: "bg-blue-500 text-white border-blue-600 shadow-md",
    },
    x3: {
      base: "bg-red-100 text-red-600 border-red-300",
      armed: "ring-4 ring-red-300 shadow-lg",
      disabled: "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed",
      applied: "bg-red-500 text-white border-red-600 shadow-md",
    },
  };

  let buttonClass = `${baseClasses} ${colorClasses[type].base}`;
  if (isDisabled) buttonClass = `${baseClasses} ${colorClasses[type].disabled}`;
  if (isArmed) buttonClass += ` ${colorClasses[type].armed}`;
  if (isApplied) buttonClass = `${baseClasses} ${colorClasses[type].applied}`;

  return (
    <div className="relative w-10 h-10">
      <button
        onClick={() => onClick(type)}
        disabled={isDisabled || isApplied}
        className={buttonClass}
      >
        {type}
      </button>
      {isApplied && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}
          aria-label={`Cancel ${type} booster`}
          className="absolute -top-1 -right-1 bg-white rounded-full text-gray-500 hover:text-red-500 z-10 flex items-center justify-center"
        >
          <XCircle size={16} />
        </button>
      )}
    </div>
  );
};

export const BoosterSelector: React.FC<BoosterSelectorProps> = ({
  day,
  activeBooster,
  armingBoosterType,
  onBoosterClick,
  onCancel,
}) => {
  return (
    <div className="flex items-center justify-center gap-3">
      <BoosterButton
        type="x2"
        onClick={onBoosterClick}
        onCancel={onCancel}
        activeBooster={activeBooster}
        armingBoosterType={armingBoosterType}
      />
      <BoosterButton
        type="x3"
        onClick={onBoosterClick}
        onCancel={onCancel}
        activeBooster={activeBooster}
        armingBoosterType={armingBoosterType}
      />
    </div>
  );
};
