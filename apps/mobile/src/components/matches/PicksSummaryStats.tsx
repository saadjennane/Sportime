import React from 'react';
import { CheckCircle2, Coins } from 'lucide-react';

// Two-tile summary (Successful Picks + Result) — shared by Finished (Today/Yesterday)
// and the full Pick History (per-day + overall).
export const PicksSummaryStats: React.FC<{ won: number; total: number; settled: number; net: number }> = ({ won, total, settled, net }) => (
  <div className="grid grid-cols-2 gap-2">
    <div className="bg-navy-accent rounded-lg p-2 flex items-center gap-2">
      <CheckCircle2 size={18} className="text-lime-glow flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] text-text-disabled leading-tight">Successful Picks</p>
        <p className="text-sm font-bold text-text-primary">{won}/{total}</p>
      </div>
    </div>
    <div className="bg-navy-accent rounded-lg p-2 flex items-center gap-2">
      <Coins size={18} className="text-warm-yellow flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] text-text-disabled leading-tight">Result</p>
        {settled === 0 ? (
          <p className="text-sm font-bold text-text-disabled">Pending</p>
        ) : (
          <p className={`text-sm font-bold ${net >= 0 ? 'text-lime-glow' : 'text-hot-red'}`}>
            {net >= 0 ? '+' : ''}{net.toLocaleString()}
          </p>
        )}
      </div>
    </div>
  </div>
);

export default PicksSummaryStats;
