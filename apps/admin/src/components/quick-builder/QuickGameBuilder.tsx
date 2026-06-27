import { useEffect, useMemo, useState } from 'react';
import { X, ChevronLeft, Check, Target, Hand, Gamepad2, Trophy, Flag, Swords, Crown, Loader2 } from 'lucide-react';
import {
  listLeaguesFull, searchFixtures, createMatchdayChallenge, setChallengeStatus,
  createFantasyGame, setFantasyStatus,
} from '../../services/tournamentAdminService';
import { listRewardPacks, assignPackToGame } from '../../services/rewardService';
import F1GameWizard, { type F1Format } from './F1GameWizard';

// ── Defaults engine ─────────────────────────────────────────────────────────
const TIERS: [string, number][] = [['amateur', 2000], ['master', 10000], ['apex', 20000]];
const TIER_BASE: Record<string, number> = Object.fromEntries(TIERS);
const DUR_MULT: Record<string, number> = { flash: 1, series: 2, season: 4 };
const LEVELS = ['Rookie', 'Rising', 'Pro', 'Elite', 'Legend', 'GOAT'];
const computeCost = (tier: string, duration: string) => (TIER_BASE[tier] ?? 2000) * (DUR_MULT[duration] ?? 1);
// Duration inferred from how many rounds/days are selected.
const inferDuration = (n: number) => (n <= 1 ? 'flash' : n <= 3 ? 'series' : 'season');

const today = () => new Date().toISOString().slice(0, 10);
const roundShort = (round: string) => { const m = String(round || '').match(/(\d+)\s*$/); return m ? `MD${m[1]}` : (round || 'Round'); };
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

type Format = 'pickem' | 'swipe' | 'fantasy';
type TwinFormat = 'pickem' | 'swipe';
const GAME_TYPE: Record<TwinFormat, 'betting' | 'prediction'> = { pickem: 'betting', swipe: 'prediction' };
const TWIN: Record<TwinFormat, TwinFormat> = { pickem: 'swipe', swipe: 'pickem' };
const LABEL: Record<Format, string> = { pickem: "Pick'em", swipe: 'Swipe', fantasy: 'Fantasy' };
const hasTwin = (f: Format): f is TwinFormat => f === 'pickem' || f === 'swipe';

interface Props { onClose: () => void; onCreated: () => void; flash: (m: string) => void; }

type Selection = { sport: 'football'; format: Format } | { sport: 'f1'; format: F1Format };

export default function QuickGameBuilder({ onClose, onCreated, flash }: Props) {
  const [sel, setSel] = useState<Selection | null>(null);

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center bg-black/60 p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-surface border border-border-subtle rounded-2xl shadow-2xl w-full max-w-2xl my-8" onClick={e => e.stopPropagation()}>
        {!sel
          ? <Launcher onPick={setSel} onClose={onClose} />
          : sel.sport === 'football'
            ? <Wizard key={`fb-${sel.format}`} format={sel.format} onBack={() => setSel(null)} onClose={onClose} onCreated={onCreated} flash={flash} />
            : <F1GameWizard key={`f1-${sel.format}`} format={sel.format} onBack={() => setSel(null)} onClose={onClose} onCreated={onCreated} flash={flash} />}
      </div>
    </div>
  );
}

// ── Launcher: choose the sport + game type ───────────────────────────────────
function Launcher({ onPick, onClose }: { onPick: (s: Selection) => void; onClose: () => void }) {
  const [sport, setSport] = useState<'football' | 'f1'>('football');
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-text-primary">New game</h2>
        <button onClick={onClose} className="text-text-secondary hover:text-text-primary"><X size={20} /></button>
      </div>

      <div className="flex gap-1 bg-background-dark border border-border-subtle rounded-lg p-1 w-fit mb-5">
        {(['football', 'f1'] as const).map(s => (
          <button key={s} onClick={() => setSport(s)}
            className={`px-4 py-1.5 text-sm font-semibold rounded-md ${sport === s ? 'bg-electric-blue text-white' : 'text-text-secondary'}`}>
            {s === 'f1' ? 'F1' : 'Football'}
          </button>
        ))}
      </div>

      {sport === 'football' ? (
        <>
          <p className="text-xs uppercase tracking-wide text-text-disabled font-semibold mb-2">On a matchday</p>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <TypeCard icon={<Target size={22} />} title="Pick'em" desc="Predict results of a round" onClick={() => onPick({ sport: 'football', format: 'pickem' })} />
            <TypeCard icon={<Hand size={22} />} title="Swipe" desc="Same matches, swiped" onClick={() => onPick({ sport: 'football', format: 'swipe' })} />
            <TypeCard icon={<Gamepad2 size={22} />} title="Fantasy" desc="Build a squad" onClick={() => onPick({ sport: 'football', format: 'fantasy' })} />
          </div>
          <p className="text-xs uppercase tracking-wide text-text-disabled font-semibold mb-2">On a tournament</p>
          <div className="grid grid-cols-3 gap-3">
            <TypeCard icon={<Trophy size={22} />} title="Tournament Quest" desc="Predict a whole tournament" soon />
          </div>
        </>
      ) : (
        <>
          <p className="text-xs uppercase tracking-wide text-text-disabled font-semibold mb-2">On a race</p>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <TypeCard icon={<Flag size={22} />} title="GP Predictor" desc="Predict one or more GPs" onClick={() => onPick({ sport: 'f1', format: 'predictor' })} />
            <TypeCard icon={<Swords size={22} />} title="Teammates Duels" desc="Driver vs teammate" onClick={() => onPick({ sport: 'f1', format: 'duels' })} />
            <TypeCard icon={<Gamepad2 size={22} />} title="Fantasy F1" desc="Build a grid" onClick={() => onPick({ sport: 'f1', format: 'fantasy' })} />
          </div>
          <p className="text-xs uppercase tracking-wide text-text-disabled font-semibold mb-2">Across a season</p>
          <div className="grid grid-cols-3 gap-3">
            <TypeCard icon={<Crown size={22} />} title="Season Forecast" desc="Predict the championship" onClick={() => onPick({ sport: 'f1', format: 'season' })} />
          </div>
        </>
      )}
    </div>
  );
}

function TypeCard({ icon, title, desc, onClick, soon }: { icon: any; title: string; desc: string; onClick?: () => void; soon?: boolean }) {
  return (
    <button onClick={onClick} disabled={soon}
      className={`text-left border rounded-xl p-3 transition-colors ${soon ? 'border-border-subtle opacity-40 cursor-default' : 'border-border-subtle hover:border-electric-blue hover:bg-surface-hover'}`}>
      <div className="text-electric-blue mb-2">{icon}</div>
      <p className="font-bold text-text-primary text-sm">{title}{soon && <span className="ml-1 text-[10px] text-text-disabled font-normal">soon</span>}</p>
      <p className="text-xs text-text-secondary mt-0.5">{desc}</p>
    </button>
  );
}

// ── Wizard: 3 steps ──────────────────────────────────────────────────────────
function Wizard({ format, onBack, onClose, onCreated, flash }: { format: Format } & Omit<Props, never> & { onBack: () => void }) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // data
  const [leagues, setLeagues] = useState<any[]>([]);
  const [packs, setPacks] = useState<any[]>([]);

  // step 1
  const [leagueId, setLeagueId] = useState('');
  const [mode, setMode] = useState<'matchdays' | 'calendar'>('matchdays');
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [loadingFx, setLoadingFx] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [name, setName] = useState('');
  const [nameEdited, setNameEdited] = useState(false);

  // step 2
  const [tier, setTier] = useState('amateur');
  const [override, setOverride] = useState(false);
  const [entryCost, setEntryCost] = useState(computeCost('amateur', 'flash'));
  const [packId, setPackId] = useState('');
  const [packTouched, setPackTouched] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [minLevel, setMinLevel] = useState('Rookie');
  const [requiresSub, setRequiresSub] = useState(false);
  const [minPlayers, setMinPlayers] = useState('');
  const [maxPlayers, setMaxPlayers] = useState('');

  // step 3
  const [alsoCreateTwin, setAlsoCreateTwin] = useState(false);

  useEffect(() => { listLeaguesFull().then(setLeagues); listRewardPacks().then(setPacks); }, []);

  // Fetch remaining fixtures whenever the league changes.
  useEffect(() => {
    if (!leagueId) { setFixtures([]); return; }
    setLoadingFx(true);
    searchFixtures([leagueId], today(), '').then(fx => { setFixtures(fx); setLoadingFx(false); });
  }, [leagueId]);

  // Group fixtures into rounds (matchdays) or calendar days, ordered by date.
  const groups = useMemo(() => {
    const m = new Map<string, { key: string; date: string; fixtures: any[] }>();
    for (const f of fixtures) {
      const key = mode === 'calendar' ? String(f.date).slice(0, 10) : (f.round ?? 'Round');
      if (!m.has(key)) m.set(key, { key, date: f.date, fixtures: [] });
      const g = m.get(key)!; g.fixtures.push(f); if (f.date < g.date) g.date = f.date;
    }
    return [...m.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [fixtures, mode]);

  // Default selection: the earliest group, all its matches checked.
  useEffect(() => {
    if (groups.length === 0) { setPicked(new Set()); return; }
    setPicked(new Set(groups[0].fixtures.map(f => f.id)));
  }, [groups]);

  // Count selected rounds/days → drives duration → drives auto cost.
  const selectedGroupCount = useMemo(
    () => groups.filter(g => g.fixtures.some(f => picked.has(f.id))).length,
    [groups, picked]);
  const duration = inferDuration(selectedGroupCount);

  // Recompute auto cost when tier/duration change (unless overridden).
  useEffect(() => { if (!override) setEntryCost(computeCost(tier, duration)); }, [tier, duration, override]);

  // Auto-match a reward pack to the tier (until the admin picks one).
  useEffect(() => {
    if (packTouched) return;
    const match = packs.find(p => (p.name || '').toLowerCase().includes(tier));
    setPackId(match?.id ?? '');
  }, [tier, packs, packTouched]);

  // Auto-name from league + selection (until edited).
  const autoName = useMemo(() => {
    const lg = leagues.find(l => l.id === leagueId)?.name ?? 'League';
    const sel = groups.filter(g => g.fixtures.some(f => picked.has(f.id)));
    let scope = '…';
    if (sel.length === 1) scope = mode === 'calendar' ? fmtDay(sel[0].date) : roundShort(sel[0].key);
    else if (sel.length > 1) scope = mode === 'calendar' ? `${sel.length} days` : `${sel.length} rounds`;
    const suffix = format === 'swipe' ? ' (Swipe)' : format === 'fantasy' ? ' (Fantasy)' : '';
    return `${lg} — ${scope}${suffix}`;
  }, [leagues, leagueId, groups, picked, mode, format]);
  useEffect(() => { if (!nameEdited) setName(autoName); }, [autoName, nameEdited]);

  // Selection helpers
  const toggleFixture = (id: string) => setPicked(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const groupState = (g: { fixtures: any[] }) => {
    const inSel = g.fixtures.filter(f => picked.has(f.id)).length;
    return inSel === 0 ? 'none' : inSel === g.fixtures.length ? 'all' : 'some';
  };
  const toggleGroup = (g: { fixtures: any[] }) => setPicked(p => {
    const n = new Set(p); const all = g.fixtures.every(f => n.has(f.id));
    g.fixtures.forEach(f => all ? n.delete(f.id) : n.add(f.id)); return n;
  });
  const selectFullSeason = () => setPicked(new Set(fixtures.map(f => f.id)));
  const clearAll = () => setPicked(new Set());

  const pickedCount = picked.size;
  const canNext1 = leagueId && pickedCount > 0;
  const pack = packs.find(p => p.id === packId);

  // ── Create ─────────────────────────────────────────────────────────────────
  const basePayload = (publish: 'now' | 'draft') => ({
    league_ids: [leagueId], fixture_ids: [...picked], mode,
    entry_cost: entryCost, min_players: Number(minPlayers) || 0, max_players: Number(maxPlayers) || 0,
    minimum_level: minLevel, is_visible: publish === 'now', rules_html: null,
    tier, duration_type: duration, requires_subscription: requiresSub, required_badges: [] as string[],
  });

  // Pick'em / Swipe (challenges) — supports a twin format.
  const createChallenge = async (fmt: TwinFormat, publish: 'now' | 'draft') => {
    const payload = {
      ...basePayload(publish),
      name: fmt === format ? name : name.replace(/ \(Swipe\)$/, '') + (fmt === 'swipe' ? ' (Swipe)' : ''),
      game_type: GAME_TYPE[fmt],
    };
    const { data, error } = await createMatchdayChallenge(payload);
    const d = data as any;
    if (error || !d?.ok) throw new Error(error?.message || d?.error || 'create failed');
    const id = d.challenge_id as string;
    if (publish === 'now') await setChallengeStatus(id, 'upcoming');
    if (packId) await assignPackToGame(GAME_TYPE[fmt], id, packId, pack?.tiers ?? []);
  };

  // Fantasy (fantasy_games) — created 'Upcoming'; draft flips status.
  const createFantasy = async (publish: 'now' | 'draft') => {
    const { data, error } = await createFantasyGame({ ...basePayload(publish), name });
    const d = data as any;
    if (error || !d?.ok) throw new Error(error?.message || d?.error || 'create failed');
    const id = d.game_id as string;
    if (publish === 'draft') await setFantasyStatus(id, 'Draft');
    if (packId) await assignPackToGame('fantasy', id, packId, pack?.tiers ?? []);
  };

  const submit = async (publish: 'now' | 'draft') => {
    setSubmitting(true);
    try {
      if (format === 'fantasy') {
        await createFantasy(publish);
      } else {
        await createChallenge(format, publish);
        if (alsoCreateTwin) await createChallenge(TWIN[format], publish);
      }
      const twinNote = format !== 'fantasy' && alsoCreateTwin ? ` + ${LABEL[TWIN[format]]}` : '';
      flash(`${LABEL[format]}${twinNote} ${publish === 'now' ? 'published' : 'saved as draft'} ✓`);
      onCreated();
    } catch (e: any) {
      flash(`Failed: ${e.message}`);
    } finally { setSubmitting(false); }
  };

  return (
    <div className="p-6">
      {/* header */}
      <div className="flex items-center justify-between mb-1">
        <button onClick={step === 1 ? onBack : () => setStep(step - 1)} className="flex items-center gap-1 text-text-secondary hover:text-text-primary text-sm font-semibold">
          <ChevronLeft size={18} /> {step === 1 ? 'Type' : 'Back'}
        </button>
        <button onClick={onClose} className="text-text-secondary hover:text-text-primary"><X size={20} /></button>
      </div>
      <div className="flex items-center gap-2 mb-5">
        <h2 className="text-xl font-bold text-text-primary">{LABEL[format]}</h2>
        <span className="text-text-disabled text-sm">· Step {step}/3</span>
      </div>

      {/* STEP 1 */}
      {step === 1 && (
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-text-secondary">League</span>
            <select value={leagueId} onChange={e => setLeagueId(e.target.value)} className="inp mt-1">
              <option value="">Select a league…</option>
              {leagues.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </label>

          {leagueId && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex gap-1 bg-background-dark border border-border-subtle rounded-lg p-1">
                  {(['matchdays', 'calendar'] as const).map(m => (
                    <button key={m} onClick={() => setMode(m)} className={`px-3 py-1 text-sm font-semibold rounded-md capitalize ${mode === m ? 'bg-electric-blue text-white' : 'text-text-secondary'}`}>{m}</button>
                  ))}
                </div>
                <div className="flex gap-2 text-xs">
                  <button onClick={selectFullSeason} className="px-2 py-1 rounded-md bg-lime-glow/15 text-lime-glow font-semibold">Full season</button>
                  <button onClick={clearAll} className="px-2 py-1 rounded-md bg-surface-hover text-text-secondary font-semibold">Clear</button>
                </div>
              </div>

              {loadingFx ? (
                <div className="flex items-center gap-2 text-text-secondary text-sm py-6 justify-center"><Loader2 className="animate-spin" size={16} /> Loading fixtures…</div>
              ) : groups.length === 0 ? (
                <p className="text-text-disabled text-sm py-6 text-center">No upcoming fixtures for this league.</p>
              ) : (
                <div className="max-h-[40vh] overflow-y-auto space-y-2 pr-1">
                  {groups.map(g => {
                    const st = groupState(g);
                    return (
                      <div key={g.key} className="border border-border-subtle rounded-lg">
                        <button onClick={() => toggleGroup(g)} className="w-full flex items-center justify-between px-3 py-2 text-left">
                          <span className="flex items-center gap-2 font-semibold text-text-primary text-sm">
                            <Box state={st} /> {mode === 'calendar' ? fmtDay(g.date) : roundShort(g.key)}
                          </span>
                          <span className="text-xs text-text-disabled">{g.fixtures.filter(f => picked.has(f.id)).length}/{g.fixtures.length}</span>
                        </button>
                        {st !== 'none' && (
                          <div className="border-t border-border-subtle px-3 py-1.5 space-y-1">
                            {g.fixtures.map(f => (
                              <label key={f.id} className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer py-0.5">
                                <input type="checkbox" checked={picked.has(f.id)} onChange={() => toggleFixture(f.id)} />
                                {f.home_team?.name} <span className="text-text-disabled">vs</span> {f.away_team?.name}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <label className="block">
                <span className="text-sm font-semibold text-text-secondary">Name</span>
                <input value={name} onChange={e => { setName(e.target.value); setNameEdited(true); }} className="inp mt-1" />
              </label>
            </>
          )}

          <div className="flex justify-end pt-1">
            <button disabled={!canNext1} onClick={() => setStep(2)} className="px-5 py-2 rounded-lg font-semibold bg-electric-blue text-white disabled:opacity-40">Next →</button>
          </div>
        </div>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <span className="text-sm font-semibold text-text-secondary">Tier</span>
            <div className="flex gap-2 mt-1">
              {TIERS.map(([t]) => (
                <button key={t} onClick={() => setTier(t)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold capitalize ${tier === t ? 'bg-electric-blue text-white' : 'bg-surface-hover text-text-secondary'}`}>{t}</button>
              ))}
            </div>
          </div>

          <p className="text-sm text-text-secondary">Duration <b className="text-text-primary capitalize">{duration}</b> <span className="text-text-disabled">(auto · {selectedGroupCount} {mode === 'calendar' ? 'day(s)' : 'round(s)'})</span></p>

          <label className="block">
            <span className="text-sm font-semibold text-text-secondary">{override ? 'Entry cost (custom)' : `Entry cost (auto: ${computeCost(tier, duration)})`}</span>
            <div className="flex items-center gap-2 mt-1">
              <input type="number" value={entryCost} disabled={!override} onChange={e => setEntryCost(Number(e.target.value))} className="inp disabled:opacity-50" />
              <label className="flex items-center gap-1 text-xs text-text-secondary whitespace-nowrap"><input type="checkbox" checked={override} onChange={e => { setOverride(e.target.checked); if (!e.target.checked) setEntryCost(computeCost(tier, duration)); }} /> Override</label>
            </div>
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-text-secondary">🎁 Reward pack</span>
            <select value={packId} onChange={e => { setPackId(e.target.value); setPackTouched(true); }} className="inp mt-1">
              <option value="">None</option>
              {packs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {pack && <p className="text-xs text-text-disabled mt-1">{(pack.tiers ?? []).length} bracket(s)</p>}
          </label>

          <div className="border-t border-border-subtle pt-3">
            <button onClick={() => setShowAdvanced(v => !v)} className="text-sm font-semibold text-text-secondary">{showAdvanced ? '▾' : '▸'} Access conditions (advanced)</button>
            {showAdvanced && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <label className="block"><span className="text-xs text-text-secondary">Min level</span>
                  <select value={minLevel} onChange={e => setMinLevel(e.target.value)} className="inp mt-1">{LEVELS.map(l => <option key={l}>{l}</option>)}</select>
                </label>
                <label className="flex items-center gap-2 text-sm text-text-secondary mt-5"><input type="checkbox" checked={requiresSub} onChange={e => setRequiresSub(e.target.checked)} /> Premium only</label>
                <label className="block"><span className="text-xs text-text-secondary">Min players</span><input type="number" value={minPlayers} onChange={e => setMinPlayers(e.target.value)} className="inp mt-1" /></label>
                <label className="block"><span className="text-xs text-text-secondary">Max players</span><input type="number" value={maxPlayers} onChange={e => setMaxPlayers(e.target.value)} className="inp mt-1" /></label>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-1">
            <button onClick={() => setStep(3)} className="px-5 py-2 rounded-lg font-semibold bg-electric-blue text-white">Next →</button>
          </div>
        </div>
      )}

      {/* STEP 3 */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="border border-border-subtle rounded-xl p-4 bg-background-dark">
            <p className="font-bold text-text-primary">🏆 {name}</p>
            <p className="text-sm text-text-secondary mt-1">{LABEL[format]} · {pickedCount} match(es) · {selectedGroupCount} {mode === 'calendar' ? 'day(s)' : 'round(s)'}</p>
            <p className="text-sm text-text-secondary mt-0.5 capitalize">Entry {entryCost} 🪙 · {tier} · {minLevel === 'Rookie' ? 'All levels' : `${minLevel}+`}{requiresSub ? ' · Premium' : ''}</p>
            <p className="text-sm text-text-secondary mt-0.5">🎁 {pack?.name ?? 'No reward pack'}</p>
          </div>

          {hasTwin(format) && (
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input type="checkbox" checked={alsoCreateTwin} onChange={e => setAlsoCreateTwin(e.target.checked)} />
              Also create the {LABEL[TWIN[format]]} version (same content)
            </label>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button disabled={submitting} onClick={() => submit('draft')} className="px-4 py-2 rounded-lg font-semibold bg-surface-hover text-text-primary border border-border-subtle disabled:opacity-50">💾 Save Draft</button>
            <button disabled={submitting} onClick={() => submit('now')} className="px-4 py-2 rounded-lg font-semibold bg-lime-glow text-deep-navy disabled:opacity-50 flex items-center gap-2">
              {submitting && <Loader2 className="animate-spin" size={16} />} 🚀 Publish now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Box({ state }: { state: 'none' | 'some' | 'all' }) {
  return (
    <span className={`inline-flex items-center justify-center w-4 h-4 rounded border ${state === 'none' ? 'border-text-disabled' : 'border-electric-blue bg-electric-blue text-white'}`}>
      {state === 'all' && <Check size={12} />}
      {state === 'some' && <span className="w-2 h-0.5 bg-white rounded" />}
    </span>
  );
}
