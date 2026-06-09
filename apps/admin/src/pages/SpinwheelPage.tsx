import { useEffect, useState } from 'react';
import { listSpinSegments, updateSpinSegment, createSpinSegment, deleteSpinSegment } from '../services/spinAdminService';

const TIERS = ['free', 'amateur', 'master', 'apex', 'premium'];
const CATEGORIES = ['coins', 'xp', 'ticket', 'spin', 'masterpass', 'premium', 'gift_card', 'none'];
const REWARD_TIERS = ['amateur', 'master', 'apex', 'premium'];
const NEEDS_TIER = ['ticket', 'spin', 'masterpass'];
const NEEDS_VALUE = ['coins', 'xp', 'premium', 'gift_card'];

export function SpinwheelPage() {
  const [tier, setTier] = useState('free');
  const [rows, setRows] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 4000); };
  const reload = () => listSpinSegments().then(setRows);
  useEffect(() => { reload(); }, []);

  const segs = rows.filter(r => r.tier === tier);
  const totalPct = segs.reduce((s, r) => s + Number(r.base_chance || 0) * 100, 0);
  const balanced = Math.abs(totalPct - 100) < 0.5;

  const patch = (id: string, k: string, v: any) => setRows(rows.map(r => r.id === id ? { ...r, [k]: v } : r));
  const save = async (r: any) => {
    const { error } = await updateSpinSegment(r.id, {
      label: r.label, base_chance: Number(r.base_chance), category: r.category,
      value: r.value === '' || r.value == null ? null : Number(r.value),
      reward_tier: NEEDS_TIER.includes(r.category) ? (r.reward_tier || tier) : null,
      is_active: r.is_active,
    });
    flash(error ? `Failed: ${error.message}` : `"${r.label}" saved`);
  };
  const add = async () => {
    const { error } = await createSpinSegment({ tier, segment_key: `seg_${Date.now().toString(36)}`, label: 'New reward', base_chance: 0.05, category: 'coins', value: 50, sort_order: segs.length });
    if (error) return flash(error.message); reload();
  };
  const remove = async (id: string) => { await deleteSpinSegment(id); reload(); };

  // Rescale all weights so the wheel sums to exactly 100%.
  const normalize = async () => {
    const sum = segs.reduce((s, r) => s + Number(r.base_chance || 0), 0);
    if (sum <= 0) return flash('Nothing to normalize');
    for (const r of segs) await updateSpinSegment(r.id, { base_chance: Number(r.base_chance || 0) / sum });
    flash('Normalised to 100%'); reload();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary mb-1">Spinwheel</h1>
        <p className="text-text-secondary">Reward segments per wheel. Set each reward's <b>chance %</b> — they should total 100%.</p>
      </div>
      {msg && <div className="bg-electric-blue/10 border border-electric-blue/30 text-electric-blue rounded-lg px-4 py-2 text-sm">{msg}</div>}

      <div className="flex gap-2 border-b border-border-subtle">
        {TIERS.map(t => (
          <button key={t} onClick={() => setTier(t)} className={`px-4 py-2 text-sm font-semibold capitalize ${tier === t ? 'text-electric-blue border-b-2 border-electric-blue' : 'text-text-secondary'}`}>{t}</button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className={`text-sm font-semibold ${balanced ? 'text-lime-glow' : 'text-warm-yellow'}`}>
          Total chance: {totalPct.toFixed(1)}% {balanced ? '✓' : '— should be 100%'}
        </p>
        <div className="flex gap-2">
          {!balanced && <button onClick={normalize} className="bg-warm-yellow/15 text-warm-yellow px-3 py-1.5 rounded-lg text-sm font-semibold">Normalise to 100%</button>}
          <button onClick={add} className="bg-electric-blue text-white px-3 py-1.5 rounded-lg text-sm font-semibold">+ Add segment</button>
        </div>
      </div>

      <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-text-disabled text-left border-b border-border-subtle">
            <tr><th className="px-4 py-3">Reward</th><th>Category</th><th>Reward tier</th><th>Value</th><th>Chance %</th><th>Active</th><th></th></tr>
          </thead>
          <tbody>
            {segs.map(r => (
              <tr key={r.id} className="border-b border-border-subtle/50">
                <td className="px-4 py-2"><input value={r.label} onChange={e => patch(r.id, 'label', e.target.value)} className="inp w-44" /></td>
                <td><select value={r.category} onChange={e => patch(r.id, 'category', e.target.value)} className="inp w-28">{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></td>
                <td>{NEEDS_TIER.includes(r.category)
                  ? <select value={r.reward_tier || tier} onChange={e => patch(r.id, 'reward_tier', e.target.value)} className="inp w-24 capitalize">{REWARD_TIERS.map(x => <option key={x}>{x}</option>)}</select>
                  : <span className="text-text-disabled">—</span>}</td>
                <td>{NEEDS_VALUE.includes(r.category)
                  ? <input type="number" value={r.value ?? ''} onChange={e => patch(r.id, 'value', e.target.value)} className="inp w-20" />
                  : <span className="text-text-disabled">—</span>}</td>
                <td>
                  <div className="flex items-center gap-1">
                    <input type="number" step="0.1" value={(Number(r.base_chance || 0) * 100).toFixed(1)}
                      onChange={e => patch(r.id, 'base_chance', (Number(e.target.value) || 0) / 100)} className="inp w-20" />
                    <span className="text-text-disabled">%</span>
                  </div>
                </td>
                <td><input type="checkbox" checked={r.is_active !== false} onChange={e => patch(r.id, 'is_active', e.target.checked)} /></td>
                <td className="text-right pr-4 whitespace-nowrap">
                  <button onClick={() => save(r)} className="bg-electric-blue text-white px-3 py-1 rounded-lg text-xs font-semibold mr-1">Save</button>
                  <button onClick={() => remove(r.id)} className="text-hot-red text-xs">Delete</button>
                </td>
              </tr>
            ))}
            {segs.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-text-disabled">No segments for this wheel. Add one.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
