import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

const DIFF_LABELS = ['Exact (0)', 'Off by 1', 'Off by 2', 'Off by 3', 'Off by 4', 'Off by 5+'];

export function LivePredictionScoring() {
  const [cfg, setCfg] = useState<any>(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { supabase.from('live_pred_config').select('*').eq('id', 1).single().then(({ data }) => setCfg(data)); }, []);
  if (!cfg) return null;

  const diff = (cfg.diff_points as number[]) ?? [];
  const bonus = (cfg.bonus_points as number[]) ?? [];
  const setDiff = (i: number, v: number) => { const a = [...diff]; a[i] = v; setCfg({ ...cfg, diff_points: a }); };
  const setBonus = (i: number, v: number) => { const a = [...bonus]; a[i] = v; setCfg({ ...cfg, bonus_points: a }); };
  const maxTotal = Math.max(...diff, 0) + cfg.result_points + bonus.reduce((a, b) => a + b, 0);

  const save = async () => {
    const { error } = await supabase.from('live_pred_config').update({
      diff_points: diff, result_points: +cfg.result_points, halftime_malus_pct: +cfg.halftime_malus_pct,
      bonus_count: +cfg.bonus_count, bonus_points: bonus, updated_at: new Date().toISOString(),
    }).eq('id', 1);
    setMsg(error ? error.message : 'Scoring saved'); setTimeout(() => setMsg(''), 4000);
  };

  return (
    <div className="bg-surface border border-border-subtle rounded-xl p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-text-primary">Scoring format</h3>
          <p className="text-text-secondary text-xs">Max points per entry: <b className="text-lime-glow">{maxTotal}</b></p>
        </div>
        <button onClick={save} className="bg-lime-glow text-deep-navy font-bold px-5 py-2 rounded-lg">Save</button>
      </div>
      {msg && <div className="bg-electric-blue/10 border border-electric-blue/30 text-electric-blue rounded-lg px-3 py-2 text-sm">{msg}</div>}

      <div>
        <p className="text-xs font-bold text-text-secondary uppercase tracking-wide mb-2">Goal‑difference accuracy</p>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {DIFF_LABELS.map((label, i) => (
            <label key={i} className="block"><span className="text-xs text-text-secondary">{label}</span>
              <input type="number" value={diff[i] ?? 0} onChange={e => setDiff(i, +e.target.value)} className="inp mt-1" /></label>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <label className="block"><span className="text-xs text-text-secondary">Correct result (1X2) points</span>
          <input type="number" value={cfg.result_points} onChange={e => setCfg({ ...cfg, result_points: e.target.value })} className="inp mt-1" /></label>
        <label className="block"><span className="text-xs text-text-secondary">Half‑time edit malus (%)</span>
          <input type="number" value={cfg.halftime_malus_pct} onChange={e => setCfg({ ...cfg, halftime_malus_pct: e.target.value })} className="inp mt-1" /></label>
        <label className="block"><span className="text-xs text-text-secondary">Bonus questions count</span>
          <input type="number" value={cfg.bonus_count} onChange={e => setCfg({ ...cfg, bonus_count: e.target.value })} className="inp mt-1" /></label>
      </div>

      <div>
        <p className="text-xs font-bold text-text-secondary uppercase tracking-wide mb-2">Bonus question points</p>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {bonus.map((v, i) => (
            <label key={i} className="block"><span className="text-xs text-text-secondary">Bonus {i + 1}</span>
              <input type="number" value={v} onChange={e => setBonus(i, +e.target.value)} className="inp mt-1" /></label>
          ))}
        </div>
        <p className="text-text-disabled text-[11px] mt-2">Malus reduces (goal‑diff + result) only; bonus points are unaffected.</p>
      </div>
    </div>
  );
}
