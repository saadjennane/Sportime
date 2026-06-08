import { useEffect, useState } from 'react';
import { listSpinSegments, updateSpinSegment, createSpinSegment, deleteSpinSegment } from '../services/spinAdminService';

const TIERS = ['amateur', 'master', 'apex', 'premium'];
const CATEGORIES = ['ticket', 'spin', 'masterpass', 'xp', 'premium', 'gift_card'];

export function SpinwheelPage() {
  const [tier, setTier] = useState('amateur');
  const [rows, setRows] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 4000); };
  const reload = () => listSpinSegments().then(setRows);
  useEffect(() => { reload(); }, []);

  const segs = rows.filter(r => r.tier === tier);
  const total = segs.reduce((s, r) => s + Number(r.base_chance || 0), 0) || 1;

  const patch = (id: string, k: string, v: any) => setRows(rows.map(r => r.id === id ? { ...r, [k]: v } : r));
  const save = async (r: any) => {
    const { error } = await updateSpinSegment(r.id, { label: r.label, base_chance: Number(r.base_chance), category: r.category, value: r.value === '' ? null : Number(r.value), is_active: r.is_active });
    flash(error ? `Failed: ${error.message}` : `"${r.label}" saved`);
  };
  const add = async () => {
    const { error } = await createSpinSegment({ tier, segment_key: `seg_${Date.now().toString(36)}`, label: 'New reward', base_chance: 0.05, category: 'xp', value: 100, sort_order: segs.length });
    if (error) return flash(error.message);
    reload();
  };
  const remove = async (id: string) => { await deleteSpinSegment(id); reload(); };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary mb-1">Spinwheel</h1>
        <p className="text-text-secondary">Reward segments per tier. Probabilities are relative (normalised per spin).</p>
      </div>
      {msg && <div className="bg-electric-blue/10 border border-electric-blue/30 text-electric-blue rounded-lg px-4 py-2 text-sm">{msg}</div>}

      <div className="flex gap-2 border-b border-border-subtle">
        {TIERS.map(t => (
          <button key={t} onClick={() => setTier(t)} className={`px-4 py-2 text-sm font-semibold capitalize ${tier === t ? 'text-electric-blue border-b-2 border-electric-blue' : 'text-text-secondary'}`}>{t}</button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-text-disabled text-sm">Sum of weights: {total.toFixed(2)} — shown as normalised % below.</p>
        <button onClick={add} className="bg-electric-blue text-white px-3 py-1.5 rounded-lg text-sm font-semibold">+ Add segment</button>
      </div>

      <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-text-disabled text-left border-b border-border-subtle">
            <tr><th className="px-4 py-3">Reward</th><th>Category</th><th>Value</th><th>Weight</th><th>Odds</th><th>Active</th><th></th></tr>
          </thead>
          <tbody>
            {segs.map(r => (
              <tr key={r.id} className="border-b border-border-subtle/50">
                <td className="px-4 py-2"><input value={r.label} onChange={e => patch(r.id, 'label', e.target.value)} className="inp w-44" /></td>
                <td><select value={r.category} onChange={e => patch(r.id, 'category', e.target.value)} className="inp w-32">{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></td>
                <td><input type="number" value={r.value ?? ''} onChange={e => patch(r.id, 'value', e.target.value)} className="inp w-20" /></td>
                <td><input type="number" step="0.01" value={r.base_chance} onChange={e => patch(r.id, 'base_chance', e.target.value)} className="inp w-20" /></td>
                <td className="text-lime-glow font-semibold">{((Number(r.base_chance || 0) / total) * 100).toFixed(1)}%</td>
                <td><input type="checkbox" checked={r.is_active !== false} onChange={e => patch(r.id, 'is_active', e.target.checked)} /></td>
                <td className="text-right pr-4 whitespace-nowrap">
                  <button onClick={() => save(r)} className="bg-electric-blue text-white px-3 py-1 rounded-lg text-xs font-semibold mr-1">Save</button>
                  <button onClick={() => remove(r.id)} className="text-hot-red text-xs">Delete</button>
                </td>
              </tr>
            ))}
            {segs.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-text-disabled">No segments for this tier.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
