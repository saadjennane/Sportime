import React from 'react';
import { useSport, type Sport } from '../contexts/SportContext';

const SPORTS: { key: Sport; label: string; emoji: string }[] = [
  { key: 'football', label: 'Football', emoji: '⚽' },
  { key: 'f1', label: 'F1', emoji: '🏎️' },
];

interface SportSwitcherProps {
  /** Per-sport count of games awaiting a user action (pick/lineup before deadline). */
  badges?: Partial<Record<Sport, number>>;
}

/** Global universe selector (Football / F1) shown under the header. */
export const SportSwitcher: React.FC<SportSwitcherProps> = ({ badges }) => {
  const { sport, setSport } = useSport();
  return (
    <div className="flex bg-navy-accent rounded-xl p-1 gap-1">
      {SPORTS.map((s) => {
        const count = badges?.[s.key] ?? 0;
        return (
          <button
            key={s.key}
            onClick={() => setSport(s.key)}
            className={`relative flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              sport === s.key ? 'bg-electric-blue text-white shadow' : 'text-text-secondary'
            }`}
          >
            <span>{s.emoji}</span>
            {s.label}
            {count > 0 && (
              <span className="absolute top-0.5 right-1.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-hot-red text-white text-[10px] font-bold leading-none">
                {count > 9 ? '9+' : count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default SportSwitcher;
