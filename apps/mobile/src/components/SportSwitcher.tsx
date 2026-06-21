import React from 'react';
import { useSport, type Sport } from '../contexts/SportContext';

const SPORTS: { key: Sport; label: string; emoji: string }[] = [
  { key: 'football', label: 'Football', emoji: '⚽' },
  { key: 'f1', label: 'F1', emoji: '🏎️' },
];

/** Global universe selector (Football / F1) shown under the header. */
export const SportSwitcher: React.FC = () => {
  const { sport, setSport } = useSport();
  return (
    <div className="flex bg-navy-accent rounded-xl p-1 gap-1">
      {SPORTS.map((s) => (
        <button
          key={s.key}
          onClick={() => setSport(s.key)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
            sport === s.key ? 'bg-electric-blue text-white shadow' : 'text-text-secondary'
          }`}
        >
          <span>{s.emoji}</span>
          {s.label}
        </button>
      ))}
    </div>
  );
};

export default SportSwitcher;
