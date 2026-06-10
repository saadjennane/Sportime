import { useEffect, useState } from 'react';
import {
  getPuzzleConfig, updatePuzzleConfig, listPopularity, updatePopularity, recomputePopularity,
  listPuzzleGames, getPuzzleRounds, generatePuzzles, reschedulePuzzle, deletePuzzleGame,
} from '../services/puzzleAdminService';

const LEVELS = ['big', 'all'];
const lvlColor = (d: number) => d == null ? 'bg-surface-hover text-text-secondary' : d < 33 ? 'bg-lime-glow/15 text-lime-glow' : d < 66 ? 'bg-warm-yellow/15 text-warm-yellow' : 'bg-hot-red/15 text-hot-red';

export function PuzzlePage() {
  const [tab, setTab] = useState<'calendar' | 'popularity' | 'config'>('calendar');
  const [msg, setMsg] = useState('');
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 4000); };
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold text-text-primary mb-1">Daily Puzzles</h1>
        <p className="text-text-secondary">Guess the Score — calendar, difficulty, popularity, prizes.</p>
      </div>
      {msg && <div className="bg-electric-blue/10 border border-electric-blue/30 text-electric-blue rounded-lg px-4 py-2 text-sm">{msg}</div>}
      <div className="flex gap-2 border-b border-border-subtle">
        {(['calendar', 'popularity', 'config'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-semibold capitalize ${tab === t ? 'text-electric-blue border-b-2 border-electric-blue' : 'text-text-secondary'}`}>{t}</button>
        ))}
      </div>
      {tab === 'calendar' && <Calendar flash={flash} />}
      {tab === 'popularity' && <Popularity flash={flash} />}
      {tab === 'config' && <Config flash={flash} />}
    </div>
  );
}

function Calendar({ flash }: { flash: (m: string) => void }) {
  const [level, setLevel] = useState('big');
  const [games, setGames] = useState<any[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [rounds, setRounds] = useState<any[]>([]);
  const [count, setCount] = useState(30);
  const [start, setStart] = useState('');
  const reload = () => listPuzzleGames(level).then(setGames);
  useEffect(() => { reload(); }, [level]);
  const view = async (id: string) => { if (open === id) { setOpen(null); return; } setOpen(id); setRounds(await getPuzzleRounds(id)); };
  const gen = async () => {
    if (!start) return flash('Pick a start date');
    const { data, error } = await generatePuzzles(level, count, start);
    flash(error ? error.message : `Generated ${data} games`); reload();
  };
  const move = async (id: string, date: string) => { const { error } = await reschedulePuzzle(id, date); flash(error ? error.message : 'Rescheduled (calendar shifted)'); reload(); };
  const del = async (id: string) => { await deletePuzzleGame(id); reload(); };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 bg-surface border border-border-subtle rounded-xl p-4">
        <div><span className="text-xs text-text-secondary">Level</span>
          <select value={level} onChange={e => setLevel(e.target.value)} className="inp mt-1 w-32">{LEVELS.map(l => <option key={l}>{l}</option>)}</select></div>
        <div><span className="text-xs text-text-secondary">Generate count</span><input type="number" value={count} onChange={e => setCount(+e.target.value)} className="inp mt-1 w-24" /></div>
        <div><span className="text-xs text-text-secondary">Start date</span><input type="date" value={start} onChange={e => setStart(e.target.value)} className="inp mt-1" /></div>
        <button onClick={gen} className="bg-lime-glow text-deep-navy font-bold px-4 py-2 rounded-lg">Generate</button>
      </div>

      <div className="bg-surface border border-border-subtle rounded-xl divide-y divide-border-subtle/50">
        {games.map(g => (
          <div key={g.id}>
            <div className="flex items-center justify-between px-4 py-2.5 text-sm">
              <button onClick={() => view(g.id)} className="flex items-center gap-3 text-left flex-1">
                <span className="text-text-disabled w-8">#{g.seq}</span>
                <span className="font-semibold text-text-primary">{g.puzzle_date}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${lvlColor(g.difficulty_score)}`}>diff {g.difficulty_score}</span>
              </button>
              <div className="flex items-center gap-2">
                <input type="date" defaultValue={g.puzzle_date} onChange={e => move(g.id, e.target.value)} className="inp !py-1 text-xs" title="Move (shifts following days)" />
                <button onClick={() => del(g.id)} className="text-hot-red text-xs">Del</button>
              </div>
            </div>
            {open === g.id && (
              <div className="px-4 pb-3 space-y-1">
                {rounds.map(r => (
                  <div key={r.round_no} className="text-xs text-text-secondary flex justify-between">
                    <span>R{r.round_no}: <b className="text-text-primary">{r.home_name} {r.answer_home}-{r.answer_away} {r.away_name}</b></span>
                    <span>{r.competition_name} · {r.stage} · {r.match_date} (diff {r.difficulty_score})</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {games.length === 0 && <p className="px-4 py-6 text-center text-text-disabled text-sm">No games for {level}. Generate some above.</p>}
      </div>
    </div>
  );
}

function Popularity({ flash }: { flash: (m: string) => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const reload = () => listPopularity().then(setRows);
  useEffect(() => { reload(); }, []);
  const save = async (id: number, v: number) => { await updatePopularity(id, v); };
  const recompute = async () => { const { error } = await recomputePopularity(); flash(error ? error.message : 'Recomputed from standings (manual kept)'); reload(); };
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-text-secondary text-sm">Higher popularity → easier matches. Editing marks a team as manual (kept on recompute).</p>
        <button onClick={recompute} className="bg-electric-blue text-white px-3 py-1.5 rounded-lg text-sm font-semibold">Recompute defaults</button>
      </div>
      <div className="grid md:grid-cols-2 gap-2">
        {rows.map(t => (
          <div key={t.team_api_id} className="flex items-center justify-between bg-surface border border-border-subtle rounded-lg px-3 py-2">
            <span className="text-text-primary text-sm">{t.team_name} {t.is_manual && <span className="text-[10px] text-warm-yellow">✎</span>}</span>
            <input type="number" defaultValue={t.popularity} onBlur={e => save(t.team_api_id, +e.target.value)} className="inp !py-1 w-20 text-right" />
          </div>
        ))}
      </div>
    </div>
  );
}

function Config({ flash }: { flash: (m: string) => void }) {
  const [c, setC] = useState<any>(null);
  useEffect(() => { getPuzzleConfig().then(setC); }, []);
  if (!c) return null;
  const save = async () => {
    const { error } = await updatePuzzleConfig({
      pop_floor_big: +c.pop_floor_big, pop_floor_all: +c.pop_floor_all,
      max_attempts: +c.max_attempts, freeze_every_days: +c.freeze_every_days, max_freezes: +c.max_freezes,
      daily_cutover_hour: +c.daily_cutover_hour, prize_enabled: c.prize_enabled, prize_pot_default: +c.prize_pot_default, prize_top_pct: +c.prize_top_pct,
      monthly_milestones: typeof c.monthly_milestones === 'string' ? JSON.parse(c.monthly_milestones) : c.monthly_milestones,
    });
    flash(error ? error.message : 'Config saved');
  };
  const F = ({ k, label }: { k: string; label: string }) => (
    <label className="block"><span className="text-xs text-text-secondary">{label}</span>
      <input type="number" value={c[k]} onChange={e => setC({ ...c, [k]: e.target.value })} className="inp mt-1" /></label>
  );
  return (
    <div className="space-y-5">
      <Section title="Match scope — popularity floors (0-100)"><F k="pop_floor_big" label="Only big teams (floor)" /><F k="pop_floor_all" label="All teams (floor)" /></Section>
      <Section title="Gameplay"><F k="max_attempts" label="Max attempts / round (0 = unlimited)" /><F k="freeze_every_days" label="Freeze every N days" /><F k="max_freezes" label="Max freezes" /><F k="daily_cutover_hour" label="Daily cutover hour" /></Section>
      <Section title="Daily prize">
        <label className="flex items-center gap-2 text-sm text-text-secondary mt-6"><input type="checkbox" checked={c.prize_enabled} onChange={e => setC({ ...c, prize_enabled: e.target.checked })} /> Enabled</label>
        <F k="prize_pot_default" label="Pot (coins)" /><F k="prize_top_pct" label="Top % share" />
      </Section>
      <div className="bg-surface border border-border-subtle rounded-xl p-4">
        <span className="text-xs text-text-secondary">Monthly milestones (JSON)</span>
        <textarea value={typeof c.monthly_milestones === 'string' ? c.monthly_milestones : JSON.stringify(c.monthly_milestones, null, 1)}
          onChange={e => setC({ ...c, monthly_milestones: e.target.value })} className="inp mt-1 font-mono text-xs" rows={5} />
      </div>
      <button onClick={save} className="bg-lime-glow text-deep-navy font-bold px-5 py-2 rounded-lg">Save config</button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border-subtle rounded-xl p-4">
      <h3 className="font-bold text-text-primary mb-3">{title}</h3>
      <div className="grid md:grid-cols-4 gap-3">{children}</div>
    </div>
  );
}
