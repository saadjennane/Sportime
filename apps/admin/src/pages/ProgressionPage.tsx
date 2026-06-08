import { useEffect, useState } from 'react';
import {
  listLevels, updateLevel, listBadges, upsertBadge, deleteBadge, listXpCoefs, updateXpCoef,
} from '../services/progressionService';

export function ProgressionPage() {
  const [tab, setTab] = useState<'levels' | 'badges' | 'xp'>('levels');
  const [msg, setMsg] = useState('');
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 4000); };
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary mb-1">Progression</h1>
        <p className="text-text-secondary">Levels, badges and the XP formula.</p>
      </div>
      {msg && <div className="bg-electric-blue/10 border border-electric-blue/30 text-electric-blue rounded-lg px-4 py-2 text-sm">{msg}</div>}
      <div className="flex gap-2 border-b border-border-subtle">
        {(['levels', 'badges', 'xp'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-semibold capitalize ${tab === t ? 'text-electric-blue border-b-2 border-electric-blue' : 'text-text-secondary'}`}>
            {t === 'xp' ? 'XP formula' : t}
          </button>
        ))}
      </div>
      {tab === 'levels' && <Levels flash={flash} />}
      {tab === 'badges' && <Badges flash={flash} />}
      {tab === 'xp' && <XpFormula flash={flash} />}
    </div>
  );
}

function Levels({ flash }: { flash: (m: string) => void }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { listLevels().then(setRows); }, []);
  const patch = (level: number, k: string, v: any) => setRows(rows.map(r => r.level === level ? { ...r, [k]: v } : r));
  const save = async (r: any) => {
    const { error } = await updateLevel(r.level, { name: r.name, xp_required: Number(r.xp_required) });
    flash(error ? `Failed: ${error.message}` : `Level ${r.level} saved`);
  };
  return (
    <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="text-text-disabled text-left border-b border-border-subtle"><tr><th className="px-4 py-3">Level</th><th>Name</th><th>XP required</th><th></th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.level} className="border-b border-border-subtle/50">
              <td className="px-4 py-2 font-bold text-text-primary">{r.level}</td>
              <td><input value={r.name} onChange={e => patch(r.level, 'name', e.target.value)} className="inp w-44" /></td>
              <td><input type="number" value={r.xp_required} onChange={e => patch(r.level, 'xp_required', e.target.value)} className="inp w-32" /></td>
              <td className="text-right pr-4"><button onClick={() => save(r)} className="bg-electric-blue text-white px-3 py-1.5 rounded-lg text-xs font-semibold">Save</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const COND_TYPES = ['manual', 'predictions_correct', 'games_played', 'streak', 'level_reached', 'query'];

function Badges({ flash }: { flash: (m: string) => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [edit, setEdit] = useState<any>(null);
  const reload = () => listBadges().then(setRows);
  useEffect(() => { reload(); }, []);
  const save = async () => {
    const { error } = await upsertBadge(edit);
    if (error) return flash(`Failed: ${error.message}`);
    setEdit(null); reload(); flash('Badge saved');
  };
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><button onClick={() => setEdit({ name: '', description: '', icon_url: '', condition_type: 'manual', condition_value: 0, xp_bonus: 0, is_active: true })} className="bg-electric-blue text-white px-3 py-1.5 rounded-lg text-sm font-semibold">+ New badge</button></div>
      <div className="grid md:grid-cols-2 gap-2">
        {rows.map(b => (
          <div key={b.id} className="bg-surface border border-border-subtle rounded-lg p-3 flex items-center gap-3">
            {b.icon_url ? <img src={b.icon_url} className="w-8 h-8 rounded" /> : <div className="w-8 h-8 rounded bg-background-dark" />}
            <div className="flex-1">
              <p className="text-text-primary font-medium">{b.name} {b.is_active === false && <span className="text-text-disabled text-xs">(inactive)</span>}</p>
              <p className="text-text-disabled text-xs">{b.condition_type} · +{b.xp_bonus} XP</p>
            </div>
            <button onClick={() => setEdit(b)} className="text-electric-blue text-xs font-semibold">Edit</button>
            <button onClick={async () => { await deleteBadge(b.id); reload(); }} className="text-hot-red text-xs">Delete</button>
          </div>
        ))}
        {rows.length === 0 && <p className="text-text-disabled text-sm">No badges yet.</p>}
      </div>
      {edit && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setEdit(null)}>
          <div className="bg-surface border border-border-subtle rounded-xl w-full max-w-lg p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-text-primary">{edit.id ? 'Edit' : 'New'} badge</h3>
            <Lbl t="Name"><input value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} className="inp" /></Lbl>
            <Lbl t="Description"><input value={edit.description ?? ''} onChange={e => setEdit({ ...edit, description: e.target.value })} className="inp" /></Lbl>
            <Lbl t="Icon URL"><input value={edit.icon_url ?? ''} onChange={e => setEdit({ ...edit, icon_url: e.target.value })} className="inp" /></Lbl>
            <div className="grid grid-cols-2 gap-3">
              <Lbl t="Condition type"><select value={edit.condition_type ?? 'manual'} onChange={e => setEdit({ ...edit, condition_type: e.target.value })} className="inp">{COND_TYPES.map(c => <option key={c}>{c}</option>)}</select></Lbl>
              <Lbl t="Condition value"><input type="number" value={edit.condition_value ?? 0} onChange={e => setEdit({ ...edit, condition_value: Number(e.target.value) })} className="inp" /></Lbl>
              <Lbl t="XP bonus"><input type="number" value={edit.xp_bonus ?? 0} onChange={e => setEdit({ ...edit, xp_bonus: Number(e.target.value) })} className="inp" /></Lbl>
              <label className="flex items-center gap-2 text-sm text-text-secondary mt-6"><input type="checkbox" checked={edit.is_active !== false} onChange={e => setEdit({ ...edit, is_active: e.target.checked })} /> Active</label>
            </div>
            {edit.condition_type === 'query' && <Lbl t="Condition SQL query"><input value={edit.condition_query ?? ''} onChange={e => setEdit({ ...edit, condition_query: e.target.value })} className="inp" /></Lbl>}
            <div className="flex justify-end gap-2"><button onClick={() => setEdit(null)} className="text-text-secondary px-3 py-2 text-sm">Cancel</button><button onClick={save} className="bg-lime-glow text-deep-navy font-bold px-4 py-2 rounded-lg text-sm">Save</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function XpFormula({ flash }: { flash: (m: string) => void }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { listXpCoefs().then(setRows); }, []);
  const patch = (key: string, v: any) => setRows(rows.map(r => r.key === key ? { ...r, value: v } : r));
  const save = async (r: any) => { const { error } = await updateXpCoef(r.key, Number(r.value)); flash(error ? `Failed: ${error.message}` : `${r.key} saved`); };
  return (
    <div className="space-y-3">
      <p className="text-text-secondary text-sm">Weekly XP = (activity + accuracy + fantasy + risk + badges + game‑variety) × diminishing × GOAT, then inactivity decay. Edit any coefficient below.</p>
      <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-text-disabled text-left border-b border-border-subtle"><tr><th className="px-4 py-3">Coefficient</th><th>Meaning</th><th>Value</th><th></th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.key} className="border-b border-border-subtle/50">
                <td className="px-4 py-2 font-mono text-text-primary text-xs">{r.key}</td>
                <td className="text-text-secondary text-xs">{r.label}</td>
                <td><input type="number" step="0.01" value={r.value} onChange={e => patch(r.key, e.target.value)} className="inp w-28" /></td>
                <td className="text-right pr-4"><button onClick={() => save(r)} className="bg-electric-blue text-white px-3 py-1.5 rounded-lg text-xs font-semibold">Save</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Lbl({ t, children }: { t: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs text-text-secondary">{t}</span><div className="mt-1">{children}</div></label>;
}
