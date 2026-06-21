import { useEffect, useState } from 'react';
import { getLFConfig, updateLFConfig, listLFActivations, setLFActivation, deleteLFActivation, listLFAssignments, createLFAssignment, deleteLFAssignment } from '../services/liveFantasyAdminService';
import { listPotProfiles, listLeaguesMR, listGamesMR } from '../services/matchRoyaleAdminService';
import { PageHeader } from '../components/ui/PageHeader';
import { toast } from '../components/ui/Toast';

export function LiveFantasyPage({ embedded }: { embedded?: boolean } = {}) {
  const [tab, setTab] = useState<'gameplay' | 'scoring' | 'assign' | 'activation'>('gameplay');
  const flash = (m: string) => toast(m);
  return (
    <div className="space-y-4">
      {!embedded && <PageHeader title="Live Fantasy" subtitle="Live fantasy on matches — scoring, pots and activation." />}
      <div className="flex gap-1 border-b border-white/10 overflow-x-auto">
        {(['gameplay', 'scoring', 'assign', 'activation'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-semibold capitalize whitespace-nowrap ${tab === t ? 'text-electric-blue border-b-2 border-electric-blue' : 'text-text-secondary'}`}>
            {t === 'assign' ? 'Pot assignment' : t}</button>
        ))}
      </div>
      {tab === 'gameplay' && <Gameplay flash={flash} />}
      {tab === 'scoring' && <Scoring flash={flash} />}
      {tab === 'assign' && <Assign flash={flash} />}
      {tab === 'activation' && <Activation flash={flash} />}
    </div>
  );
}

// Reusable row editor for arrays of {a,b} objects (e.g. tiers, splits).
function RowEditor({ rows, cols, onChange, blank }: { rows: any[]; cols: { key: string; label: string; step?: string }[]; onChange: (rows: any[]) => void; blank: any }) {
  return (
    <div className="space-y-2">
      <div className="grid gap-2 text-[11px] text-text-secondary px-0.5" style={{ gridTemplateColumns: `repeat(${cols.length}, 1fr) auto` }}>
        {cols.map(c => <span key={c.key}>{c.label}</span>)}<span />
      </div>
      {rows.map((r, i) => (
        <div key={i} className="grid gap-2 items-center" style={{ gridTemplateColumns: `repeat(${cols.length}, 1fr) auto` }}>
          {cols.map(c => (
            <input key={c.key} type="number" step={c.step} value={r[c.key] ?? 0}
              onChange={e => { const next = [...rows]; next[i] = { ...next[i], [c.key]: +e.target.value }; onChange(next); }} className="inp" />
          ))}
          <button onClick={() => onChange(rows.filter((_, j) => j !== i))} className="text-hot-red px-2 text-lg" title="Remove">×</button>
        </div>
      ))}
      <button onClick={() => onChange([...rows, { ...blank }])} className="text-electric-blue text-sm font-semibold">+ Add</button>
    </div>
  );
}

function Gameplay({ flash }: { flash: (m: string) => void }) {
  const [cfg, setCfg] = useState<any>(null);
  useEffect(() => { getLFConfig().then(setCfg); }, []);
  if (!cfg) return null;
  const tiers = Array.isArray(cfg.gk_underdog_tiers) ? cfg.gk_underdog_tiers : [];
  const split = Array.isArray(cfg.reward_split) ? cfg.reward_split : [];
  const save = async () => {
    const { error } = await updateLFConfig({
      captain_multiplier: +cfg.captain_multiplier, max_transfers: +cfg.max_transfers, outfield_per_team: +cfg.outfield_per_team,
      gk_underdog_tiers: tiers, reward_split: split,
    });
    flash(error ? error.message : 'Saved ✓');
  };
  return (
    <div className="card-base p-4 space-y-4 max-w-2xl">
      <div className="grid grid-cols-3 gap-3">
        <L label="Captain multiplier"><input type="number" step="0.1" value={cfg.captain_multiplier} onChange={e => setCfg({ ...cfg, captain_multiplier: e.target.value })} className="inp" /></L>
        <L label="Max transfers"><input type="number" value={cfg.max_transfers} onChange={e => setCfg({ ...cfg, max_transfers: e.target.value })} className="inp" /></L>
        <L label="Outfield per team"><input type="number" value={cfg.outfield_per_team} onChange={e => setCfg({ ...cfg, outfield_per_team: e.target.value })} className="inp" /></L>
      </div>
      <div>
        <div className="text-sm font-semibold">GK underdog bonus tiers</div>
        <p className="text-xs text-text-secondary mb-2">Underdog goalkeeper: points ×multiplier when the team's win probability ≤ max %.</p>
        <RowEditor rows={tiers} cols={[{ key: 'max_pct', label: 'Max win %' }, { key: 'mult', label: 'Multiplier', step: '0.05' }]} blank={{ max_pct: 0, mult: 1 }} onChange={r => setCfg({ ...cfg, gk_underdog_tiers: r })} />
      </div>
      <div>
        <div className="text-sm font-semibold">Reward split</div>
        <p className="text-xs text-text-secondary mb-2">Pot share by final rank.</p>
        <RowEditor rows={split} cols={[{ key: 'rank', label: 'Rank' }, { key: 'pct', label: '% of pot' }]} blank={{ rank: split.length + 1, pct: 0 }} onChange={r => setCfg({ ...cfg, reward_split: r })} />
      </div>
      <button onClick={save} className="btn-primary">Save</button>
    </div>
  );
}

const POS_LABEL: Record<string, string> = { GK: 'Goalkeeper', D: 'Defender', M: 'Midfielder', A: 'Attacker' };

function Scoring({ flash }: { flash: (m: string) => void }) {
  const [cfg, setCfg] = useState<any>(null);
  useEffect(() => { getLFConfig().then(setCfg); }, []);
  if (!cfg) return null;
  const scoring = cfg.scoring || {};
  const positions = ['GK', 'D', 'M', 'A'].filter(p => scoring[p]);
  const setVal = (pos: string, stat: string, v: number) => setCfg({ ...cfg, scoring: { ...scoring, [pos]: { ...scoring[pos], [stat]: v } } });
  const save = async () => { const { error } = await updateLFConfig({ scoring }); flash(error ? error.message : 'Scoring saved ✓'); };
  return (
    <div className="space-y-4 max-w-3xl">
      <p className="text-xs text-text-secondary">Per-position scoring — edit the points for each stat. No JSON.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {positions.map(pos => (
          <div key={pos} className="card-base p-4">
            <div className="font-bold mb-2">{POS_LABEL[pos] ?? pos}</div>
            <div className="space-y-1.5">
              {Object.keys(scoring[pos]).map(stat => (
                <div key={stat} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-text-secondary capitalize">{stat.replace(/_/g, ' ')}</span>
                  <input type="number" value={scoring[pos][stat]} onChange={e => setVal(pos, stat, +e.target.value)} className="inp w-24 text-right" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button onClick={save} className="btn-primary">Save scoring</button>
    </div>
  );
}

function Assign({ flash }: { flash: (m: string) => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [leagues, setLeagues] = useState<any[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ scope: 'global', pot_profile_id: '', override_amount: '' });
  const reload = () => listLFAssignments().then(setRows);
  useEffect(() => { reload(); listPotProfiles().then(setProfiles); listLeaguesMR().then(setLeagues); listGamesMR().then(setGames); }, []);
  const create = async () => {
    const a: any = { scope: form.scope, pot_profile_id: form.pot_profile_id || null };
    if (form.scope === 'league') a.league_id = form.target;
    if (form.scope === 'team') a.team_id = form.target;
    if (form.scope === 'match') { a.fixture_id = form.target; if (form.override_amount) a.override_amount = +form.override_amount; }
    const { error } = await createLFAssignment(a); if (error) return flash(error.message); reload(); flash('Assignment added ✓');
  };
  return (
    <div className="space-y-4 max-w-2xl">
      <div className="card-base p-4 space-y-2">
        <h3 className="font-bold text-text-primary">New assignment</h3>
        <div className="grid grid-cols-2 gap-2">
          <select value={form.scope} onChange={e => setForm({ ...form, scope: e.target.value })} className="inp">{['global', 'league', 'team', 'match'].map(s => <option key={s} value={s}>{s}</option>)}</select>
          <select value={form.pot_profile_id} onChange={e => setForm({ ...form, pot_profile_id: e.target.value })} className="inp"><option value="">— pot profile —</option>{profiles.map(p => <option key={p.id} value={p.id}>{p.name} ({p.type})</option>)}</select>
          {form.scope === 'league' && <select value={form.target} onChange={e => setForm({ ...form, target: e.target.value })} className="inp col-span-2"><option>— league —</option>{leagues.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>}
          {form.scope === 'match' && <select value={form.target} onChange={e => setForm({ ...form, target: e.target.value })} className="inp col-span-2"><option>— match —</option>{games.map((g: any) => <option key={g.fixture_id} value={g.fixture_id}>{g.name}</option>)}</select>}
          {form.scope === 'match' && <input placeholder="Override amount (coins)" value={form.override_amount} onChange={e => setForm({ ...form, override_amount: e.target.value })} className="inp col-span-2" />}
        </div>
        <button onClick={create} className="btn-primary">Add</button>
      </div>
      <div className="card-base divide-y divide-white/5">
        {rows.map(r => (
          <div key={r.id} className="flex items-center justify-between p-3 text-sm">
            <span className="text-text-primary capitalize">{r.scope}{r.override_amount ? ` · ${r.override_amount} coins` : ''}</span>
            <button onClick={async () => { await deleteLFAssignment(r.id); reload(); }} className="text-hot-red text-xs">Delete</button>
          </div>
        ))}
        {rows.length === 0 && <p className="p-3 text-text-secondary text-sm">No assignments. Falls back to none (no pot).</p>}
      </div>
    </div>
  );
}

function Activation({ flash }: { flash: (m: string) => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [leagues, setLeagues] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ scope: 'global', enabled: true });
  const reload = () => listLFActivations().then(setRows);
  useEffect(() => { reload(); listLeaguesMR().then(setLeagues); }, []);
  const add = async () => { const { error } = await setLFActivation(form.scope, form.target ?? null, form.enabled); if (error) return flash(error.message); reload(); flash('Activation set ✓'); };
  return (
    <div className="space-y-4 max-w-2xl">
      <div className="card-base p-4 space-y-2">
        <h3 className="font-bold text-text-primary">Enable / disable</h3>
        <div className="grid grid-cols-2 gap-2">
          <select value={form.scope} onChange={e => setForm({ ...form, scope: e.target.value })} className="inp">{['global', 'league', 'team', 'match'].map(s => <option key={s} value={s}>{s}</option>)}</select>
          <select value={String(form.enabled)} onChange={e => setForm({ ...form, enabled: e.target.value === 'true' })} className="inp"><option value="true">Enabled</option><option value="false">Disabled</option></select>
          {form.scope === 'league' && <select value={form.target} onChange={e => setForm({ ...form, target: e.target.value })} className="inp col-span-2"><option>— league —</option>{leagues.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>}
          {(form.scope === 'team' || form.scope === 'match') && <input placeholder={`${form.scope} id (uuid)`} value={form.target ?? ''} onChange={e => setForm({ ...form, target: e.target.value })} className="inp col-span-2" />}
        </div>
        <button onClick={add} className="btn-primary">Apply</button>
      </div>
      <div className="card-base divide-y divide-white/5">
        {rows.map(r => (
          <div key={r.id} className="flex items-center justify-between p-3 text-sm">
            <span className="text-text-primary capitalize">{r.scope} · <span className={r.enabled ? 'text-lime-glow' : 'text-hot-red'}>{r.enabled ? 'enabled' : 'disabled'}</span></span>
            <button onClick={async () => { await deleteLFActivation(r.id); reload(); }} className="text-hot-red text-xs">Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function L({ label, children }: { label: string; children: any }) {
  return <label className="block"><span className="text-xs font-semibold text-text-secondary">{label}</span>{children}</label>;
}
