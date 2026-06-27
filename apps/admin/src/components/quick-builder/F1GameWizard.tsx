import { useEffect, useMemo, useState } from 'react';
import { X, ChevronLeft, Check, Loader2 } from 'lucide-react';
import {
  listUpcomingRaces, createPredGame, setPredConfig, createSeason, createDuel, setDuelConfig, createFantasy,
  DEFAULT_PRED_SCORING, DEFAULT_PRED_REWARDS, DEFAULT_DUEL_REWARDS, type F1Race,
} from '../../services/f1AdminService';
import { setEntryLock, type EntryLockKind } from '../../services/tournamentAdminService';

export type F1Format = 'predictor' | 'duels' | 'fantasy' | 'season';
const LABEL: Record<F1Format, string> = { predictor: 'GP Predictor', duels: 'Teammates Duels', fantasy: 'Fantasy F1', season: 'Season Forecast' };
const CONDITIONS: [string, string][] = [
  ['standard', 'Standard (1E·1C·1O)'], ['no_stars', 'No Stars (2C·1O)'], ['double_star', 'Double Star (2E·1O)'],
  ['underdog', 'Underdog (1E·2O)'], ['constructor_chaos', 'Constructor Chaos'], ['free', 'Free Choice'],
];

const raceLabel = (r: F1Race) => `${r.round ? `R${r.round} · ` : ''}${r.name}`;
const raceDay = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

interface Props { format: F1Format; onBack: () => void; onClose: () => void; onCreated: () => void; flash: (m: string) => void; }

export default function F1GameWizard({ format, onBack, onClose, onCreated, flash }: Props) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [races, setRaces] = useState<F1Race[]>([]);
  const [loadingRaces, setLoadingRaces] = useState(false);

  const needsRaces = format !== 'season';
  const multiRace = format === 'predictor';
  const hasPublish = format === 'predictor' || format === 'duels';

  // step 1
  const [name, setName] = useState(format === 'season' ? 'Season Forecast' : 'GP Predictor');
  const [raceIds, setRaceIds] = useState<Set<number>>(new Set());
  const [raceId, setRaceId] = useState<number | null>(null);
  const [season, setSeason] = useState(new Date().getFullYear());
  const [lockAt, setLockAt] = useState('');
  const [condition, setCondition] = useState('standard');

  // step 2
  const [entryCost, setEntryCost] = useState(0);
  const [upsetBonus, setUpsetBonus] = useState(25);
  const [entryLockAt, setEntryLockAt] = useState('');

  useEffect(() => {
    if (!needsRaces) return;
    setLoadingRaces(true);
    listUpcomingRaces().then(r => { setRaces(r); setLoadingRaces(false); });
  }, [needsRaces]);

  const toggleRace = (id: number) => setRaceIds(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectFullSeason = () => setRaceIds(new Set(races.map(r => r.id)));

  const canNext1 = useMemo(() => {
    if (format === 'predictor') return raceIds.size > 0;
    if (format === 'duels' || format === 'fantasy') return raceId != null;
    return season > 2000; // season
  }, [format, raceIds, raceId, season]);

  const selectedRaceName = raceId != null ? races.find(r => r.id === raceId) : null;

  const submit = async (publish: 'now' | 'draft') => {
    setSubmitting(true);
    try {
      let createdId: string | null = null;
      let kind: EntryLockKind = 'f1pred';
      if (format === 'predictor') {
        const { data, error } = await createPredGame(name || 'GP Predictor', [...raceIds]);
        if (error || !data) throw new Error(error?.message || 'create failed');
        await setPredConfig(data as string, { scoring: DEFAULT_PRED_SCORING, rewards: DEFAULT_PRED_REWARDS, entry_cost: entryCost, is_active: publish === 'now' });
        createdId = data as string; kind = 'f1pred';
      } else if (format === 'duels') {
        const { data, error } = await createDuel(raceId!);
        if (error || !data) throw new Error(error?.message || 'create failed');
        await setDuelConfig(data as string, { rewards: DEFAULT_DUEL_REWARDS, entry_cost: entryCost, is_active: publish === 'now', upset_bonus: upsetBonus });
        createdId = data as string; kind = 'f1duel';
      } else if (format === 'fantasy') {
        const { data, error } = await createFantasy(raceId!, condition);
        if (error) throw new Error(error.message);
        createdId = (data as string) ?? null; kind = 'f1fantasy';
      } else {
        const { data, error } = await createSeason(name || 'Season Forecast', Math.floor(season), lockAt ? new Date(lockAt).toISOString() : null);
        if (error) throw new Error(error.message);
        createdId = (data as string) ?? null; kind = 'f1pred';
      }
      if (entryLockAt && createdId) await setEntryLock(kind, createdId, new Date(entryLockAt).toISOString());
      flash(`${LABEL[format]} ${hasPublish && publish === 'draft' ? 'saved as draft' : 'created'} ✓`);
      onCreated();
    } catch (e: any) {
      flash(`Failed: ${e.message}`);
    } finally { setSubmitting(false); }
  };

  return (
    <div className="p-6">
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

      {/* STEP 1 — scope */}
      {step === 1 && (
        <div className="space-y-4">
          {(format === 'predictor' || format === 'season') && (
            <label className="block">
              <span className="text-sm font-semibold text-text-secondary">Name</span>
              <input value={name} onChange={e => setName(e.target.value)} className="inp mt-1" />
            </label>
          )}

          {format === 'season' && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="text-sm font-semibold text-text-secondary">Season year</span>
                <input type="number" value={season} onChange={e => setSeason(Number(e.target.value))} className="inp mt-1" /></label>
              <label className="block"><span className="text-sm font-semibold text-text-secondary">Lock at (optional)</span>
                <input type="datetime-local" value={lockAt} onChange={e => setLockAt(e.target.value)} className="inp mt-1" /></label>
            </div>
          )}

          {needsRaces && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-text-secondary">{multiRace ? 'Grand Prix (one or more)' : 'Grand Prix'}</span>
                {multiRace && <button onClick={selectFullSeason} className="text-xs px-2 py-1 rounded-md bg-lime-glow/15 text-lime-glow font-semibold">Full season</button>}
              </div>
              {loadingRaces ? (
                <div className="flex items-center gap-2 text-text-secondary text-sm py-6 justify-center"><Loader2 className="animate-spin" size={16} /> Loading races…</div>
              ) : races.length === 0 ? (
                <p className="text-text-disabled text-sm py-6 text-center">No upcoming races.</p>
              ) : (
                <div className="max-h-[40vh] overflow-y-auto space-y-1 pr-1">
                  {races.map(r => {
                    const checked = multiRace ? raceIds.has(r.id) : raceId === r.id;
                    return (
                      <button key={r.id} onClick={() => multiRace ? toggleRace(r.id) : setRaceId(r.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-left text-sm ${checked ? 'border-electric-blue bg-electric-blue/10' : 'border-border-subtle'}`}>
                        <span className="flex items-center gap-2 text-text-primary font-medium">
                          <span className={`inline-flex items-center justify-center w-4 h-4 ${multiRace ? 'rounded' : 'rounded-full'} border ${checked ? 'border-electric-blue bg-electric-blue text-white' : 'border-text-disabled'}`}>{checked && <Check size={12} />}</span>
                          {raceLabel(r)}
                        </span>
                        <span className="text-xs text-text-disabled">{raceDay(r.race_at)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {format === 'fantasy' && (
            <label className="block">
              <span className="text-sm font-semibold text-text-secondary">Condition</span>
              <select value={condition} onChange={e => setCondition(e.target.value)} className="inp mt-1">
                {CONDITIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
          )}

          <div className="flex justify-end pt-1">
            <button disabled={!canNext1} onClick={() => setStep(2)} className="px-5 py-2 rounded-lg font-semibold bg-electric-blue text-white disabled:opacity-40">Next →</button>
          </div>
        </div>
      )}

      {/* STEP 2 — settings */}
      {step === 2 && (
        <div className="space-y-4">
          {(format === 'predictor' || format === 'duels') ? (
            <>
              <label className="block">
                <span className="text-sm font-semibold text-text-secondary">Entry cost</span>
                <input type="number" value={entryCost} onChange={e => setEntryCost(Math.max(0, Number(e.target.value)))} className="inp mt-1" />
              </label>
              {format === 'duels' && (
                <label className="block">
                  <span className="text-sm font-semibold text-text-secondary">Upset bonus (coins per upset)</span>
                  <input type="number" value={upsetBonus} onChange={e => setUpsetBonus(Math.max(0, Number(e.target.value)))} className="inp mt-1" />
                </label>
              )}
            </>
          ) : (
            <p className="text-sm text-text-secondary">No entry cost. This game uses the default scoring & rewards.</p>
          )}
          <label className="block">
            <span className="text-sm font-semibold text-text-secondary">🔒 Entry lock override (optional)</span>
            <input type="datetime-local" value={entryLockAt} onChange={e => setEntryLockAt(e.target.value)} className="inp mt-1" />
            <p className="text-xs text-text-disabled mt-1">Leave empty to use the race's natural lock (qualifying / start).</p>
          </label>
          <p className="text-xs text-text-disabled">Default scoring & rewards are applied — fine-tune them later in the F1 admin tab if needed.</p>
          <div className="flex justify-end pt-1">
            <button onClick={() => setStep(3)} className="px-5 py-2 rounded-lg font-semibold bg-electric-blue text-white">Next →</button>
          </div>
        </div>
      )}

      {/* STEP 3 — publish */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="border border-border-subtle rounded-xl p-4 bg-background-dark">
            <p className="font-bold text-text-primary">🏎️ {format === 'predictor' || format === 'season' ? name : LABEL[format]}</p>
            <p className="text-sm text-text-secondary mt-1">
              {format === 'predictor' && `GP Predictor · ${raceIds.size} race(s)`}
              {format === 'duels' && `Teammates Duels · ${selectedRaceName ? raceLabel(selectedRaceName) : ''}`}
              {format === 'fantasy' && `Fantasy F1 · ${selectedRaceName ? raceLabel(selectedRaceName) : ''} · ${CONDITIONS.find(c => c[0] === condition)?.[1]}`}
              {format === 'season' && `Season Forecast · ${season}${lockAt ? ` · locks ${new Date(lockAt).toLocaleString()}` : ''}`}
            </p>
            {(format === 'predictor' || format === 'duels') && (
              <p className="text-sm text-text-secondary mt-0.5">Entry {entryCost} 🪙{format === 'duels' ? ` · upset +${upsetBonus}` : ''}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            {hasPublish ? (
              <>
                <button disabled={submitting} onClick={() => submit('draft')} className="px-4 py-2 rounded-lg font-semibold bg-surface-hover text-text-primary border border-border-subtle disabled:opacity-50">💾 Save Draft</button>
                <button disabled={submitting} onClick={() => submit('now')} className="px-4 py-2 rounded-lg font-semibold bg-lime-glow text-deep-navy disabled:opacity-50 flex items-center gap-2">
                  {submitting && <Loader2 className="animate-spin" size={16} />} 🚀 Publish now
                </button>
              </>
            ) : (
              <button disabled={submitting} onClick={() => submit('now')} className="px-4 py-2 rounded-lg font-semibold bg-lime-glow text-deep-navy disabled:opacity-50 flex items-center gap-2">
                {submitting && <Loader2 className="animate-spin" size={16} />} 🚀 Create
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
