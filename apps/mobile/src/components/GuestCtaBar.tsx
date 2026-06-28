import React from 'react';

interface GuestCtaBarProps {
  coins: number;
  tickets: number;
  onCreate: () => void;
}

/** Persistent guest CTA sitting just above the footer nav. Loss-aversion framing
 *  (shows the coins/tickets that aren't saved yet). Only rendered in guest mode. */
export const GuestCtaBar: React.FC<GuestCtaBarProps> = ({ coins, tickets, onCreate }) => {
  const atRisk = [
    `${coins.toLocaleString()} 🪙`,
    tickets > 0 ? `${tickets} 🎟️` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="fixed left-0 right-0 z-40 bottom-[calc(3.625rem+env(safe-area-inset-bottom))] pointer-events-none">
      <div className="w-full max-w-md mx-auto px-3 pb-1.5">
        <button
          onClick={onCreate}
          className="pointer-events-auto w-full flex items-center justify-between gap-2 bg-electric-blue/15 border border-electric-blue/40 backdrop-blur-md rounded-xl px-3 py-2 text-left active:scale-[0.99] transition shadow-lg"
        >
          <div className="min-w-0">
            <div className="text-xs font-bold text-text-primary flex items-center gap-1">👤 Guest mode</div>
            <div className="text-[11px] text-text-secondary truncate">{atRisk} — not saved</div>
          </div>
          <span className="shrink-0 text-xs font-bold bg-electric-blue text-white px-3 py-1.5 rounded-lg">Create account</span>
        </button>
      </div>
    </div>
  );
};

export default GuestCtaBar;
