import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { LogOut, ShieldAlert, Loader2 } from 'lucide-react';

/**
 * Gates the whole admin panel behind a Supabase email/password login and an
 * admin role check (is_admin / user_type admin). Dark theme to match the admin.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any>(undefined); // undefined = loading
  const [role, setRole] = useState<string | null | undefined>(undefined);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) { setRole(undefined); return; }
    setRole(undefined);
    supabase.from('users').select('is_admin, is_super_admin, role, user_type').eq('id', session.user.id).single()
      .then(({ data }) => {
        const isAdmin = !!data?.is_admin || !!data?.is_super_admin
          || data?.role === 'admin' || data?.role === 'super_admin'
          || data?.user_type === 'admin' || data?.user_type === 'super_admin';
        setRole(isAdmin ? 'admin' : 'user');
      });
  }, [session]);

  const login = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
    if (error) setErr(error.message);
    setBusy(false);
  };
  const logout = () => supabase.auth.signOut();

  // Loading
  if (session === undefined || (session?.user && role === undefined)) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-gray-400"><Loader2 className="animate-spin" /></div>;
  }

  // Not logged in -> login form
  if (!session?.user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] p-4">
        <form onSubmit={login} className="bg-[#161616] rounded-2xl shadow-2xl border border-white/10 p-8 w-full max-w-sm space-y-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">Sportime Admin</h1>
            <p className="text-gray-400 text-sm mt-1">Sign in to continue</p>
          </div>
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Email"
            className="w-full bg-[#0a0a0a] border border-white/10 text-white placeholder-gray-500 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#2979FF]" />
          <input type="password" required value={pw} onChange={e => setPw(e.target.value)} placeholder="Password"
            className="w-full bg-[#0a0a0a] border border-white/10 text-white placeholder-gray-500 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#2979FF]" />
          {err && <p className="text-sm text-[#FF1744]">{err}</p>}
          <button disabled={busy} type="submit" className="w-full bg-[#2979FF] text-white font-semibold py-2.5 rounded-lg hover:brightness-110 disabled:opacity-60">
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    );
  }

  // Logged in but not an admin
  if (role !== 'admin') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a] text-center p-4">
        <ShieldAlert className="text-[#FF1744] mb-3" size={40} />
        <h1 className="text-xl font-bold text-white">Not authorized</h1>
        <p className="text-gray-400 text-sm mt-1">This account ({session.user.email}) is not an admin.</p>
        <button onClick={logout} className="mt-4 flex items-center gap-2 text-[#2979FF] font-semibold"><LogOut size={16} /> Sign out</button>
      </div>
    );
  }

  // Authorized — sign out now lives in the Layout top bar.
  return <>{children}</>;
}
