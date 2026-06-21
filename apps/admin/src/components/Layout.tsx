import { ReactNode, useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { supabase } from '../services/supabase';

interface LayoutProps {
  children: ReactNode;
}

function TopBar() {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 px-6 py-2.5 bg-surface border-b border-border-subtle">
      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-hot-red/15 text-hot-red tracking-wide">PRODUCTION</span>
      <div className="flex items-center gap-4 text-sm">
        {email && <span className="text-text-secondary hidden sm:inline truncate max-w-[220px]">{email}</span>}
        <button onClick={() => supabase.auth.signOut()} className="flex items-center gap-1.5 text-text-secondary hover:text-text-primary font-medium">
          <LogOut size={15} /> Sign out
        </button>
      </div>
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
