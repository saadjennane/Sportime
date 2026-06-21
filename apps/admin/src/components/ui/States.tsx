import { ReactNode } from 'react';
import { Loader2, Inbox, AlertTriangle } from 'lucide-react';

/** Centered spinner for loading sections. */
export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-text-secondary gap-3">
      <Loader2 className="w-7 h-7 animate-spin text-electric-blue" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

/** Friendly empty state. */
export function EmptyState({ title, subtitle, icon, action }: { title: string; subtitle?: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
      <div className="text-text-disabled mb-1">{icon ?? <Inbox className="w-8 h-8" />}</div>
      <div className="font-semibold text-text-primary">{title}</div>
      {subtitle && <div className="text-sm text-text-secondary max-w-md">{subtitle}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/** Error state with optional retry. */
export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      <AlertTriangle className="w-8 h-8 text-hot-red" />
      <div className="text-sm text-text-secondary max-w-md">{message ?? 'Something went wrong.'}</div>
      {onRetry && (
        <button onClick={onRetry} className="px-3 py-1.5 rounded-lg bg-surface border border-border-subtle text-sm font-semibold hover:bg-surface-hover">
          Retry
        </button>
      )}
    </div>
  );
}
