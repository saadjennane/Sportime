import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';
interface ToastItem { id: number; message: string; type: ToastType; }

// Imperative API — call toast('Saved', 'success') from anywhere, no hook needed.
let _id = 0;
let _dispatch: ((t: ToastItem) => void) | null = null;

export function toast(message: string, type: ToastType = 'info') {
  _dispatch?.({ id: ++_id, message, type });
}

const ICONS = { success: CheckCircle2, error: XCircle, info: Info } as const;
const COLORS = { success: 'text-lime-glow', error: 'text-hot-red', info: 'text-electric-blue' } as const;

/** Mount once near the app root; renders the toast stack and registers the dispatcher. */
export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    _dispatch = (t) => {
      setItems((p) => [...p, t]);
      setTimeout(() => setItems((p) => p.filter((x) => x.id !== t.id)), 4000);
    };
    return () => { _dispatch = null; };
  }, []);
  const remove = (id: number) => setItems((p) => p.filter((x) => x.id !== id));
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-80 max-w-[90vw]">
      {items.map((t) => {
        const Icon = ICONS[t.type];
        return (
          <div key={t.id} className="flex items-start gap-3 bg-surface border border-border-subtle rounded-lg shadow-lg px-4 py-3">
            <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${COLORS[t.type]}`} />
            <span className="text-sm text-text-primary flex-1 break-words">{t.message}</span>
            <button onClick={() => remove(t.id)} className="text-text-secondary hover:text-text-primary shrink-0"><X className="w-4 h-4" /></button>
          </div>
        );
      })}
    </div>
  );
}
