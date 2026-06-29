import React from 'react';
import { X } from 'lucide-react';

/** Shared bottom-sheet used by the F1 games for Rules / Rewards / Leaderboard. */
export const F1Sheet: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60" onClick={onClose}>
    <div className="w-full max-w-md bg-deep-navy rounded-t-2xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="font-bold text-text-primary">{title}</div>
        <button onClick={onClose} className="p-1 text-text-secondary"><X size={20} /></button>
      </div>
      <div className="overflow-y-auto p-4">{children}</div>
    </div>
  </div>
);

export default F1Sheet;
