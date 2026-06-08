import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { LogOut, ShieldAlert, Loader2 } from 'lucide-react';

/**
 * Gates the whole admin panel behind a Supabase email/password login and an
 * admin role check (users.role IN ('admin','super_admin')).
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
    // is_admin() (used by RLS/RPCs) reads the users.is_admin boolean — match it here.
    supabase.from('users').select('is_admin, role').eq('id', session.user.id).single()
      .then(({ data }) => setRole((data?.is_admin || data?.role === 'admin' || data?.role === 'super_admin') ? 'admin' : 'user'));
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
    return <div className="min-h-screen flex items-center justify-center text-gray-500"><Loader2 className="animate-spin" /></div>;
  }

  // Not logged in -> login form
  if (!session?.user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <form onSubmit={login} className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm space-y-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Sportime Admin</h1>
            <p className="text-gray-500 text-sm mt-1">Sign in to continue</p>
          </div>
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Email"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="password" required value={pw} onChange={e => setPw(e.target.value)} placeholder="Password"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button disabled={busy} type="submit" className="w-full bg-blue-600 text-white font-semibold py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-60">
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    );
  }

  // Logged in but not an admin
  if (role !== 'admin' && role !== 'super_admin') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-center p-4">
        <ShieldAlert className="text-red-500 mb-3" size={40} />
        <h1 className="text-xl font-bold text-gray-900">Not authorized</h1>
        <p className="text-gray-500 text-sm mt-1">This account ({session.user.email}) is not an admin.</p>
        <button onClick={logout} className="mt-4 flex items-center gap-2 text-blue-600 font-semibold"><LogOut size={16} /> Sign out</button>
      </div>
    );
  }

  // Authorized
  return (
    <>
      {children}
      <button onClick={logout} title="Sign out"
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-white border border-gray-200 shadow-lg rounded-full px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
        <LogOut size={16} /> Sign out
      </button>
    </>
  );
}
