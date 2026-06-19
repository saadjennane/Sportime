import React from 'react';
import { X, Lock } from 'lucide-react';
import type { BoosterUse } from '../../services/swipeGameService';

type BoosterType = 'x2' | 'x3';
export interface GameBoosters { x2: BoosterUse | null; x3: BoosterUse | null; }

interface SwipeBoosterBarProps {
  gameBoosters: GameBoosters;
  currentMatchdayId: string | null;
  armed: BoosterType | null;
  onArm: (type: BoosterType | null) => void;
  onCancel: (fixtureId: string) => void;
  /** Hint shown while a booster is armed (deck vs recap have different gestures). */
  armHint?: string;
}

const STYLE: Record<BoosterType, { ring: string; text: string; bg: string }> = {
  x2: { ring: 'border-electric-blue', text: 'text-electric-blue', bg: 'bg-electric-blue' },
  x3: { ring: 'border-hot-red', text: 'text-hot-red', bg: 'bg-hot-red' },
};

const Chip: React.FC<{
  type: BoosterType;
  use: BoosterUse | null;
  currentMatchdayId: string | null;
  armed: boolean;
  onArm: () => void;
  onCancel: (fixtureId: string) => void;
}> = ({ type, use, currentMatchdayId, armed, onArm, onCancel }) => {
  const s = STYLE[type];
  const appliedHere = !!use && use.matchday_id === currentMatchdayId;
  const usedElsewhere = !!use && use.matchday_id !== currentMatchdayId;

  if (appliedHere) {
    return (
      <div className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 ${s.ring} ${s.bg}/15`}>
        <span className={`font-bold ${s.text}`}>{type}</span>
        <span className="text-xs text-text-secondary">applied</span>
        <button onClick={() => use && onCancel(use.fixture_id)} aria-label="Cancel booster"
          className="ml-1 text-text-secondary hover:text-hot-red"><X size={15} /></button>
      </div>
    );
  }
  if (usedElsewhere) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-white/5 bg-deep-navy/40 opacity-60">
        <Lock size={13} className="text-text-disabled" />
        <span className="font-bold text-text-disabled">{type}</span>
        <span className="text-[11px] text-text-disabled">used</span>
      </div>
    );
  }
  return (
    <button onClick={onArm}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 transition-all ${
        armed ? `${s.ring} ${s.bg}/20 ring-2 ${s.ring}` : `${s.ring}/40 bg-deep-navy hover:${s.bg}/10`}`}>
      <span className={`font-bold ${s.text}`}>{type}</span>
      <span className="text-xs text-text-secondary">{armed ? 'arming…' : 'boost'}</span>
    </button>
  );
};

export const SwipeBoosterBar: React.FC<SwipeBoosterBarProps> = ({ gameBoosters, currentMatchdayId, armed, onArm, onCancel, armHint }) => {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center justify-center gap-3">
        <span className="text-xs font-semibold text-text-disabled uppercase tracking-wide">Boosters</span>
        <Chip type="x2" use={gameBoosters.x2} currentMatchdayId={currentMatchdayId} armed={armed === 'x2'}
          onArm={() => onArm(armed === 'x2' ? null : 'x2')} onCancel={onCancel} />
        <Chip type="x3" use={gameBoosters.x3} currentMatchdayId={currentMatchdayId} armed={armed === 'x3'}
          onArm={() => onArm(armed === 'x3' ? null : 'x3')} onCancel={onCancel} />
      </div>
      {armed && armHint && (
        <p className="text-xs font-semibold text-warm-yellow text-center">{armHint}</p>
      )}
    </div>
  );
};

export default SwipeBoosterBar;
