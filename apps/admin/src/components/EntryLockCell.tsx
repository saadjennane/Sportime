import { useState } from 'react';
import { setEntryLock, type EntryLockKind } from '../services/tournamentAdminService';

// ISO → value for <input type="datetime-local"> (local time, no seconds).
export const toLocalInput = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso); if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** Compact entry-lock override editor (popover) for a game row, any game family. */
export function EntryLockCell({ kind, id, value, onSaved }: { kind: EntryLockKind; id: string; value?: string | null; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(toLocalInput(value));
  const save = async (val: string | null) => { await setEntryLock(kind, id, val); setOpen(false); onSaved(); };
  return (
    <span className="relative inline-block align-middle ml-2">
      <button onClick={() => { setV(toLocalInput(value)); setOpen(o => !o); }} className={`text-xs ${value ? 'text-warm-yellow' : 'text-text-disabled'}`} title={value ? `Entry locks ${new Date(value).toLocaleString()}` : 'Set entry lock override'}>🔒</button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 bg-surface border border-border-subtle rounded-lg p-2 w-60 text-left shadow-xl">
          <p className="text-[11px] text-text-secondary mb-1">Entry lock override</p>
          <input type="datetime-local" value={v} onChange={e => setV(e.target.value)} className="inp text-xs w-full" />
          <div className="flex justify-between mt-2">
            <button onClick={() => save(null)} className="text-xs text-hot-red">Clear</button>
            <div className="flex gap-2">
              <button onClick={() => setOpen(false)} className="text-xs text-text-secondary">Cancel</button>
              <button onClick={() => save(v ? new Date(v).toISOString() : null)} className="text-xs text-electric-blue font-semibold">Save</button>
            </div>
          </div>
        </div>
      )}
    </span>
  );
}
