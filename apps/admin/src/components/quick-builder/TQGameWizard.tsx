import { useEffect, useMemo, useState } from 'react';
import { X, ChevronLeft, Loader2 } from 'lucide-react';
import { createFromLeague, setStatus, listSourceLeagues, setEntryLock } from '../../services/tournamentAdminService';
import { listRewardPacks, assignPackToGame } from '../../services/rewardService';

const TIERS: [string, number][] = [['amateur', 2000], ['master', 10000], ['apex', 20000]];
const TIER_BASE: Record<string, number> = Object.fromEntries(TIERS);
const LEVELS = ['Rookie', 'Rising', 'Pro', 'Elite', 'Legend', 'GOAT'];
// TQ always spans a whole tournament → duration 'season' (×4).
const tqCost = (tier: string) => (TIER_BASE[tier] ?? 2000) * 4;

interface Props { onBack: () => void; onClose: () => void; onCreated: () => void; flash: (m: string) => void; }

export default function TQGameWizard({ onBack, onClose, onCreated, flash }: Props) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [leagues, setLeagues] = useState<any[]>([]);
  const [packs, setPacks] = useState<any[]>([]);

  // step 1
  const [leagueApiId, setLeagueApiId] = useState<number | ''>('');
  const [season, setSeason] = useState(new Date().getFullYear());
  const [qualifiedPerGroup, setQualifiedPerGroup] = useState(2);
  const [name, setName] = useState('');
  const [nameEdited, setNameEdited] = useState(false);

  // step 2
  const [tier, setTier] = useState('amateur');
  const [override, setOverride] = useState(false);
  const [entryCost, setEntryCost] = useState(tqCost('amateur'));
  const [packId, setPackId] = useState('');
  const [packTouched, setPackTouched] = useState(false);
  const [opensMode, setOpensMode] = useState<'publish' | 'schedule'>('publish');
  const [opensAt, setOpensAt] = useState('');
  const [entryLockAt, setEntryLockAt] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [minLevel, setMinLevel] = useState('Rookie');
  const [requiresSub, setRequiresSub] = useState(false);
  const [minPlayers, setMinPlayers] = useState('');
  const [maxPlayers, setMaxPlayers] = useState('');

  useEffect(() => { listSourceLeagues().then(setLeagues); listRewardPacks().then(setPacks); }, []);

  useEffect(() => { if (!override) setEntryCost(tqCost(tier)); }, [tier, override]);
  useEffect(() => {
    if (packTouched) return;
    setPackId(packs.find(p => (p.name || '').toLowerCase().includes(tier))?.id ?? '');
  }, [tier, packs, packTouched]);

  const autoName = useMemo(() => {
    const lg = leagues.find(l => l.api_id === leagueApiId)?.name ?? 'Competition';
    return `${lg} ${season}`;
  }, [leagues, leagueApiId, season]);
  useEffect(() => { if (!nameEdited) setName(autoName); }, [autoName, nameEdited]);

  const canNext1 = leagueApiId !== '' && season > 2000;
  const pack = packs.find(p => p.id === packId);

  const submit = async (publish: 'now' | 'draft') => {
    setSubmitting(true);
    try {
      const { data, error } = await createFromLeague({
        name, league_api_id: Number(leagueApiId), season: Number(season),
        entry_cost: entryCost, min_players: minPlayers ? Number(minPlayers) : null, max_players: maxPlayers ? Number(maxPlayers) : null,
        minimum_level: minLevel, is_visible: publish === 'now',
        opens_at: opensMode === 'schedule' && opensAt ? new Date(opensAt).toISOString() : null,
        qualified_per_group: Number(qualifiedPerGroup), tier, duration_type: 'season',
        requires_subscription: requiresSub, required_badges: [],
      });
      const d = data as any;
      if (error || !d?.ok) throw new Error(error?.message || d?.error || 'create failed');
      const id = d.competition_id as string;
      if (publish === 'now') await setStatus(id, 'open');
      if (packId) await assignPackToGame('tq', id, packId, pack?.tiers ?? []);
      if (entryLockAt) await setEntryLock('tq', id, new Date(entryLockAt).toISOString());
      flash(`Tournament Quest ${publish === 'now' ? 'published' : 'saved as draft'} — ${d.groups} groups, ${d.teams} teams ✓`);
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
        <h2 className="text-xl font-bold text-text-primary">Tournament Quest</h2>
        <span className="text-text-disabled text-sm">· Step {step}/3</span>
      </div>

      {/* STEP 1 — competition + season */}
      {step === 1 && (
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-text-secondary">Competition (must have a group stage)</span>
            <select value={leagueApiId} onChange={e => setLeagueApiId(e.target.value ? Number(e.target.value) : '')} className="inp mt-1">
              <option value="">Select a competition…</option>
              {leagues.map(l => <option key={l.api_id} value={l.api_id}>{l.name}</option>)}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="text-sm font-semibold text-text-secondary">Season</span>
              <input type="number" value={season} onChange={e => setSeason(Number(e.target.value))} className="inp mt-1" /></label>
            <label className="block"><span className="text-sm font-semibold text-text-secondary">Qualify per group</span>
              <input type="number" value={qualifiedPerGroup} onChange={e => setQualifiedPerGroup(Math.max(1, Number(e.target.value)))} className="inp mt-1" /></label>
          </div>

          <p className="text-xs text-text-disabled">Groups, teams, matches and the bracket are built automatically from the competition's group-stage fixtures on create.</p>

          <label className="block">
            <span className="text-sm font-semibold text-text-secondary">Name</span>
            <input value={name} onChange={e => { setName(e.target.value); setNameEdited(true); }} className="inp mt-1" />
          </label>

          <div className="flex justify-end pt-1">
            <button disabled={!canNext1} onClick={() => setStep(2)} className="px-5 py-2 rounded-lg font-semibold bg-electric-blue text-white disabled:opacity-40">Next →</button>
          </div>
        </div>
      )}

      {/* STEP 2 — settings */}
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
          <p className="text-sm text-text-secondary">Duration <b className="text-text-primary">Season</b> <span className="text-text-disabled">(whole tournament)</span></p>

          <label className="block">
            <span className="text-sm font-semibold text-text-secondary">{override ? 'Entry cost (custom)' : `Entry cost (auto: ${tqCost(tier)})`}</span>
            <div className="flex items-center gap-2 mt-1">
              <input type="number" value={entryCost} disabled={!override} onChange={e => setEntryCost(Number(e.target.value))} className="inp disabled:opacity-50" />
              <label className="flex items-center gap-1 text-xs text-text-secondary whitespace-nowrap"><input type="checkbox" checked={override} onChange={e => { setOverride(e.target.checked); if (!e.target.checked) setEntryCost(tqCost(tier)); }} /> Override</label>
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

          <div>
            <span className="text-sm font-semibold text-text-secondary">Registration opens</span>
            <div className="flex items-center gap-3 mt-1">
              <label className="flex items-center gap-1 text-sm text-text-secondary"><input type="radio" checked={opensMode === 'publish'} onChange={() => setOpensMode('publish')} /> On publish</label>
              <label className="flex items-center gap-1 text-sm text-text-secondary"><input type="radio" checked={opensMode === 'schedule'} onChange={() => setOpensMode('schedule')} /> Schedule</label>
              {opensMode === 'schedule' && <input type="datetime-local" value={opensAt} onChange={e => setOpensAt(e.target.value)} className="inp flex-1" />}
            </div>
          </div>

          <label className="block">
            <span className="text-sm font-semibold text-text-secondary">🔒 Entry lock override (optional)</span>
            <input type="datetime-local" value={entryLockAt} onChange={e => setEntryLockAt(e.target.value)} className="inp mt-1" />
            <p className="text-xs text-text-disabled mt-1">Leave empty to keep entry open until the tournament's natural lock.</p>
          </label>

          <div className="border-t border-border-subtle pt-3">
            <button onClick={() => setShowAdvanced(v => !v)} className="text-sm font-semibold text-text-secondary">{showAdvanced ? '▾' : '▸'} Access conditions (advanced)</button>
            {showAdvanced && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <label className="block"><span className="text-xs text-text-secondary">Min level</span>
                  <select value={minLevel} onChange={e => setMinLevel(e.target.value)} className="inp mt-1">{LEVELS.map(l => <option key={l}>{l}</option>)}</select></label>
                <label className="flex items-center gap-2 text-sm text-text-secondary mt-5"><input type="checkbox" checked={requiresSub} onChange={e => setRequiresSub(e.target.checked)} /> Premium only</label>
                <label className="block"><span className="text-xs text-text-secondary">Min players</span><input type="number" value={minPlayers} onChange={e => setMinPlayers(e.target.value)} className="inp mt-1" /></label>
                <label className="block"><span className="text-xs text-text-secondary">Max players</span><input type="number" value={maxPlayers} onChange={e => setMaxPlayers(e.target.value)} className="inp mt-1" /></label>
              </div>
            )}
          </div>

          <p className="text-xs text-text-disabled">Default scoring (long-term · group · daily · bracket) is applied — fine-tune it later in the Tournament Quest admin.</p>

          <div className="flex justify-end pt-1">
            <button onClick={() => setStep(3)} className="px-5 py-2 rounded-lg font-semibold bg-electric-blue text-white">Next →</button>
          </div>
        </div>
      )}

      {/* STEP 3 — publish */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="border border-border-subtle rounded-xl p-4 bg-background-dark">
            <p className="font-bold text-text-primary">🏆 {name}</p>
            <p className="text-sm text-text-secondary mt-1">Tournament Quest · season {season} · {qualifiedPerGroup} qualify/group</p>
            <p className="text-sm text-text-secondary mt-0.5 capitalize">Entry {entryCost} 🪙 · {tier} · {minLevel === 'Rookie' ? 'All levels' : `${minLevel}+`}{requiresSub ? ' · Premium' : ''}</p>
            <p className="text-sm text-text-secondary mt-0.5">🎁 {pack?.name ?? 'No reward pack'} · opens {opensMode === 'schedule' && opensAt ? new Date(opensAt).toLocaleString() : 'on publish'}</p>
          </div>

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
