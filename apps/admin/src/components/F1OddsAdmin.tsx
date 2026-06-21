import { useEffect, useMemo, useState } from 'react';
import { Calculator, Save, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface Gp { id: number; name: string; round: number | null; race_at: string | null; }
interface Market { key: string; label: string; type: string; scope: string; source: string; is_visible: boolean; sort_order: number; }
interface Driver { id: number; last_name: string | null; name: string; number: number | null; image: string | null; constructor_id: number | null; }
interface Constructor { id: number; name: string; logo: string | null; }

type Row = { entityId: number | null; selection: string | null; label: string; sublabel?: string };

export function F1OddsAdmin() {
  const [gps, setGps] = useState<Gp[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [constructors, setConstructors] = useState<Constructor[]>([]);
  const [gpId, setGpId] = useState<number | null>(null);
  const [marketKey, setMarketKey] = useState<string>('winner');
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [scResult, setScResult] = useState<boolean | null>(null);

  // Initial load
  useEffect(() => {
    (async () => {
      const [g, m, d, c] = await Promise.all([
        supabase.from('f1_races').select('id,name,round,race_at').neq('status', 'Cancelled').gt('race_at', new Date().toISOString()).order('race_at').limit(8),
        supabase.from('f1_markets').select('*').eq('is_visible', true).order('sort_order'),
        supabase.from('f1_drivers').select('id,last_name,name,number,image,constructor_id').order('position', { nullsFirst: false }),
        supabase.from('f1_constructors').select('id,name,logo').order('position', { nullsFirst: false }),
      ]);
      setGps((g.data ?? []) as Gp[]);
      setMarkets((m.data ?? []) as Market[]);
      setDrivers((d.data ?? []) as Driver[]);
      setConstructors((c.data ?? []) as Constructor[]);
      if (g.data?.length) setGpId(g.data[0].id);
    })();
  }, []);

  const market = markets.find((m) => m.key === marketKey);
  const teamName = (id: number | null) => constructors.find((c) => c.id === id)?.name ?? '';

  // Build the entity rows for the selected market
  const rows: Row[] = useMemo(() => {
    if (!market) return [];
    if (market.key === 'safety_car') {
      return [
        { entityId: null, selection: 'yes', label: 'Yes — Safety Car' },
        { entityId: null, selection: 'no', label: 'No Safety Car' },
      ];
    }
    if (market.scope === 'constructor') {
      return constructors.map((c) => ({ entityId: c.id, selection: market.type === 'yesno_entity' ? 'yes' : null, label: c.name }));
    }
    // driver scope
    const sel = market.type === 'yesno_entity' ? 'yes' : null;
    return drivers.map((d) => ({ entityId: d.id, selection: sel, label: d.last_name || d.name, sublabel: [d.number ? `#${d.number}` : null, teamName(d.constructor_id)].filter(Boolean).join(' · ') }));
  }, [market, drivers, constructors]);

  const keyOf = (r: Row) => `${r.entityId ?? ''}|${r.selection ?? ''}`;

  // Load existing odds when GP/market changes
  useEffect(() => {
    if (!gpId || !marketKey) return;
    (async () => {
      const { data } = await supabase.from('f1_odds').select('entity_id,selection,odds').eq('race_id', gpId).eq('market_key', marketKey);
      const next: Record<string, string> = {};
      (data ?? []).forEach((o: any) => { next[`${o.entity_id ?? ''}|${o.selection ?? ''}`] = String(o.odds); });
      setInputs(next);
      setMsg(null);
    })();
  }, [gpId, marketKey]);

  // Overround = sum of implied probs (meaningful for mutually-exclusive markets)
  const overround = useMemo(() => {
    if (!market || market.type === 'yesno_entity') return null; // independent yes/no → no single overround
    const vals = rows.map((r) => parseFloat(inputs[keyOf(r)])).filter((v) => v > 0);
    if (!vals.length) return null;
    return vals.reduce((s, v) => s + 1 / v, 0) * 100;
  }, [market, rows, inputs]);

  const overroundColor = overround == null ? '' : overround < 100 ? 'text-hot-red' : overround > 140 ? 'text-warm-yellow' : 'text-lime-glow';
  const enteredCount = rows.filter((r) => parseFloat(inputs[keyOf(r)]) > 0).length;

  const save = async () => {
    if (!gpId) return;
    setSaving(true); setMsg(null);
    const payload = rows
      .map((r) => ({ entity_id: r.entityId, selection: r.selection, odds: inputs[keyOf(r)] }))
      .filter((r) => parseFloat(r.odds) > 0);
    const { data, error } = await supabase.rpc('f1_save_odds', { p_race_id: gpId, p_market_key: marketKey, p_rows: payload });
    setSaving(false);
    setMsg(error ? `Error: ${error.message}` : `Saved ${data} odds ✓`);
  };

  const deriveWinningTeam = async () => {
    if (!gpId) return;
    setSaving(true); setMsg(null);
    const { data, error } = await supabase.rpc('f1_derive_winning_team', { p_race_id: gpId });
    setSaving(false);
    if (error) { setMsg(`Error: ${error.message}`); return; }
    setMsg(`Derived ${data} team odds from Winner ✓`);
    // reload current view
    const { data: od } = await supabase.from('f1_odds').select('entity_id,selection,odds').eq('race_id', gpId).eq('market_key', marketKey);
    const next: Record<string, string> = {};
    (od ?? []).forEach((o: any) => { next[`${o.entity_id ?? ''}|${o.selection ?? ''}`] = String(o.odds); });
    setInputs(next);
  };

  // Safety Car race result (manual — API has no SC data; settles that market)
  useEffect(() => {
    if (!gpId) return;
    supabase.from('f1_races').select('safety_car').eq('id', gpId).maybeSingle().then(({ data }) => setScResult((data as any)?.safety_car ?? null));
  }, [gpId]);
  const setSafetyCar = async (val: boolean | null) => {
    if (!gpId) return;
    const { error } = await supabase.rpc('f1_set_safety_car', { p_race_id: gpId, p_value: val });
    setMsg(error ? `Error: ${error.message}` : val === null ? 'Safety Car result cleared' : `Result set: ${val ? 'Safety Car' : 'No SC'} ✓`);
    if (!error) setScResult(val);
  };

  const isDerived = market?.source === 'derived';

  return (
    <div className="space-y-5">
      {/* GP + market selectors */}
      <div className="flex flex-wrap gap-3">
        <select value={gpId ?? ''} onChange={(e) => setGpId(Number(e.target.value))}
          className="bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm">
          {gps.map((g) => <option key={g.id} value={g.id}>{g.round ? `R${g.round} · ` : ''}{g.name}</option>)}
        </select>
        <select value={marketKey} onChange={(e) => setMarketKey(e.target.value)}
          className="bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm">
          {markets.map((m) => <option key={m.key} value={m.key}>{m.label}{m.source === 'derived' ? ' (auto)' : ''}</option>)}
        </select>
      </div>

      {/* Overround / status bar */}
      <div className="flex items-center justify-between bg-surface border border-border-subtle rounded-lg px-4 py-2">
        <div className="text-sm text-text-secondary">
          {market?.type === 'yesno_entity'
            ? `${enteredCount}/${rows.length} entered · independent yes/no`
            : <>Overround: {overround == null ? '—' : <span className={`font-bold ${overroundColor}`}>{overround.toFixed(1)}%</span>} · {enteredCount}/{rows.length} entered</>}
        </div>
        {overround != null && <Calculator size={15} className="text-text-secondary" />}
      </div>

      {isDerived ? (
        <div className="space-y-3">
          <button onClick={deriveWinningTeam} disabled={saving}
            className="flex items-center gap-2 bg-electric-blue/15 text-electric-blue px-4 py-2 rounded-lg font-semibold hover:bg-electric-blue/25 disabled:opacity-50">
            <Sparkles size={16} /> Derive from Winner odds
          </button>
          <div className="space-y-1.5">
            {rows.map((r) => (
              <div key={keyOf(r)} className="flex items-center justify-between px-3 py-2 bg-surface border border-border-subtle rounded-lg text-sm">
                <span>{r.label}</span>
                <span className="font-mono font-semibold">{inputs[keyOf(r)] ?? '—'}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {rows.map((r) => (
            <div key={keyOf(r)} className="flex items-center gap-3 px-3 py-2 bg-surface border border-border-subtle rounded-lg">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{r.label}</div>
                {r.sublabel && <div className="text-xs text-text-secondary truncate">{r.sublabel}</div>}
              </div>
              <input
                type="number" step="0.01" min="1" inputMode="decimal" placeholder="—"
                value={inputs[keyOf(r)] ?? ''}
                onChange={(e) => setInputs((p) => ({ ...p, [keyOf(r)]: e.target.value }))}
                className="w-20 bg-deep-navy border border-border-subtle rounded-lg px-2 py-1.5 text-sm text-right font-mono"
              />
            </div>
          ))}
        </div>
      )}

      {/* Safety Car: manual race result for settlement */}
      {market?.type === 'yesno_single' && (
        <div className="p-3 bg-surface border border-border-subtle rounded-lg">
          <div className="text-sm font-semibold mb-2">Race result (settles this market)</div>
          <div className="flex gap-2">
            <button onClick={() => setSafetyCar(true)} className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${scResult === true ? 'bg-lime-glow text-deep-navy' : 'bg-deep-navy border border-border-subtle text-text-secondary'}`}>Safety Car</button>
            <button onClick={() => setSafetyCar(false)} className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${scResult === false ? 'bg-lime-glow text-deep-navy' : 'bg-deep-navy border border-border-subtle text-text-secondary'}`}>No SC</button>
            <button onClick={() => setSafetyCar(null)} className="px-3 py-1.5 rounded-lg text-sm text-text-secondary">Clear</button>
          </div>
          <div className="text-xs text-text-secondary mt-2">Set after the race — settlement runs on the next sync.</div>
        </div>
      )}

      {/* Save */}
      {!isDerived && (
        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving || !gpId}
            className="flex items-center gap-2 bg-lime-glow/15 text-lime-glow px-5 py-2.5 rounded-lg font-semibold hover:bg-lime-glow/25 disabled:opacity-50">
            <Save size={16} /> {saving ? 'Saving…' : 'Save odds'}
          </button>
          {msg && <span className="text-sm text-text-secondary">{msg}</span>}
        </div>
      )}
      {isDerived && msg && <span className="text-sm text-text-secondary">{msg}</span>}
    </div>
  );
}
