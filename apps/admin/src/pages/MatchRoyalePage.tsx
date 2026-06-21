import { useEffect, useState } from 'react';
import {
  getMRConfig, updateMRConfig, listMRCatalog, updateMRCatalog,
  listPotProfiles, upsertPotProfile, deletePotProfile,
  listAssignments, createAssignment, deleteAssignment,
  listActivations, setActivation, listLeaguesMR, listGamesMR,
} from '../services/matchRoyaleAdminService';
import { PageHeader } from '../components/ui/PageHeader';
import { toast } from '../components/ui/Toast';

export function MatchRoyalePage() {
  const [tab, setTab] = useState<'gameplay' | 'pots' | 'assign' | 'activation' | 'games'>('activation');
  const flash = (m: string) => toast(m);
  return (
    <div className="space-y-6">
      <PageHeader title="Match Royale" subtitle="Live battle-royale on matches. Games auto-create ~1h before kickoff for activated matches." />
      <div className="flex gap-2 border-b border-border-subtle overflow-x-auto">
        {(['activation', 'pots', 'assign', 'gameplay', 'games'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-semibold capitalize whitespace-nowrap ${tab === t ? 'text-electric-blue border-b-2 border-electric-blue' : 'text-text-secondary'}`}>
            {t === 'assign' ? 'Pot assignment' : t}
          </button>
        ))}
      </div>
      {tab === 'gameplay' && <Gameplay flash={flash} />}
      {tab === 'pots' && <Pots flash={flash} />}
      {tab === 'assign' && <Assign flash={flash} />}
      {tab === 'activation' && <Activation flash={flash} />}
      {tab === 'games' && <Games />}
    </div>
  );
}

function Gameplay({ flash }: { flash: (m: string) => void }) {
  const [cfg, setCfg] = useState<any>(null);
  const [cat, setCat] = useState<any[]>([]);
  useEffect(() => { getMRConfig().then(setCfg); listMRCatalog().then(setCat); }, []);
  if (!cfg) return null;
  const save = async () => { const { error } = await updateMRConfig({ hearts: +cfg.hearts, questions_pre: +cfg.questions_pre, questions_half: +cfg.questions_half, tie_break_enabled: cfg.tie_break_enabled }); flash(error ? error.message : 'Config saved'); };
  const toggle = async (it: any) => { await updateMRCatalog(it.id, { is_active: !it.is_active }); listMRCatalog().then(setCat); };
  return (
    <div className="space-y-5">
      <div className="bg-surface border border-border-subtle rounded-xl p-5 grid md:grid-cols-4 gap-4">
        <L t="Hearts"><input type="number" value={cfg.hearts} onChange={e => setCfg({ ...cfg, hearts: e.target.value })} className="inp" /></L>
        <L t="Questions (1st half)"><input type="number" value={cfg.questions_pre} onChange={e => setCfg({ ...cfg, questions_pre: e.target.value })} className="inp" /></L>
        <L t="Questions (2nd half)"><input type="number" value={cfg.questions_half} onChange={e => setCfg({ ...cfg, questions_half: e.target.value })} className="inp" /></L>
        <label className="flex items-center gap-2 text-sm text-text-secondary mt-6"><input type="checkbox" checked={cfg.tie_break_enabled} onChange={e => setCfg({ ...cfg, tie_break_enabled: e.target.checked })} /> Tie‑break</label>
        <div className="md:col-span-4 flex justify-end"><button onClick={save} className="bg-lime-glow text-deep-navy font-bold px-5 py-2 rounded-lg">Save config</button></div>
      </div>
      <div className="bg-surface border border-border-subtle rounded-xl p-4">
        <h3 className="font-bold text-text-primary mb-2">Event catalog</h3>
        <div className="grid md:grid-cols-2 gap-2">
          {cat.map(it => (
            <label key={it.id} className="flex items-center justify-between border border-border-subtle rounded-lg px-3 py-2 text-sm">
              <span className="text-text-primary">{it.label} <span className="text-text-disabled text-xs">({it.answer_type})</span></span>
              <input type="checkbox" checked={it.is_active} onChange={() => toggle(it)} />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

const POT_TYPES = ['fixed', 'progressive', 'funded'];
function Pots({ flash }: { flash: (m: string) => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [edit, setEdit] = useState<any>(null);
  const reload = () => listPotProfiles().then(setRows);
  useEffect(() => { reload(); }, []);
  const save = async () => { const { error } = await upsertPotProfile(edit); if (error) return flash(error.message); setEdit(null); reload(); flash('Pot profile saved'); };
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><button onClick={() => setEdit({ name: '', type: 'fixed', fixed_amount: 1000, redistribution_pct: 100, tiers: [] })} className="bg-electric-blue text-white px-3 py-1.5 rounded-lg text-sm font-semibold">+ New profile</button></div>
      <div className="grid md:grid-cols-2 gap-2">
        {rows.map(p => (
          <div key={p.id} className="bg-surface border border-border-subtle rounded-lg p-3 flex items-center justify-between">
            <div><p className="text-text-primary font-medium">{p.name}</p><p className="text-text-disabled text-xs">{p.type}{p.type === 'fixed' ? ` · ${p.fixed_amount} coins` : p.type === 'funded' ? ` · ${p.entry_cost} entry · ${p.redistribution_pct}%` : ` · ${(p.tiers || []).length} tiers`}</p></div>
            <div className="flex gap-2"><button onClick={() => setEdit(p)} className="text-electric-blue text-xs font-semibold">Edit</button><button onClick={async () => { await deletePotProfile(p.id); reload(); }} className="text-hot-red text-xs">Delete</button></div>
          </div>
        ))}
      </div>
      {edit && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setEdit(null)}>
          <div className="bg-surface border border-border-subtle rounded-xl w-full max-w-md p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-text-primary">{edit.id ? 'Edit' : 'New'} pot profile</h3>
            <L t="Name"><input value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} className="inp" /></L>
            <L t="Type"><select value={edit.type} onChange={e => setEdit({ ...edit, type: e.target.value })} className="inp">{POT_TYPES.map(t => <option key={t}>{t}</option>)}</select></L>
            {edit.type === 'fixed' && <L t="Amount (coins)"><input type="number" value={edit.fixed_amount ?? 0} onChange={e => setEdit({ ...edit, fixed_amount: +e.target.value })} className="inp" /></L>}
            {edit.type === 'funded' && <div className="grid grid-cols-2 gap-3"><L t="Entry cost"><input type="number" value={edit.entry_cost ?? 0} onChange={e => setEdit({ ...edit, entry_cost: +e.target.value })} className="inp" /></L><L t="Redistribution %"><input type="number" value={edit.redistribution_pct ?? 100} onChange={e => setEdit({ ...edit, redistribution_pct: +e.target.value })} className="inp" /></L></div>}
            {edit.type === 'progressive' && <L t="Tiers (JSON [{min,max,amount}])"><textarea value={JSON.stringify(edit.tiers ?? [])} onChange={e => { try { setEdit({ ...edit, tiers: JSON.parse(e.target.value) }); } catch { /* keep typing */ } }} className="inp" rows={3} /></L>}
            <div className="flex justify-end gap-2"><button onClick={() => setEdit(null)} className="text-text-secondary px-3 py-2 text-sm">Cancel</button><button onClick={save} className="bg-lime-glow text-deep-navy font-bold px-4 py-2 rounded-lg text-sm">Save</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function Assign({ flash }: { flash: (m: string) => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [leagues, setLeagues] = useState<any[]>([]);
  const [f, setF] = useState<any>({ scope: 'global', pot_profile_id: '', league_id: '', override_amount: '' });
  const reload = () => listAssignments().then(setRows);
  useEffect(() => { reload(); listPotProfiles().then(setProfiles); listLeaguesMR().then(setLeagues); }, []);
  const add = async () => {
    const a: any = { scope: f.scope, pot_profile_id: f.pot_profile_id || null };
    if (f.scope === 'league') a.league_id = f.league_id || null;
    if (f.scope === 'match') a.override_amount = f.override_amount ? +f.override_amount : null;
    const { error } = await createAssignment(a); if (error) return flash(error.message); reload(); flash('Rule added');
  };
  return (
    <div className="space-y-4">
      <div className="bg-surface border border-border-subtle rounded-xl p-4 flex flex-wrap items-end gap-3">
        <L t="Scope"><select value={f.scope} onChange={e => setF({ ...f, scope: e.target.value })} className="inp w-36"><option value="global">Global</option><option value="league">League</option></select></L>
        {f.scope === 'league' && <L t="League"><select value={f.league_id} onChange={e => setF({ ...f, league_id: e.target.value })} className="inp w-48"><option value="">—</option>{leagues.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></L>}
        <L t="Pot profile"><select value={f.pot_profile_id} onChange={e => setF({ ...f, pot_profile_id: e.target.value })} className="inp w-44"><option value="">—</option>{profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></L>
        <button onClick={add} className="bg-electric-blue text-white px-3 py-2 rounded-lg text-sm font-semibold">Add rule</button>
      </div>
      <p className="text-text-disabled text-xs">Priority at resolution: <b>Match &gt; Team &gt; League &gt; Global</b>. (Team/Match rules are set from a team/match page later.)</p>
      <div className="bg-surface border border-border-subtle rounded-xl divide-y divide-border-subtle/50">
        {rows.map(r => (
          <div key={r.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
            <span className="capitalize font-semibold text-text-primary">{r.scope}</span>
            <span className="text-text-secondary">{r.profile?.name ?? (r.override_amount ? `${r.override_amount} coins` : '—')}</span>
            <button onClick={async () => { await deleteAssignment(r.id); reload(); }} className="text-hot-red text-xs">Delete</button>
          </div>
        ))}
        {rows.length === 0 && <p className="px-4 py-4 text-text-disabled text-sm">No rules yet — add a Global rule so every activated match has a pot.</p>}
      </div>
    </div>
  );
}

function Activation({ flash }: { flash: (m: string) => void }) {
  const [leagues, setLeagues] = useState<any[]>([]);
  const [acts, setActs] = useState<Record<string, boolean>>({});
  const reload = async () => {
    setLeagues(await listLeaguesMR());
    const a = await listActivations();
    setActs(Object.fromEntries(a.filter((x: any) => x.scope === 'league').map((x: any) => [x.target_id, x.enabled])));
  };
  useEffect(() => { reload(); }, []);
  const toggle = async (id: string, on: boolean) => { await setActivation('league', id, on); setActs({ ...acts, [id]: on }); flash(on ? 'Enabled' : 'Disabled'); };
  return (
    <div className="space-y-3">
      <p className="text-text-secondary text-sm">Enable Match Royale on whole competitions. A game auto‑creates ~1h before each match of an enabled league.</p>
      <div className="bg-surface border border-border-subtle rounded-xl divide-y divide-border-subtle/50">
        {leagues.map(l => (
          <div key={l.id} className="flex items-center justify-between px-4 py-3">
            <span className="text-text-primary font-medium">{l.name}</span>
            <button onClick={() => toggle(l.id, !acts[l.id])} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${acts[l.id] ? 'bg-lime-glow text-deep-navy' : 'bg-surface-hover text-text-secondary border border-border-subtle'}`}>
              {acts[l.id] ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Games() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { listGamesMR().then(setRows); }, []);
  return (
    <div className="bg-surface border border-border-subtle rounded-xl divide-y divide-border-subtle/50">
      {rows.map(g => (
        <div key={g.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
          <span className="text-text-primary font-medium">{g.name}</span>
          <span className="text-text-secondary">{g.pot_amount ?? '—'} coins</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-electric-blue/15 text-electric-blue">{g.status}</span>
        </div>
      ))}
      {rows.length === 0 && <p className="px-4 py-6 text-center text-text-disabled text-sm">No Match Royale games yet. They appear ~1h before activated matches.</p>}
    </div>
  );
}

function L({ t, children }: { t: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs text-text-secondary">{t}</span><div className="mt-1">{children}</div></label>;
}
