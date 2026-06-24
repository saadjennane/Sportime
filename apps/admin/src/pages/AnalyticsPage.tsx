import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { LogoSpinner } from '../components/ui/LogoSpinner';

// Server-truth analytics (Supabase RPCs). Behavioural funnels/retention live in PostHog.
const PERIODS = [7, 30, 90] as const;

export function AnalyticsPage() {
  const [days, setDays] = useState<number>(30);
  const [ns, setNs] = useState<any>(null);
  const [funnel, setFunnel] = useState<any>(null);
  const [economy, setEconomy] = useState<any>(null);
  const [premium, setPremium] = useState<any>(null);
  const [notifPerf, setNotifPerf] = useState<any[]>([]);
  const [lift, setLift] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    if (!supabase) return;
    setLoading(true); setErr(null);
    try {
      const [a, b, c, d, e, f] = await Promise.all([
        supabase.rpc('get_north_star'),
        supabase.rpc('get_activation_funnel'),
        supabase.rpc('get_coin_economy', { p_days: days }),
        supabase.rpc('get_premium_funnel', { p_days: days }),
        supabase.rpc('get_notif_performance', { p_days: days }),
        supabase.rpc('get_notif_holdout_lift', { p_days: days }),
      ]);
      const firstErr = [a, b, c, d, e, f].find(r => r.error)?.error;
      if (firstErr) throw firstErr;
      setNs(a.data); setFunnel(b.data); setEconomy(c.data); setPremium(d.data);
      setNotifPerf((e.data as any[]) ?? []); setLift(f.data);
    } catch (x: any) { setErr(x?.message ?? 'Failed to load'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [days]);

  const liftDelta = lift && lift.treated_active_pct != null && lift.holdout_active_pct != null
    ? (Number(lift.treated_active_pct) - Number(lift.holdout_active_pct)).toFixed(1) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-text-primary mb-1">Analytics</h1>
          <p className="text-text-secondary">Server-truth metrics (Supabase). Behavioural funnels & retention live in <span className="text-electric-blue">PostHog</span>.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-surface border border-border-subtle rounded-lg p-1">
            {PERIODS.map(p => (
              <button key={p} onClick={() => setDays(p)}
                className={`px-3 py-1.5 text-sm font-semibold rounded-md ${days === p ? 'bg-electric-blue text-white' : 'text-text-secondary'}`}>
                {p}d
              </button>
            ))}
          </div>
          <button onClick={load} className="px-3 py-2 text-sm font-semibold rounded-lg bg-surface border border-border-subtle text-text-secondary hover:text-text-primary">↻</button>
        </div>
      </div>

      {err && <div className="bg-hot-red/10 border border-hot-red/30 text-hot-red rounded-lg px-4 py-2 text-sm">{err}</div>}
      {loading && !ns && <LogoSpinner label="Loading analytics…" />}

      {/* North-Star */}
      <Section title="North-Star">
        <Grid>
          <Stat label="DAU" value={ns?.dau} />
          <Stat label="WAU" value={ns?.wau} />
          <Stat label="MAU" value={ns?.mau} />
          <Stat label="Users (registered)" value={ns?.registered_users} />
          <Stat label="Guests" value={ns?.guests} />
          <Stat label="Activated" value={ns?.activated_users} sub={ns?.activation_rate_pct != null ? `${ns.activation_rate_pct}%` : undefined} />
          <Stat label="Premium" value={ns?.premium_users} />
        </Grid>
        {ns?.lifecycle && (
          <div className="flex flex-wrap gap-2 mt-1">
            {Object.entries(ns.lifecycle).map(([k, v]) => (
              <span key={k} className="text-xs px-2 py-1 rounded-full bg-surface border border-border-subtle text-text-secondary">{k}: <b className="text-text-primary">{v as any}</b></span>
            ))}
          </div>
        )}
      </Section>

      {/* Activation funnel */}
      <Section title="Activation funnel">
        <Grid>
          <Stat label="Signups" value={funnel?.signups} />
          <Stat label="Activated (1st pick)" value={funnel?.activated} sub={funnel?.activation_rate_pct != null ? `${funnel.activation_rate_pct}%` : undefined} />
          <Stat label="Joined a game" value={funnel?.joined_a_game} />
          <Stat label="In a squad" value={funnel?.in_squad} />
          <Stat label="Median days to 1st pick" value={funnel?.median_activation_offset_days} />
        </Grid>
      </Section>

      {/* Coin economy */}
      <Section title={`Coin economy · ${days}d`}>
        <Grid>
          <Stat label="Issued" value={economy?.issued} />
          <Stat label="Spent" value={economy?.spent} />
          <Stat label="Net issuance" value={economy?.net_issuance} tone={Number(economy?.net_issuance) > 0 ? 'warn' : 'ok'} />
          <Stat label="Sink : source" value={economy?.sink_source_ratio} tone={Number(economy?.sink_source_ratio) >= 1 ? 'ok' : 'warn'} />
          <Stat label="Median balance" value={economy?.median_balance} />
        </Grid>
        <div className="grid md:grid-cols-2 gap-3 mt-1">
          <BreakdownCard title="Sources (earned)" obj={economy?.by_source} />
          <BreakdownCard title="Sinks (spent)" obj={economy?.by_sink} />
        </div>
      </Section>

      {/* Premium */}
      <Section title={`Sportime+ · ${days}d`}>
        <Grid>
          <Stat label="Premium users" value={premium?.premium_users} />
          <Stat label="New purchases" value={premium?.new_purchases} />
          <Stat label="Renewals" value={premium?.renewals} />
          <Stat label="Cancellations" value={premium?.cancellations} tone="warn" />
          <Stat label="Payment fails" value={premium?.payment_failures} tone="warn" />
          <Stat label="Conversion" value={premium?.conversion_pct != null ? `${premium.conversion_pct}%` : undefined} />
        </Grid>
        <p className="text-xs text-text-secondary mt-1">Top-of-funnel (paywall views → CTA) lives in PostHog.</p>
      </Section>

      {/* Notifications */}
      <Section title={`Notifications · ${days}d`}>
        {lift && (
          <Grid>
            <Stat label="Treated active %" value={lift.treated_active_pct != null ? `${lift.treated_active_pct}%` : undefined} sub={`n=${lift.treated_n ?? 0}`} />
            <Stat label="Holdout active %" value={lift.holdout_active_pct != null ? `${lift.holdout_active_pct}%` : undefined} sub={`n=${lift.holdout_n ?? 0}`} />
            <Stat label="Lift (pp)" value={liftDelta != null ? `${Number(liftDelta) >= 0 ? '+' : ''}${liftDelta}` : undefined} tone={liftDelta != null && Number(liftDelta) >= 0 ? 'ok' : 'warn'} />
          </Grid>
        )}
        <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden mt-1">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-text-secondary border-b border-border-subtle">
              <th className="px-4 py-2">Notif</th><th className="px-4 py-2">Category</th>
              <th className="px-4 py-2 text-right">Sent</th><th className="px-4 py-2 text-right">Opened</th>
              <th className="px-4 py-2 text-right">Open rate</th><th className="px-4 py-2 text-right">Capped</th>
            </tr></thead>
            <tbody>
              {notifPerf.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-4 text-center text-text-secondary">No sends in this window.</td></tr>
              ) : notifPerf.map((r, i) => (
                <tr key={i} className="border-b border-border-subtle/50">
                  <td className="px-4 py-2 font-semibold text-text-primary">{r.notif_key}</td>
                  <td className="px-4 py-2 text-text-secondary">{r.category}</td>
                  <td className="px-4 py-2 text-right">{r.sent}</td>
                  <td className="px-4 py-2 text-right">{r.opened}</td>
                  <td className="px-4 py-2 text-right font-semibold text-electric-blue">{r.open_rate_pct != null ? `${r.open_rate_pct}%` : '—'}</td>
                  <td className="px-4 py-2 text-right text-text-secondary">{r.capped}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

const fmt = (v: any) => v == null ? '—' : (typeof v === 'number' ? v.toLocaleString() : String(v));

function Stat({ label, value, sub, tone }: { label: string; value: any; sub?: string; tone?: 'ok' | 'warn' }) {
  const color = tone === 'ok' ? 'text-lime-glow' : tone === 'warn' ? 'text-warm-yellow' : 'text-text-primary';
  return (
    <div className="bg-surface border border-border-subtle rounded-xl p-4">
      <p className="text-[11px] uppercase tracking-wide text-text-secondary font-semibold">{label}</p>
      <p className={`text-2xl font-bold ${color} mt-1`}>{fmt(value)}</p>
      {sub && <p className="text-xs text-text-secondary mt-0.5">{sub}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-text-primary">{title}</h2>
      {children}
    </div>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">{children}</div>;
}
function BreakdownCard({ title, obj }: { title: string; obj?: Record<string, number> | null }) {
  const rows = obj ? Object.entries(obj).sort((a, b) => Math.abs(Number(b[1])) - Math.abs(Number(a[1]))) : [];
  return (
    <div className="bg-surface border border-border-subtle rounded-xl p-4">
      <p className="text-[11px] uppercase tracking-wide text-text-secondary font-semibold mb-2">{title}</p>
      {rows.length === 0 ? <p className="text-sm text-text-secondary">No data</p> : (
        <div className="space-y-1">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between text-sm">
              <span className="text-text-secondary">{k}</span>
              <span className="font-semibold text-text-primary tabular-nums">{Number(v).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
