import { ReactNode, useEffect, useState } from 'react';
import { LogOut, ChevronDown, KeyRound, User, X } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { supabase } from '../services/supabase';
import { toast } from './ui/Toast';

interface LayoutProps {
  children: ReactNode;
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (pw.length < 6) { toast('Password must be at least 6 characters', 'error'); return; }
    if (pw !== pw2) { toast('Passwords do not match', 'error'); return; }
    setBusy(true);
    const { error } = await supabase!.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) toast(`Could not change password: ${error.message}`, 'error');
    else { toast('Password changed ✓', 'success'); onClose(); }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-surface border border-border-subtle rounded-2xl shadow-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2"><KeyRound className="w-5 h-5 text-electric-blue" /> Change password</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <input type="password" placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)}
            className="w-full bg-background-dark border border-border-subtle rounded-lg px-3 py-2.5 focus:outline-none focus:border-electric-blue" />
          <input type="password" placeholder="Confirm new password" value={pw2} onChange={(e) => setPw2(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            className="w-full bg-background-dark border border-border-subtle rounded-lg px-3 py-2.5 focus:outline-none focus:border-electric-blue" />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-background-dark border border-border-subtle text-sm font-semibold">Cancel</button>
          <button onClick={submit} disabled={busy} className="px-4 py-2 rounded-lg bg-electric-blue text-white text-sm font-semibold disabled:opacity-50">
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TopBar() {
  const [email, setEmail] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    supabase!.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 px-6 py-2.5 bg-surface border-b border-border-subtle">
      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-hot-red/15 text-hot-red tracking-wide">PRODUCTION</span>

      <div className="relative">
        <button onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary px-2 py-1 rounded-lg hover:bg-surface-hover">
          <User size={15} />
          <span className="hidden sm:inline truncate max-w-[200px]">{email ?? 'Account'}</span>
          <ChevronDown size={14} className={`transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 mt-1 z-20 w-52 bg-surface border border-border-subtle rounded-xl shadow-2xl overflow-hidden">
              {email && <div className="px-4 py-2 text-xs text-text-disabled truncate border-b border-border-subtle">{email}</div>}
              <button onClick={() => { setShowPw(true); setMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-text-primary hover:bg-surface-hover">
                <KeyRound size={15} /> Change password
              </button>
              <button onClick={() => supabase!.auth.signOut()}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-hot-red hover:bg-surface-hover">
                <LogOut size={15} /> Sign out
              </button>
            </div>
          </>
        )}
      </div>

      {showPw && <ChangePasswordModal onClose={() => setShowPw(false)} />}
    </header>
  );
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex min-h-screen bg-background-dark">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden flex flex-col min-w-0">
        <TopBar />
        <div className="container mx-auto p-6 lg:p-8 flex-1 w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
