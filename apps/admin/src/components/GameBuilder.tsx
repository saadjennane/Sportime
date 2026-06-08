import { useEffect, useState } from 'react';
import {
  listCompetitions, getCompetitionDetail, createFromLeague, setStatus, updateCompetition,
  resolveCompetition, generateBracket, getLeaderboard, listSourceLeagues,
  listAnnouncements, createAnnouncement, deleteAnnouncement,
} from '../services/tournamentAdminService';

const STATUSES = ['draft', 'open', 'running', 'resolved', 'cancelled'];
const LEVELS = ['Rookie', 'Rising', 'Pro', 'Elite', 'Legend', 'GOAT'];

const statusColor = (s: string) =>
  s === 'open' ? 'bg-lime-glow/15 text-lime-glow' : s === 'running' ? 'bg-electric-blue/15 text-electric-blue'
  : s === 'resolved' ? 'bg-text-disabled/15 text-text-disabled' : s === 'cancelled' ? 'bg-hot-red/15 text-hot-red'
  : 'bg-warm-yellow/15 text-warm-yellow';

export default function GameBuilder() {
  const [comps, setComps] = useState<any[]>([]);
  const [leagues, setLeagues] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState('');
  const [manageId, setManageId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', league_api_id: 0, season: 2026, entry_cost: 0, min_players: '', max_players: '', minimum_level: 'Rookie', is_visible: true, opens_at: '' });

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 5000); };
  const reload = async () => setComps(await listCompetitions());
  useEffect(() => { reload(); listSourceLeagues().then(setLeagues); }, []);

  const submit = async () => {
    if (!form.name || !form.league_api_id) return flash('Name and source league are required');
    flash('Creating… (fetching groups from the API)');
    const { data, error } = await createFromLeague({
      name: form.name, league_api_id: Number(form.league_api_id), season: Number(form.season),
      entry_cost: Number(form.entry_cost) || 0,
      min_players: form.min_players ? Number(form.min_players) : null,
      max_players: form.max_players ? Number(form.max_players) : null,
      minimum_level: form.minimum_level, is_visible: form.is_visible,
      opens_at: form.opens_at || null,
    });
    if (error || !(data as any)?.ok) return flash(`Failed: ${error?.message || (data as any)?.error}`);
    setCreating(false);
    setForm({ ...form, name: '', league_api_id: 0 });
    await reload();
    flash(`Created: ${(data as any).groups} groups, ${(data as any).teams} teams → ${((data as any).format?.knockout_rounds || []).join(' → ')}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary mb-1">Game Builder</h1>
          <p className="text-text-secondary">Create and run games — Tournament Quest, from any imported league.</p>
        </div>
        <button onClick={() => setCreating(v => !v)} className="bg-electric-blue text-white px-4 py-2 rounded-lg font-semibold">
          {creating ? 'Cancel' : '+ Create Tournament Quest'}
        </button>
      </div>
      {msg && <div className="bg-electric-blue/10 border border-electric-blue/30 text-electric-blue rounded-lg px-4 py-2 text-sm">{msg}</div>}

      {creating && (
        <div className="bg-surface border border-border-subtle rounded-xl p-5 grid md:grid-cols-2 gap-4">
          <Field label="Name">
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="FIFA World Cup 2026" className="inp" />
          </Field>
          <Field label="Source league (must have group standings)">
            <select value={form.league_api_id} onChange={e => setForm({ ...form, league_api_id: Number(e.target.value) })} className="inp">
              <option value={0}>— choose a league —</option>
              {leagues.map(l => <option key={l.api_id} value={l.api_id}>{l.name} ({l.api_id})</option>)}
            </select>
          </Field>
          <Field label="Season"><input type="number" value={form.season} onChange={e => setForm({ ...form, season: Number(e.target.value) })} className="inp" /></Field>
          <Field label="Entry cost (coins)"><input type="number" value={form.entry_cost} onChange={e => setForm({ ...form, entry_cost: Number(e.target.value) })} className="inp" /></Field>
          <Field label="Min players"><input type="number" value={form.min_players} onChange={e => setForm({ ...form, min_players: e.target.value })} className="inp" /></Field>
          <Field label="Max players"><input type="number" value={form.max_players} onChange={e => setForm({ ...form, max_players: e.target.value })} className="inp" /></Field>
          <Field label="Minimum level">
            <select value={form.minimum_level} onChange={e => setForm({ ...form, minimum_level: e.target.value })} className="inp">
              {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </Field>
          <Field label="Opens at (becomes 'open')"><input type="datetime-local" value={form.opens_at} onChange={e => setForm({ ...form, opens_at: e.target.value })} className="inp" /></Field>
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input type="checkbox" checked={form.is_visible} onChange={e => setForm({ ...form, is_visible: e.target.checked })} /> Visible in app
          </label>
          <div className="md:col-span-2 flex items-center justify-between">
            <p className="text-xs text-text-disabled">Groups + bracket are auto‑detected from the league standings. Rewards: configured later (Reward Builder).</p>
            <button onClick={submit} className="bg-lime-glow text-deep-navy font-bold px-5 py-2 rounded-lg">Create</button>
          </div>
        </div>
      )}

      {/* Games list */}
      <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-text-disabled text-left border-b border-border-subtle">
            <tr><th className="px-4 py-3">Game</th><th>Type</th><th>Status</th><th>Entry</th><th>Players</th><th>Visible</th><th className="text-right pr-4">Actions</th></tr>
          </thead>
          <tbody>
            {comps.map(c => (
              <tr key={c.id} className="border-b border-border-subtle/50">
                <td className="px-4 py-3 font-medium text-text-primary">{c.name}</td>
                <td className="text-text-secondary">Tournament Quest</td>
                <td><span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(c.status)}`}>{c.status}</span></td>
                <td className="text-text-secondary">{c.entry_cost ?? 0}</td>
                <td className="text-text-secondary">{c.min_players ?? '—'} / {c.max_players ?? '∞'}</td>
                <td>{c.is_visible === false ? <span className="text-text-disabled">Hidden</span> : <span className="text-lime-glow">Yes</span>}</td>
                <td className="text-right pr-4">
                  <button onClick={() => setManageId(manageId === c.id ? null : c.id)} className="text-electric-blue font-semibold">Manage</button>
                </td>
              </tr>
            ))}
            {comps.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-text-disabled">No games yet. Create one from a league.</td></tr>}
          </tbody>
        </table>
      </div>

      {manageId && <ManagePanel id={manageId} onChange={reload} flash={flash} />}
    </div>
  );
}

function ManagePanel({ id, onChange, flash }: { id: string; onChange: () => void; flash: (m: string) => void }) {
  const [detail, setDetail] = useState<any>(null);
  const [lb, setLb] = useState<any[]>([]);
  const [tab, setTab] = useState<'lifecycle' | 'leaderboard' | 'announce'>('lifecycle');
  const [ann, setAnn] = useState<any[]>([]);
  const [aForm, setAForm] = useState({ title: '', body: '', phase_key: '', celebrate: false });

  const reload = async () => { setDetail(await getCompetitionDetail(id)); setLb(await getLeaderboard(id)); setAnn(await listAnnouncements(id)); };
  useEffect(() => { reload(); }, [id]);
  if (!detail?.comp) return null;
  const c = detail.comp;
  const rounds: string[] = detail.format?.knockout_rounds ?? [];

  const act = async (fn: () => Promise<any>, label: string) => {
    const { error } = await fn() ?? {};
    if (error) flash(`${label}: ${error.message}`); else { flash(`${label} ✓`); await reload(); onChange(); }
  };

  return (
    <div className="bg-surface border border-border-subtle rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-text-primary">{c.name}</h2>
        <p className="text-sm text-text-secondary">{detail.format?.groups_count} groups · {detail.format?.knockout_participants} qualify · {rounds.join(' → ')}</p>
      </div>
      <div className="flex gap-2 border-b border-border-subtle">
        {(['lifecycle', 'leaderboard', 'announce'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 text-sm font-semibold capitalize ${tab === t ? 'text-electric-blue border-b-2 border-electric-blue' : 'text-text-secondary'}`}>{t}</button>
        ))}
      </div>

      {tab === 'lifecycle' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-text-secondary">Status:</span>
            <select value={c.status} onChange={e => act(() => setStatus(id, e.target.value), 'Status')} className="inp w-40">
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={() => act(() => setStatus(id, 'resolved'), 'Mark finished')} className="bg-text-disabled/20 text-text-primary px-3 py-1.5 rounded-lg text-sm font-semibold">Mark finished</button>
            <button onClick={() => act(() => setStatus(id, 'cancelled'), 'Cancel')} className="bg-hot-red/15 text-hot-red px-3 py-1.5 rounded-lg text-sm font-semibold">Cancel</button>
            <label className="flex items-center gap-1.5 text-sm text-text-secondary ml-2">
              <input type="checkbox" checked={c.is_visible !== false} onChange={e => act(() => updateCompetition(id, { is_visible: e.target.checked }), 'Visibility')} /> Visible in app
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => act(() => generateBracket(id), 'Generate bracket')} className="bg-electric-blue/15 text-electric-blue px-3 py-2 rounded-lg text-sm font-semibold">Generate bracket</button>
            <button onClick={() => act(() => resolveCompetition(id), 'Resolve & recalc')} className="bg-lime-glow/15 text-lime-glow px-3 py-2 rounded-lg text-sm font-semibold">Resolve &amp; recalc scores</button>
          </div>
        </div>
      )}

      {tab === 'leaderboard' && (
        <div className="space-y-1">
          {lb.length === 0 ? <p className="text-text-disabled text-sm">No scores yet.</p> : lb.map((r: any) => (
            <div key={r.rank} className="flex items-center gap-3 py-1.5 border-b border-border-subtle/40 text-sm">
              <span className="w-6 text-text-disabled font-bold">{r.rank}</span>
              <span className="flex-1 text-text-primary">{r.username ?? 'Player'}</span>
              <span className="font-bold text-electric-blue">{r.total_score}</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'announce' && (
        <div className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <input value={aForm.title} onChange={e => setAForm({ ...aForm, title: e.target.value })} placeholder="Title (e.g. Group stage over!)" className="inp" />
            <select value={aForm.phase_key} onChange={e => setAForm({ ...aForm, phase_key: e.target.value })} className="inp">
              <option value="">No specific moment</option>
              <option value="group_end">End of group stage</option>
              {rounds.map(r => <option key={r} value={r}>Before {r}</option>)}
              <option value="final">Final</option>
            </select>
            <textarea value={aForm.body} onChange={e => setAForm({ ...aForm, body: e.target.value })} placeholder="Message…" className="inp md:col-span-2" rows={2} />
            <label className="flex items-center gap-2 text-sm text-text-secondary"><input type="checkbox" checked={aForm.celebrate} onChange={e => setAForm({ ...aForm, celebrate: e.target.checked })} /> Trigger celebration</label>
            <div className="flex gap-2 justify-end">
              <button onClick={() => act(() => createAnnouncement({ competition_id: id, ...aForm, phase_key: aForm.phase_key || null, publish: false }), 'Saved draft')} className="bg-text-disabled/20 text-text-primary px-3 py-2 rounded-lg text-sm font-semibold">Save draft</button>
              <button onClick={() => act(() => createAnnouncement({ competition_id: id, ...aForm, phase_key: aForm.phase_key || null, publish: true }), 'Published')} className="bg-electric-blue text-white px-3 py-2 rounded-lg text-sm font-semibold">Publish now</button>
            </div>
          </div>
          <div className="space-y-1">
            {ann.map((a: any) => (
              <div key={a.id} className="flex items-center gap-2 text-sm border-b border-border-subtle/40 py-1.5">
                <span className={`text-xs px-2 py-0.5 rounded-full ${a.published_at ? 'bg-lime-glow/15 text-lime-glow' : 'bg-warm-yellow/15 text-warm-yellow'}`}>{a.published_at ? 'live' : 'draft'}</span>
                <span className="text-text-primary font-medium">{a.title}</span>
                {a.phase_key && <span className="text-text-disabled text-xs">@{a.phase_key}</span>}
                <button onClick={() => act(() => deleteAnnouncement(a.id), 'Deleted')} className="ml-auto text-hot-red text-xs">Delete</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs text-text-secondary">{label}</span><div className="mt-1">{children}</div></label>;
}
