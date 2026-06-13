import { useEffect, useState } from 'react';
import { getLFConfig, updateLFConfig, listLFActivations, setLFActivation, deleteLFActivation, listLFAssignments, createLFAssignment, deleteLFAssignment } from '../services/liveFantasyAdminService';
import { listPotProfiles, listLeaguesMR, listGamesMR } from '../services/matchRoyaleAdminService';

export function LiveFantasyPage() {
  const [tab, setTab] = useState<'gameplay' | 'scoring' | 'assign' | 'activation'>('gameplay');
  const [msg, setMsg] = useState('');
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2500); };
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold text-text-primary mb-1">Live Fantasy</h1>
      {msg && <div className="bg-lime-glow/15 text-lime-glow text-sm px-3 py-2 rounded-lg">{msg}</div>}
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

function Gameplay({ flash }: { flash: (m: string) => void }) {
  const [cfg, setCfg] = useState<any>(null);
  useEffect(() => { getLFConfig().then(setCfg); }, []);
  if (!cfg) return null;
  const save = async () => {
    try {
      const patch = {
        captain_multiplier: +cfg.captain_multiplier, max_transfers: +cfg.max_transfers, outfield_per_team: +cfg.outfield_per_team,
        gk_underdog_tiers: typeof cfg.gk_underdog_tiers === 'string' ? JSON.parse(cfg.gk_underdog_tiers) : cfg.gk_underdog_tiers,
        reward_split: typeof cfg.reward_split === 'string' ? JSON.parse(cfg.reward_split) : cfg.reward_split,
      };
      const { error } = await updateLFConfig(patch); flash(error ? error.message : 'Saved ✓');
    } catch (e) { flash('Invalid JSON: ' + String(e)); }
  };
  const J = (v: any) => typeof v === 'string' ? v : JSON.stringify(v, null, 2);
  return (
    <div className="card-base p-4 space-y-3 max-w-2xl">
      <div className="grid grid-cols-3 gap-3">
        <L label="Captain multiplier"><input type="number" step="0.1" value={cfg.captain_multiplier} onChange={e => setCfg({ ...cfg, captain_multiplier: e.target.value })} className="inp" /></L>
        <L label="Max transfers"><input type="number" value={cfg.max_transfers} onChange={e => setCfg({ ...cfg, max_transfers: e.target.value })} className="inp" /></L>
        <L label="Outfield per team"><input type="number" value={cfg.outfield_per_team} onChange={e => setCfg({ ...cfg, outfield_per_team: e.target.value })} className="inp" /></L>
      </div>
      <L label="GK underdog tiers (JSON: [{max_pct, mult}])"><textarea rows={6} value={J(cfg.gk_underdog_tiers)} onChange={e => setCfg({ ...cfg, gk_underdog_tiers: e.target.value })} className="inp font-mono text-xs" /></L>
      <L label="Reward split (JSON: [{rank, pct}])"><textarea rows={4} value={J(cfg.reward_split)} onChange={e => setCfg({ ...cfg, reward_split: e.target.value })} className="inp font-mono text-xs" /></L>
      <button onClick={save} className="btn-primary">Save</button>
    </div>
  );
}

function Scoring({ flash }: { flash: (m: string) => void }) {
  const [cfg, setCfg] = useState<any>(null);
  const [txt, setTxt] = useState('');
  useEffect(() => { getLFConfig().then(c => { setCfg(c); setTxt(JSON.stringify(c.scoring, null, 2)); }); }, []);
  if (!cfg) return null;
  const save = async () => {
    try { const scoring = JSON.parse(txt); const { error } = await updateLFConfig({ scoring }); flash(error ? error.message : 'Scoring saved ✓'); }
    catch (e) { flash('Invalid JSON: ' + String(e)); }
  };
  return (
    <div className="card-base p-4 space-y-3 max-w-2xl">
      <p className="text-xs text-text-secondary">Per-position scoring (GK / D / M / A). Every value is editable.</p>
      <textarea rows={22} value={txt} onChange={e => setTxt(e.target.value)} className="inp font-mono text-xs w-full" />
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
