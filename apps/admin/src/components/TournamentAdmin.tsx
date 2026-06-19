import { useEffect, useState } from 'react';
import {
  listCompetitions, createCompetition, updateCompetition, getCompetitionDetail,
  importGroups, setFinalRank, updateMatch, setPhaseState,
  generateBracket, advanceRound, resolveCompetition, seedContent,
} from '../services/tournamentAdminService';

const STATUSES = ['draft', 'open', 'running', 'resolved', 'archived'];

export default function TournamentAdmin() {
  const [comps, setComps] = useState<any[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [msg, setMsg] = useState<string>('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', start_date: '', end_date: '', entry_cost: 0 });

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 4000); };
  const reloadList = async () => setComps(await listCompetitions());
  const reloadDetail = async () => { if (selId) setDetail(await getCompetitionDetail(selId)); };
  useEffect(() => { reloadList(); }, []);
  useEffect(() => { reloadDetail(); }, [selId]);

  const onCreate = async () => {
    if (!form.name || !form.slug) return flash('Name + slug required');
    const { error, data } = await createCompetition({
      name: form.name, slug: form.slug,
      start_date: form.start_date || null, end_date: form.end_date || null, entry_cost: Number(form.entry_cost) || 0,
    });
    if (error) return flash(error.message);
    setCreating(false); setForm({ name: '', slug: '', start_date: '', end_date: '', entry_cost: 0 });
    await reloadList(); if (data) setSelId(data.id);
    flash('Competition created');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Tournament Quest</h1>
        <p className="text-gray-600">Create and run any cup/tournament — groups + knockout, fully config-driven.</p>
      </div>
      {msg && <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-4 py-2 text-sm">{msg}</div>}

      {/* Competitions list + create */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-bold text-gray-900">Competitions</h2>
          <button onClick={() => setCreating(v => !v)} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-semibold">{creating ? 'Cancel' : '+ New'}</button>
        </div>
        {creating && (
          <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
            <input placeholder="Name (e.g. World Cup 2026)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-') })} className="border rounded px-3 py-2 col-span-2" />
            <input placeholder="slug" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} className="border rounded px-3 py-2 col-span-2" />
            <label className="text-xs text-gray-500">Start<input type="datetime-local" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} className="border rounded px-2 py-1.5 w-full" /></label>
            <label className="text-xs text-gray-500">End<input type="datetime-local" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} className="border rounded px-2 py-1.5 w-full" /></label>
            <label className="text-xs text-gray-500">Entry cost<input type="number" value={form.entry_cost} onChange={e => setForm({ ...form, entry_cost: Number(e.target.value) })} className="border rounded px-2 py-1.5 w-full" /></label>
            <button onClick={onCreate} className="bg-green-600 text-white rounded-lg font-semibold col-span-2 py-2">Create</button>
          </div>
        )}
        <div className="space-y-1">
          {comps.map(c => (
            <button key={c.id} onClick={() => setSelId(c.id)} className={`w-full flex justify-between items-center px-3 py-2 rounded-lg text-left ${selId === c.id ? 'bg-blue-50 border border-blue-300' : 'hover:bg-gray-50'}`}>
              <span className="font-medium text-gray-900">{c.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${c.status === 'open' ? 'bg-green-100 text-green-700' : c.status === 'resolved' ? 'bg-gray-200 text-gray-600' : 'bg-yellow-100 text-yellow-700'}`}>{c.status}</span>
            </button>
          ))}
        </div>
      </div>

      {detail?.comp && <CompetitionEditor detail={detail} onChange={async () => { await reloadDetail(); await reloadList(); }} flash={flash} />}
    </div>
  );
}

function CompetitionEditor({ detail, onChange, flash }: { detail: any; onChange: () => void; flash: (m: string) => void }) {
  const { comp, format, groups, groupTeams, matches, windows } = detail;
  const [importText, setImportText] = useState('');

  const teamsByGroup = (gid: string) => groupTeams.filter((gt: any) => gt.group_id === gid);
  const rounds: string[] = format?.knockout_rounds ?? [];

  const doImport = async () => {
    // "Group A: Morocco(MAR), Spain(ESP), France, Brazil" — one line per group
    const spec = importText.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
      const [head, rest] = line.split(':');
      const teams = (rest ?? '').split(',').map(t => t.trim()).filter(Boolean).map(t => {
        const m = t.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
        return m ? { name: m[1].trim(), short: m[2].trim() } : { name: t };
      });
      return { name: head.trim(), qualified: 2, teams };
    });
    const { data, error } = await importGroups(comp.id, spec);
    if (error) return flash(error.message);
    setImportText(''); onChange(); flash(`Imported ${(data as any)?.groups} groups / ${(data as any)?.teams} teams`);
  };

  const setStatus = async (s: string) => { await updateCompetition(comp.id, { status: s }); onChange(); };
  const act = async (fn: () => Promise<any>, label: string) => {
    const { data, error } = await fn();
    if (error) return flash(error.message);
    flash(`${label}: ${JSON.stringify(data)}`); onChange();
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{comp.name}</h2>
          <p className="text-sm text-gray-500">{format?.groups_count} groups · {format?.knockout_participants} qualify · {(rounds).join(' → ')}</p>
        </div>
        <select value={comp.status} onChange={e => setStatus(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm">
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Import groups */}
      {groups.length === 0 ? (
        <Section title="1 · Import groups & teams">
          <p className="text-xs text-gray-500 mb-2">One line per group: <code>Group A: Morocco(MAR), Spain(ESP), France(FRA), Brazil(BRA)</code></p>
          <textarea value={importText} onChange={e => setImportText(e.target.value)} rows={6} className="w-full border rounded-lg p-3 font-mono text-sm" placeholder={'Group A: Morocco(MAR), Spain(ESP), France(FRA), Brazil(BRA)\nGroup B: ...'} />
          <button onClick={doImport} className="mt-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">Import</button>
        </Section>
      ) : (
        <Section title={`Groups & standings (${groups.length})`}>
          <p className="text-xs text-gray-500 mb-2">Set the final rank of each team to resolve the group stage.</p>
          <div className="grid md:grid-cols-2 gap-3">
            {groups.map((g: any) => (
              <div key={g.id} className="border rounded-lg p-3">
                <p className="font-semibold text-gray-900 mb-2">{g.name} <span className="text-xs text-gray-400">(top {g.qualified_count})</span></p>
                {teamsByGroup(g.id).map((gt: any) => (
                  <div key={gt.id} className="flex items-center justify-between py-1">
                    <span className="text-sm text-gray-700">{gt.team?.name}</span>
                    <select value={gt.final_rank ?? ''} onChange={async e => { await setFinalRank(gt.id, e.target.value ? Number(e.target.value) : null); onChange(); }} className="border rounded px-2 py-1 text-sm">
                      <option value="">—</option>{[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Bracket actions */}
      <Section title="Bracket & scoring actions">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => {
            const lg = prompt('League api id to seed matches (e.g. 1 = World Cup). Leave blank to seed players only:', '');
            const sn = lg ? prompt('Season (e.g. 2026):', '2026') : '';
            act(() => seedContent(comp.id, lg ? Number(lg) : null, sn ? Number(sn) : null), 'Seed content');
          }} className="bg-amber-600 text-white px-3 py-2 rounded-lg text-sm font-semibold">Seed content (players + matches)</button>
          <button onClick={() => act(() => generateBracket(comp.id), 'Generate bracket')} className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-semibold">Generate bracket</button>
          {rounds.map(r => (
            <button key={r} onClick={() => act(() => advanceRound(comp.id, r), `Advance ${r}`)} className="bg-indigo-100 text-indigo-700 px-3 py-2 rounded-lg text-sm font-semibold">Advance {r} →</button>
          ))}
          <button onClick={() => act(() => resolveCompetition(comp.id), 'Resolve')} className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-semibold ml-auto">Resolve & recalc scores</button>
        </div>
      </Section>

      {/* Phases */}
      <Section title="Prediction phases">
        <div className="flex flex-wrap gap-2">
          {['long_term', 'group', ...rounds].map(p => {
            const w = windows.find((x: any) => x.phase_key === p);
            const state = w?.state ?? 'open';
            return (
              <div key={p} className="flex items-center gap-2 border rounded-lg px-3 py-1.5">
                <span className="text-sm font-medium text-gray-700">{p}</span>
                <select value={state} onChange={async e => { await setPhaseState(comp.id, p, e.target.value); onChange(); }} className="border rounded px-2 py-1 text-xs">
                  {['open', 'locked', 'resolved'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Matches */}
      <Section title={`Matches (${matches.length})`}>
        <div className="space-y-2">
          {matches.map((m: any) => <MatchRow key={m.id} m={m} onChange={onChange} flash={flash} />)}
          {matches.length === 0 && <p className="text-sm text-gray-400">No matches yet. Generate the bracket or add an official match via the DB.</p>}
        </div>
      </Section>
    </div>
  );
}

function MatchRow({ m, onChange, flash }: { m: any; onChange: () => void; flash: (s: string) => void }) {
  const [a, setA] = useState<string>(m.score_a ?? '');
  const [b, setB] = useState<string>(m.score_b ?? '');
  const save = async () => {
    const sa = a === '' ? null : Number(a), sb = b === '' ? null : Number(b);
    const patch: any = { score_a: sa, score_b: sb };
    if (sa != null && sb != null) {
      patch.status = 'finished';
      patch.winner_team_id = sa > sb ? m.team_a_id : sa < sb ? m.team_b_id : null;
    }
    const { error } = await updateMatch(m.id, patch);
    if (error) return flash(error.message);
    onChange(); flash('Match saved');
  };
  return (
    <div className="flex items-center gap-2 border rounded-lg px-3 py-2 text-sm">
      <span className="text-xs text-gray-400 w-20">{m.knockout_round ?? (m.is_official_quest_match ? 'official' : 'group')}</span>
      <span className="flex-1 text-right text-gray-800">{m.team_a?.name ?? '—'}</span>
      <input value={a} onChange={e => setA(e.target.value)} className="w-10 border rounded px-1 py-0.5 text-center" />
      <span className="text-gray-400">-</span>
      <input value={b} onChange={e => setB(e.target.value)} className="w-10 border rounded px-1 py-0.5 text-center" />
      <span className="flex-1 text-gray-800">{m.team_b?.name ?? '—'}</span>
      <button onClick={save} className="bg-gray-800 text-white px-2.5 py-1 rounded text-xs font-semibold">Save</button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><h3 className="font-semibold text-gray-800 mb-2 text-sm uppercase tracking-wide">{title}</h3>{children}</div>;
}
