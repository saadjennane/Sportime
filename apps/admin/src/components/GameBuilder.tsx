import { useEffect, useState } from 'react';
import {
  listCompetitions, getCompetitionDetail, createFromLeague, setStatus, updateCompetition,
  resolveCompetition, generateBracket, getLeaderboard, listSourceLeagues,
  listAnnouncements, createAnnouncement, deleteAnnouncement,
  listLeaguesFull, searchFixtures, createMatchdayChallenge, createFantasyGame, listChallenges,
  setChallengeStatus, setChallengeVisibility, listFantasyGames, setFantasyStatus, setFantasyVisibility,
} from '../services/tournamentAdminService';
import { RichText } from './RichText';

const STATUSES = ['draft', 'open', 'running', 'resolved', 'cancelled'];
const LEVELS = ['Rookie', 'Rising', 'Pro', 'Elite', 'Legend', 'GOAT'];

// Auto-cost matrix: cost = tier base × duration multiplier (override possible).
const TIERS: [string, number][] = [['amateur', 2000], ['master', 10000], ['apex', 20000]];
const DURATIONS: [string, number][] = [['flash', 1], ['series', 2], ['season', 4]];
const TIER_BASE: Record<string, number> = Object.fromEntries(TIERS);
const DUR_MULT: Record<string, number> = Object.fromEntries(DURATIONS);
const computeCost = (tier: string, duration: string) => (TIER_BASE[tier] ?? 2000) * (DUR_MULT[duration] ?? 1);

/** Tier + Duration + auto/override cost. set() patches the parent form. */
function CostFields({ v, set }: { v: any; set: (patch: any) => void }) {
  const auto = computeCost(v.tier, v.duration);
  return (
    <>
      <Field label="Level (tier)">
        <select value={v.tier} onChange={e => set({ tier: e.target.value, ...(v.override ? {} : { entry_cost: computeCost(e.target.value, v.duration) }) })} className="inp capitalize">
          {TIERS.map(([t]) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="Duration">
        <select value={v.duration} onChange={e => set({ duration: e.target.value, ...(v.override ? {} : { entry_cost: computeCost(v.tier, e.target.value) }) })} className="inp capitalize">
          {DURATIONS.map(([d]) => <option key={d} value={d}>{d}</option>)}
        </select>
      </Field>
      <Field label={v.override ? 'Entry cost (custom)' : `Entry cost (auto: ${auto})`}>
        <div className="flex items-center gap-2">
          <input type="number" value={v.entry_cost} disabled={!v.override} onChange={e => set({ entry_cost: Number(e.target.value) })} className="inp disabled:opacity-50" />
          <label className="flex items-center gap-1 text-xs text-text-secondary whitespace-nowrap"><input type="checkbox" checked={v.override} onChange={e => set({ override: e.target.checked, ...(e.target.checked ? {} : { entry_cost: auto }) })} /> Override</label>
        </div>
      </Field>
    </>
  );
}

const statusColor = (s: string) =>
  s === 'open' ? 'bg-lime-glow/15 text-lime-glow' : s === 'running' ? 'bg-electric-blue/15 text-electric-blue'
  : s === 'resolved' ? 'bg-text-disabled/15 text-text-disabled' : s === 'cancelled' ? 'bg-hot-red/15 text-hot-red'
  : 'bg-warm-yellow/15 text-warm-yellow';

export default function GameBuilder() {
  const [comps, setComps] = useState<any[]>([]);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [fantasyGames, setFantasyGames] = useState<any[]>([]);
  const [leagues, setLeagues] = useState<any[]>([]);
  const [creating, setCreating] = useState<null | 'tq' | 'betting' | 'prediction' | 'fantasy'>(null);
  const [msg, setMsg] = useState('');
  const [manageId, setManageId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', league_api_id: 0, season: 2026, entry_cost: computeCost('amateur', 'season'), tier: 'amateur', duration: 'season', override: false, min_players: '', max_players: '', minimum_level: 'Rookie', is_visible: true, opens_at: '', rules_html: '' });

  const [leaguesById, setLeaguesById] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState({ type: 'all', league: 'all', tier: 'all', duration: 'all', status: 'all' });
  const [views, setViews] = useState<{ name: string; filters: any }[]>(() => { try { return JSON.parse(localStorage.getItem('gb_views') || '[]'); } catch { return []; } });

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 5000); };
  const reload = async () => { setComps(await listCompetitions()); setChallenges(await listChallenges()); setFantasyGames(await listFantasyGames()); };
  useEffect(() => { reload(); listSourceLeagues().then(setLeagues); listLeaguesFull().then(ls => setLeaguesById(Object.fromEntries(ls.map((l: any) => [l.id, l.name])))); }, []);

  const saveView = () => { const name = prompt('Save this view as:'); if (!name) return; const next = [...views.filter(v => v.name !== name), { name, filters }]; setViews(next); localStorage.setItem('gb_views', JSON.stringify(next)); };
  const deleteView = (name: string) => { const next = views.filter(v => v.name !== name); setViews(next); localStorage.setItem('gb_views', JSON.stringify(next)); };

  // tier/duration/league accessors per game type
  const keep = (type: string, tier: string, duration: string, leagueId: string | null, status: string) =>
    (filters.type === 'all' || filters.type === type) &&
    (filters.tier === 'all' || filters.tier === tier) &&
    (filters.duration === 'all' || filters.duration === duration) &&
    (filters.league === 'all' || filters.league === (leagueId || '')) &&
    (filters.status === 'all' || filters.status === (status || '').toLowerCase());
  const fComps = comps.filter(c => keep('tq', c.tier, c.duration_type, c.source_league_id, c.status));
  const fChallenges = challenges.filter(c => keep(c.game_type, c.rules?.tier, c.rules?.duration_type, c.source_league_id, c.status));
  const fFantasy = fantasyGames.filter(g => keep('fantasy', g.tier, g.duration_type, g.source_league_id, g.status));

  const submit = async () => {
    if (!form.name || !form.league_api_id) return flash('Name and source league are required');
    flash('Creating… (fetching groups from the API)');
    const { data, error } = await createFromLeague({
      name: form.name, league_api_id: Number(form.league_api_id), season: Number(form.season),
      entry_cost: Number(form.entry_cost) || 0,
      min_players: form.min_players ? Number(form.min_players) : null,
      max_players: form.max_players ? Number(form.max_players) : null,
      minimum_level: form.minimum_level, is_visible: form.is_visible,
      opens_at: form.opens_at || null, tier: form.tier, duration_type: form.duration,
    });
    if (error || !(data as any)?.ok) return flash(`Failed: ${error?.message || (data as any)?.error}`);
    if (form.rules_html) await updateCompetition((data as any).competition_id, { rules_html: form.rules_html });
    setCreating(null);
    setForm({ ...form, name: '', league_api_id: 0, rules_html: '' });
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
        <div className="flex flex-wrap gap-2">
          {([['tq', 'Tournament Quest', 'bg-electric-blue text-white'],
             ['betting', 'Match Day', 'bg-warm-yellow text-deep-navy'],
             ['prediction', 'Swipe', 'bg-neon-cyan text-deep-navy'],
             ['fantasy', 'Fantasy', 'bg-[#D500F9] text-white']] as const).map(([t, label, cls]) => (
            <button key={t} onClick={() => setCreating(creating === t ? null : t)}
              className={`px-3 py-2 rounded-lg font-semibold text-sm ${creating === t ? 'bg-surface-hover text-text-secondary' : cls}`}>
              {creating === t ? 'Cancel' : `+ ${label}`}
            </button>
          ))}
        </div>
      </div>
      {msg && <div className="bg-electric-blue/10 border border-electric-blue/30 text-electric-blue rounded-lg px-4 py-2 text-sm">{msg}</div>}

      {(creating === 'betting' || creating === 'prediction' || creating === 'fantasy') &&
        <MatchGameCreate gameType={creating} onCreated={() => { setCreating(null); reload(); }} flash={flash} />}

      {creating === 'tq' && (
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
          <CostFields v={form} set={patch => setForm({ ...form, ...patch })} />
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
          <div className="md:col-span-2">
            <span className="text-xs text-text-secondary">Rules</span>
            <div className="mt-1"><RichText value={form.rules_html} onChange={v => setForm({ ...form, rules_html: v })} placeholder="Tournament rules, scoring, prizes…" /></div>
          </div>
          <div className="md:col-span-2 flex items-center justify-between">
            <p className="text-xs text-text-disabled">Groups + bracket are auto‑detected from the league standings. Rewards: configured later (Reward Builder).</p>
            <button onClick={submit} className="bg-lime-glow text-deep-navy font-bold px-5 py-2 rounded-lg">Create</button>
          </div>
        </div>
      )}

      {/* Filters + saved views */}
      <div className="bg-surface border border-border-subtle rounded-xl p-3 flex flex-wrap items-center gap-2">
        <select value={filters.type} onChange={e => setFilters({ ...filters, type: e.target.value })} className="inp w-auto">
          <option value="all">All types</option>
          <option value="tq">Tournament Quest</option><option value="betting">Match Day</option>
          <option value="prediction">Swipe</option><option value="fantasy">Fantasy</option>
        </select>
        <select value={filters.league} onChange={e => setFilters({ ...filters, league: e.target.value })} className="inp w-auto">
          <option value="all">All leagues</option>
          {Object.entries(leaguesById).map(([id, n]) => <option key={id} value={id}>{n}</option>)}
        </select>
        <select value={filters.tier} onChange={e => setFilters({ ...filters, tier: e.target.value })} className="inp w-auto capitalize">
          <option value="all">All levels</option>{TIERS.map(([t]) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filters.duration} onChange={e => setFilters({ ...filters, duration: e.target.value })} className="inp w-auto capitalize">
          <option value="all">All durations</option>{DURATIONS.map(([d]) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })} className="inp w-auto">
          <option value="all">All statuses</option>{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="flex items-center gap-1 ml-auto">
          {views.map(v => (
            <span key={v.name} className="flex items-center gap-1 bg-background-dark rounded-lg pl-2 pr-1 py-1 text-xs">
              <button onClick={() => setFilters({ ...filters, ...v.filters })} className="text-electric-blue font-semibold">{v.name}</button>
              <button onClick={() => deleteView(v.name)} className="text-hot-red">×</button>
            </span>
          ))}
          <button onClick={() => setFilters({ type: 'all', league: 'all', tier: 'all', duration: 'all', status: 'all' })} className="text-text-disabled text-xs px-2">Reset</button>
          <button onClick={saveView} className="bg-electric-blue/15 text-electric-blue text-xs font-semibold px-2 py-1 rounded-lg">Save view</button>
        </div>
      </div>

      {/* Games list */}
      <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-text-disabled text-left border-b border-border-subtle">
            <tr><th className="px-4 py-3">Game</th><th>Type</th><th>Status</th><th>Entry</th><th>Players</th><th>Visible</th><th className="text-right pr-4">Actions</th></tr>
          </thead>
          <tbody>
            {fComps.map(c => (
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
            {fChallenges.map(c => (
              <tr key={c.id} className="border-b border-border-subtle/50">
                <td className="px-4 py-3 font-medium text-text-primary">{c.name || '(untitled)'}</td>
                <td className="text-text-secondary">{c.game_type === 'prediction' ? 'Swipe Prediction' : 'Match Day Challenge'} <span className="text-text-disabled text-xs">({c.rules?.period_type === 'calendar' ? 'calendar' : 'matchday'})</span></td>
                <td><span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(c.status)}`}>{c.status}</span></td>
                <td className="text-text-secondary">{c.entry_cost ?? 0}</td>
                <td className="text-text-secondary">{c.rules?.minimum_players ?? 0} / {c.rules?.maximum_players || '∞'}</td>
                <td>{c.is_visible === false ? <span className="text-text-disabled">Hidden</span> : <span className="text-lime-glow">Yes</span>}</td>
                <td className="text-right pr-4 whitespace-nowrap">
                  <select value={c.status} onChange={e => setChallengeStatus(c.id, e.target.value).then(reload)} className="inp inline-block w-28 mr-2">
                    {['draft', 'open', 'running', 'resolved', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={() => setChallengeVisibility(c.id, c.is_visible === false).then(reload)} className="text-electric-blue text-xs">{c.is_visible === false ? 'Show' : 'Hide'}</button>
                </td>
              </tr>
            ))}
            {fFantasy.map(g => (
              <tr key={g.id} className="border-b border-border-subtle/50">
                <td className="px-4 py-3 font-medium text-text-primary">{g.name || '(untitled)'}</td>
                <td className="text-text-secondary">Sportime Fantasy</td>
                <td><span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(g.status?.toLowerCase())}`}>{g.status}</span></td>
                <td className="text-text-secondary">{g.entry_cost ?? 0}</td>
                <td className="text-text-secondary">{g.min_players ?? '—'} / {g.max_players ?? '∞'}</td>
                <td>{g.is_visible === false ? <span className="text-text-disabled">Hidden</span> : <span className="text-lime-glow">Yes</span>}</td>
                <td className="text-right pr-4 whitespace-nowrap">
                  <select value={g.status} onChange={e => setFantasyStatus(g.id, e.target.value).then(reload)} className="inp inline-block w-28 mr-2">
                    {['Upcoming', 'Ongoing', 'Finished', 'Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={() => setFantasyVisibility(g.id, g.is_visible === false).then(reload)} className="text-electric-blue text-xs">{g.is_visible === false ? 'Show' : 'Hide'}</button>
                </td>
              </tr>
            ))}
            {fComps.length === 0 && fChallenges.length === 0 && fFantasy.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-text-disabled">No games yet. Create one above.</td></tr>}
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

const GAME_LABELS: Record<string, string> = { betting: 'Match Day Challenge', prediction: 'Swipe Prediction', fantasy: 'Sportime Fantasy' };

function MatchGameCreate({ gameType, onCreated, flash }: { gameType: 'betting' | 'prediction' | 'fantasy'; onCreated: () => void; flash: (m: string) => void }) {
  const [leagues, setLeagues] = useState<any[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set()); // league ids
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [f, setF] = useState({ name: '', mode: 'matchdays', entry_cost: computeCost('amateur', 'flash'), tier: 'amateur', duration: 'flash', override: false, min_players: '', max_players: '', minimum_level: 'Rookie', is_visible: true, rules_html: '' });

  useEffect(() => { listLeaguesFull().then(setLeagues); }, []);
  const toggleLeague = (id: string) => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const search = async () => {
    if (sel.size === 0) return flash('Pick at least one league');
    setFixtures(await searchFixtures([...sel], from, to));
  };
  const togglePick = (id: string) => setPicked(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const submit = async () => {
    if (!f.name || picked.size === 0) return flash('Name and at least one match are required');
    const payload = {
      name: f.name, league_ids: [...sel], fixture_ids: [...picked], mode: f.mode,
      entry_cost: Number(f.entry_cost) || 0, min_players: Number(f.min_players) || 0,
      max_players: Number(f.max_players) || 0, minimum_level: f.minimum_level, is_visible: f.is_visible,
      rules_html: f.rules_html || null, tier: f.tier, duration_type: f.duration,
    };
    const { data, error } = gameType === 'fantasy'
      ? await createFantasyGame(payload)
      : await createMatchdayChallenge({ ...payload, game_type: gameType });
    if (error || !(data as any)?.ok) return flash(`Failed: ${error?.message || (data as any)?.error}`);
    const d = data as any;
    flash(`Created: ${d.gameweeks ?? d.matchdays} ${gameType === 'fantasy' ? 'gameweeks' : 'matchdays'}, ${d.fixtures} matches (${d.mode})`);
    onCreated();
  };

  return (
    <div className="bg-surface border border-border-subtle rounded-xl p-5 space-y-4">
      <h3 className="font-bold text-text-primary">New {GAME_LABELS[gameType]}</h3>
      <div className="grid md:grid-cols-3 gap-3">
        <Field label="Name"><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} className="inp" /></Field>
        <Field label="From"><input type="date" value={from} onChange={e => setFrom(e.target.value)} className="inp" /></Field>
        <Field label="To"><input type="date" value={to} onChange={e => setTo(e.target.value)} className="inp" /></Field>
      </div>
      <Field label="Leagues (one or more)">
        <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
          {leagues.map(l => (
            <button key={l.id} onClick={() => toggleLeague(l.id)} className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${sel.has(l.id) ? 'border-electric-blue bg-electric-blue/10 text-electric-blue' : 'border-border-subtle text-text-secondary'}`}>{l.name}</button>
          ))}
        </div>
      </Field>
      <button onClick={search} className="bg-electric-blue text-white px-4 py-2 rounded-lg text-sm font-semibold">Search matches</button>

      {fixtures.length > 0 && (
        <div className="border border-border-subtle rounded-lg max-h-72 overflow-y-auto">
          {fixtures.map(fx => (
            <button key={fx.id} onClick={() => togglePick(fx.id)} className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm border-b border-border-subtle/40 ${picked.has(fx.id) ? 'bg-electric-blue/10' : ''}`}>
              <input type="checkbox" readOnly checked={picked.has(fx.id)} />
              <span className="text-text-disabled text-xs w-32">{new Date(fx.date).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              <span className="text-text-primary flex-1">{fx.home_team?.name} – {fx.away_team?.name}</span>
              <span className="text-text-disabled text-xs">{fx.round}</span>
            </button>
          ))}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-3">
        <Field label="Mode">
          <select value={f.mode} onChange={e => setF({ ...f, mode: e.target.value })} className="inp">
            <option value="matchdays">Matchday (bet on the whole matchday)</option>
            <option value="calendar">Calendar (one bet per day)</option>
          </select>
        </Field>
        <Field label="Min level"><select value={f.minimum_level} onChange={e => setF({ ...f, minimum_level: e.target.value })} className="inp">{LEVELS.map(l => <option key={l}>{l}</option>)}</select></Field>
        <CostFields v={f} set={patch => setF({ ...f, ...patch })} />
        <Field label="Min players"><input type="number" value={f.min_players} onChange={e => setF({ ...f, min_players: e.target.value })} className="inp" /></Field>
        <Field label="Max players"><input type="number" value={f.max_players} onChange={e => setF({ ...f, max_players: e.target.value })} className="inp" /></Field>
        <label className="flex items-center gap-2 text-sm text-text-secondary mt-5"><input type="checkbox" checked={f.is_visible} onChange={e => setF({ ...f, is_visible: e.target.checked })} /> Visible in app</label>
      </div>
      <div>
        <span className="text-xs text-text-secondary">Rules</span>
        <div className="mt-1"><RichText value={f.rules_html} onChange={v => setF({ ...f, rules_html: v })} placeholder="Game rules, scoring, prizes…" /></div>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-disabled">{picked.size} match(es) selected.</p>
        <button onClick={submit} className="bg-lime-glow text-deep-navy font-bold px-5 py-2 rounded-lg">Create {GAME_LABELS[gameType]}</button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs text-text-secondary">{label}</span><div className="mt-1">{children}</div></label>;
}
