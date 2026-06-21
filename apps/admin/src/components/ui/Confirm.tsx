import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

// Imperative confirm — `if (!(await confirmDialog('Delete?'))) return;`
interface ConfirmReq { id: number; message: string; title?: string; confirmText?: string; danger: boolean; resolve: (v: boolean) => void; }
let _id = 0;
let _dispatch: ((r: ConfirmReq) => void) | null = null;

export function confirmDialog(message: string, opts?: { title?: string; confirmText?: string; danger?: boolean }): Promise<boolean> {
  return new Promise((resolve) => {
    if (!_dispatch) { resolve(window.confirm(message)); return; } // SSR / not mounted fallback
    _dispatch({ id: ++_id, message, title: opts?.title, confirmText: opts?.confirmText, danger: opts?.danger ?? true, resolve });
  });
}

/** Mount once near the app root. */
export function ConfirmHost() {
  const [req, setReq] = useState<ConfirmReq | null>(null);
  useEffect(() => { _dispatch = (r) => setReq(r); return () => { _dispatch = null; }; }, []);
  if (!req) return null;
  const close = (v: boolean) => { req.resolve(v); setReq(null); };
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4" onClick={() => close(false)}>
      <div className="bg-surface border border-border-subtle rounded-2xl shadow-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          {req.danger && <AlertTriangle className="w-6 h-6 text-hot-red shrink-0 mt-0.5" />}
          <div className="min-w-0">
            {req.title && <h2 className="text-lg font-bold mb-1">{req.title}</h2>}
            <p className="text-text-secondary text-sm whitespace-pre-line break-words">{req.message}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => close(false)} className="px-4 py-2 rounded-lg bg-background-dark border border-border-subtle text-sm font-semibold hover:bg-surface-hover">Cancel</button>
          <button onClick={() => close(true)} className={`px-4 py-2 rounded-lg text-sm font-semibold text-white ${req.danger ? 'bg-hot-red hover:bg-hot-red/80' : 'bg-electric-blue hover:bg-electric-blue/80'}`}>{req.confirmText ?? 'Confirm'}</button>
        </div>
      </div>
    </div>
  );
}
