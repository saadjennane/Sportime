import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Trophy, Lock, Check, X, Clock, Star, Crown, Medal } from 'lucide-react';
import {
  TQCompetition, TQEntry, TQLeaderboardRow, TQTeam,
  getTournament, getMyTournamentEntry, getTournamentLeaderboard, isPhaseOpen,
  saveLongTerm, saveGroupPrediction, saveDailyPrediction,
} from '../services/tournamentService';

interface Props { competitionId: string; userId: string; onBack: () => void; }

type Tab = 'picks' | 'groups' | 'daily' | 'bracket';

const ROUND_LABEL: Record<string, string> = { R32: 'Round of 32', R16: 'Round of 16', QF: 'Quarter-finals', SF: 'Semi-finals', F: 'Final' };

const TeamChip: React.FC<{ team: TQTeam | null; size?: 'sm' | 'md' }> = ({ team, size = 'md' }) => (
  <span className={`inline-flex items-center gap-1.5 ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
    {team?.flag_url
      ? <img src={team.flag_url} alt="" className="w-4 h-4 rounded-sm object-cover" />
      : <span className="w-5 h-4 rounded-sm bg-electric-blue/20 text-[8px] flex items-center justify-center font-bold text-electric-blue">{team?.short_name ?? '?'}</span>}
    <span className="text-text-primary truncate">{team?.name ?? '—'}</span>
  </span>
);

export const TournamentQuestPage: React.FC<Props> = ({ competitionId, userId, onBack }) => {
  const [comp, setComp] = useState<TQCompetition | null>(null);
  const [entry, setEntry] = useState<TQEntry | null>(null);
  const [lb, setLb] = useState<TQLeaderboardRow[]>([]);
  const [tab, setTab] = useState<Tab>('picks');
  const [loading, setLoading] = useState(true);
  const [lbOpen, setLbOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const reload = async () => {
    const [c, e, l] = await Promise.all([
      getTournament(competitionId), getMyTournamentEntry(competitionId, userId), getTournamentLeaderboard(competitionId),
    ]);
    setComp(c); setEntry(e); setLb(l); setLoading(false);
  };
  useEffect(() => { setLoading(true); reload(); }, [competitionId]);

  const allTeams = useMemo(() => comp?.groups.flatMap(g => g.teams) ?? [], [comp]);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2200); };

  if (loading || !comp) {
    return <div className="min-h-screen bg-deep-navy flex items-center justify-center text-text-secondary">Loading…</div>;
  }

  const total = entry?.total_score ?? 0;

  return (
    <div className="min-h-screen bg-deep-navy text-text-primary pb-24">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-white/10 bg-navy-accent">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-1 text-text-secondary"><ArrowLeft size={20} /> Back</button>
          <button onClick={() => setLbOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-deep-navy rounded-lg text-sm font-semibold"><Trophy size={16} className="text-warm-yellow" /> {total} pts</button>
        </div>
        <h1 className="text-2xl font-bold mt-2">{comp.name}</h1>
        <p className="text-xs text-text-secondary">
          {comp.format.groups_count} groups · {comp.format.knockout_participants} qualify · {comp.format.knockout_rounds.map(r => ROUND_LABEL[r] ?? r).join(' → ')}
        </p>
        {entry && (
          <div className="flex gap-2 mt-3 text-[11px]">
            {[['Picks', entry.long_term_score], ['Groups', entry.group_score], ['Daily', entry.daily_score], ['Bracket', entry.bracket_score]].map(([k, v]) => (
              <div key={k as string} className="flex-1 bg-deep-navy rounded-lg py-1.5 text-center">
                <p className="font-bold">{v as number}</p><p className="text-text-disabled">{k as string}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 bg-navy-accent sticky top-0 z-10">
        {(['picks', 'groups', 'daily', 'bracket'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-3 text-xs font-semibold capitalize ${tab === t ? 'text-electric-blue border-b-2 border-electric-blue' : 'text-text-secondary'}`}>
            {t === 'picks' ? 'My Picks' : t}
          </button>
        ))}
      </div>

      <div className="p-4">
        {tab === 'picks' && <PicksSection comp={comp} entry={entry} allTeams={allTeams} onSaved={() => { reload(); flash('Picks saved'); }} flash={flash} />}
        {tab === 'groups' && <GroupsSection comp={comp} entry={entry} onSaved={() => { reload(); flash('Group saved'); }} flash={flash} />}
        {tab === 'daily' && <DailySection comp={comp} entry={entry} onSaved={() => { reload(); flash('Prediction saved'); }} flash={flash} />}
        {tab === 'bracket' && <BracketSection comp={comp} />}
      </div>

      {toast && <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-electric-blue text-deep-navy font-bold px-4 py-2 rounded-full text-sm z-50 animate-scale-in">{toast}</div>}

      {lbOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end z-50" onClick={() => setLbOpen(false)}>
          <div className="bg-navy-accent w-full rounded-t-3xl max-h-[80vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3"><h2 className="font-bold text-lg">Leaderboard</h2><button onClick={() => setLbOpen(false)}><X size={22} className="text-text-secondary" /></button></div>
            {lb.length === 0 ? <p className="text-text-disabled text-sm">No scores yet.</p> : lb.map(r => (
              <div key={r.user_id} className="flex items-center gap-3 py-2 border-b border-white/5">
                <span className="w-6 font-bold text-text-secondary">{r.rank}</span>
                <span className="flex-1 truncate">{r.username ?? 'Player'}</span>
                <span className="font-bold text-electric-blue">{r.total_score}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── My Picks ─────────────────────────────────────────────────────────────────
const PicksSection: React.FC<{ comp: TQCompetition; entry: TQEntry | null; allTeams: TQTeam[]; onSaved: () => void; flash: (m: string) => void }> = ({ comp, entry, allTeams, onSaved, flash }) => {
  const open = isPhaseOpen(comp, 'long_term');
  const [champion, setChampion] = useState<string | null>(entry?.longTerm?.champion_team_id ?? null);
  const [finalist, setFinalist] = useState<string | null>(entry?.longTerm?.finalist_team_id ?? null);
  const [goals, setGoals] = useState<string>(entry?.longTerm?.total_goals_prediction?.toString() ?? '');
  const [picking, setPicking] = useState<null | 'champion' | 'finalist'>(null);
  const teamById = (id: string | null) => allTeams.find(t => t.id === id) ?? null;

  const save = async () => {
    const { error } = await saveLongTerm(comp.id, champion, finalist, goals ? parseInt(goals) : null);
    if (error) flash(error.message); else onSaved();
  };

  return (
    <div className="space-y-3">
      {!open && <LockedBanner text="Long-term picks are locked." />}
      <PickRow icon={<Crown size={18} className="text-warm-yellow" />} label="Champion" team={teamById(champion)} disabled={!open} onClick={() => setPicking('champion')} />
      <PickRow icon={<Medal size={18} className="text-text-secondary" />} label="Finalist" team={teamById(finalist)} disabled={!open} onClick={() => setPicking('finalist')} />
      <div className="bg-navy-accent rounded-xl p-4">
        <label className="text-sm text-text-secondary">Total goals in the tournament <span className="text-text-disabled">(tie-break)</span></label>
        <input type="number" inputMode="numeric" value={goals} disabled={!open} onChange={e => setGoals(e.target.value)}
          placeholder="e.g. 140" className="w-full mt-2 bg-deep-navy border border-white/10 rounded-lg px-3 py-2 text-text-primary disabled:opacity-50" />
      </div>
      {open && <button onClick={save} className="w-full bg-electric-blue text-deep-navy font-bold py-3 rounded-xl">Save picks</button>}

      {picking && (
        <TeamPickerModal teams={allTeams} onClose={() => setPicking(null)} onSelect={(t) => { picking === 'champion' ? setChampion(t.id) : setFinalist(t.id); setPicking(null); }} />
      )}
    </div>
  );
};

const PickRow: React.FC<{ icon: React.ReactNode; label: string; team: TQTeam | null; disabled: boolean; onClick: () => void }> = ({ icon, label, team, disabled, onClick }) => (
  <button onClick={onClick} disabled={disabled} className="w-full flex items-center gap-3 bg-navy-accent rounded-xl p-4 text-left disabled:opacity-60">
    {icon}
    <div className="flex-1"><p className="text-xs text-text-secondary">{label}</p>{team ? <TeamChip team={team} /> : <p className="text-text-disabled text-sm">Tap to choose</p>}</div>
    {!disabled && <span className="text-electric-blue text-sm">{team ? 'Change' : 'Pick'}</span>}
  </button>
);

// ── Groups ───────────────────────────────────────────────────────────────────
const GroupsSection: React.FC<{ comp: TQCompetition; entry: TQEntry | null; onSaved: () => void; flash: (m: string) => void }> = ({ comp, entry, onSaved, flash }) => {
  const open = isPhaseOpen(comp, 'group');
  // local picks per group: ordered array of team ids
  const initial: Record<string, string[]> = {};
  for (const g of comp.groups) {
    const picks = (entry?.groupPicks ?? []).filter(p => p.group_id === g.id).sort((a, b) => a.predicted_position - b.predicted_position);
    initial[g.id] = picks.map(p => p.predicted_team_id);
  }
  const [sel, setSel] = useState<Record<string, string[]>>(initial);

  const toggle = (groupId: string, teamId: string, max: number) => {
    setSel(prev => {
      const cur = prev[groupId] ?? [];
      if (cur.includes(teamId)) return { ...prev, [groupId]: cur.filter(id => id !== teamId) };
      if (cur.length >= max) return prev; // full
      return { ...prev, [groupId]: [...cur, teamId] };
    });
  };
  const saveGroup = async (groupId: string) => {
    const picks = (sel[groupId] ?? []).map((team_id, i) => ({ team_id, position: i + 1 }));
    const { error } = await saveGroupPrediction(comp.id, groupId, picks);
    if (error) flash(error.message); else onSaved();
  };

  return (
    <div className="space-y-4">
      {!open && <LockedBanner text="Group predictions are locked." />}
      <p className="text-xs text-text-secondary">Pick the <b>top {comp.groups[0]?.qualified_count ?? 2}</b> of each group, in order. Order = +bonus.</p>
      {comp.groups.map(g => {
        const picks = sel[g.id] ?? [];
        return (
          <div key={g.id} className="bg-navy-accent rounded-xl p-4">
            <div className="flex justify-between items-center mb-2"><h3 className="font-bold">{g.name}</h3><span className="text-[11px] text-text-disabled">{picks.length}/{g.qualified_count}</span></div>
            <div className="space-y-1.5">
              {g.teams.map(t => {
                const pos = picks.indexOf(t.id);
                const chosen = pos >= 0;
                return (
                  <button key={t.id} disabled={!open} onClick={() => toggle(g.id, t.id, g.qualified_count)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border ${chosen ? 'border-electric-blue bg-electric-blue/10' : 'border-white/5 bg-deep-navy'} disabled:opacity-60`}>
                    <span className={`w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center ${chosen ? 'bg-electric-blue text-deep-navy' : 'bg-white/10 text-text-disabled'}`}>{chosen ? pos + 1 : ''}</span>
                    <TeamChip team={t} size="sm" />
                  </button>
                );
              })}
            </div>
            {open && <button onClick={() => saveGroup(g.id)} className="w-full mt-3 bg-electric-blue/90 text-deep-navy font-bold py-2 rounded-lg text-sm">Save {g.name}</button>}
          </div>
        );
      })}
    </div>
  );
};

// ── Daily ────────────────────────────────────────────────────────────────────
const DailySection: React.FC<{ comp: TQCompetition; entry: TQEntry | null; onSaved: () => void; flash: (m: string) => void }> = ({ comp, entry, onSaved, flash }) => {
  const match = comp.officialMatches.find(m => m.status === 'scheduled') ?? comp.officialMatches[0];
  if (!match) return <p className="text-text-disabled text-sm">No official match scheduled right now. Check back on match days.</p>;
  const locked = match.status !== 'scheduled' || (match.start_time != null && new Date(match.start_time).getTime() <= Date.now());
  const existing = entry?.dailyPicks.find(p => p.match_id === match.id);
  const [result, setResult] = useState<string | null>(existing?.predicted_result ?? null);
  const [bucket, setBucket] = useState<string | null>(existing?.predicted_goal_diff_bucket ?? null);
  const [first, setFirst] = useState<string | null>(existing?.predicted_first_scorer_team_id ?? null);

  const save = async () => {
    if (!result || !bucket) { flash('Pick a result and a goal margin'); return; }
    const { error } = await saveDailyPrediction(comp.id, match.id, result, bucket, first, null, null);
    if (error) flash(error.message); else onSaved();
  };

  return (
    <div className="space-y-4">
      <div className="bg-navy-accent rounded-xl p-4">
        <div className="flex items-center justify-between text-xs text-text-secondary mb-3">
          <span className="flex items-center gap-1"><Star size={12} className="text-warm-yellow" /> Official match</span>
          {match.start_time && <span className="flex items-center gap-1"><Clock size={12} /> {new Date(match.start_time).toLocaleString()}</span>}
        </div>
        <div className="flex items-center justify-around text-center">
          <div className="flex-1"><TeamChip team={match.team_a} /></div>
          <span className="text-text-disabled text-sm px-2">vs</span>
          <div className="flex-1"><TeamChip team={match.team_b} /></div>
        </div>
      </div>

      {locked && <LockedBanner text="This match is locked (kick-off passed)." />}

      <Question title="1. Final result">
        <Seg options={[['A', match.team_a?.short_name ?? 'A'], ['draw', 'Draw'], ['B', match.team_b?.short_name ?? 'B']]} value={result} onChange={setResult} disabled={locked} />
      </Question>
      <Question title="2. Goal margin">
        <Seg options={[['draw', 'Draw'], ['1', '1 goal'], ['2plus', '2+ goals']]} value={bucket} onChange={setBucket} disabled={locked} />
      </Question>
      <Question title="3. First to score">
        <Seg options={[[match.team_a?.id ?? 'A', match.team_a?.short_name ?? 'A'], ['none', 'No goal'], [match.team_b?.id ?? 'B', match.team_b?.short_name ?? 'B']]} value={first} onChange={setFirst} disabled={locked} />
      </Question>

      {!locked && <button onClick={save} className="w-full bg-electric-blue text-deep-navy font-bold py-3 rounded-xl">Save prediction</button>}
      {existing && existing.points_awarded > 0 && <p className="text-center text-lime-glow font-bold">+{existing.points_awarded} pts</p>}
    </div>
  );
};

const Question: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div><p className="text-sm font-semibold text-text-secondary mb-2">{title}</p>{children}</div>
);
const Seg: React.FC<{ options: [string, string][]; value: string | null; onChange: (v: string) => void; disabled?: boolean }> = ({ options, value, onChange, disabled }) => (
  <div className="flex gap-2">
    {options.map(([val, label]) => (
      <button key={val} disabled={disabled} onClick={() => onChange(val)}
        className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border ${value === val ? 'border-electric-blue bg-electric-blue/15 text-electric-blue' : 'border-white/5 bg-navy-accent text-text-secondary'} disabled:opacity-50`}>{label}</button>
    ))}
  </div>
);

// ── Bracket ──────────────────────────────────────────────────────────────────
const BracketSection: React.FC<{ comp: TQCompetition }> = ({ comp }) => {
  const rounds = comp.format.knockout_rounds;
  const anyOpen = rounds.some(r => isPhaseOpen(comp, r));
  return (
    <div className="space-y-3">
      {!anyOpen && <LockedBanner text="The living bracket opens after the group stage. You'll predict the qualifiers round by round." />}
      <div className="bg-navy-accent rounded-xl p-4">
        <h3 className="font-bold mb-3 flex items-center gap-2"><Trophy size={18} className="text-warm-yellow" /> Knockout rounds</h3>
        <div className="space-y-2">
          {rounds.map(r => {
            const w = comp.phaseState[r];
            const open = isPhaseOpen(comp, r);
            return (
              <div key={r} className="flex items-center justify-between px-3 py-2.5 bg-deep-navy rounded-lg">
                <span className="font-semibold text-sm">{ROUND_LABEL[r] ?? r}</span>
                <span className={`text-[11px] font-bold flex items-center gap-1 ${open ? 'text-lime-glow' : 'text-text-disabled'}`}>
                  {open ? <>Open</> : <><Lock size={11} /> {w?.state ?? 'Locked'}</>}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ── Shared ───────────────────────────────────────────────────────────────────
const LockedBanner: React.FC<{ text: string }> = ({ text }) => (
  <div className="flex items-center gap-2 bg-warm-yellow/10 border border-warm-yellow/30 text-warm-yellow rounded-xl px-3 py-2.5 text-sm"><Lock size={16} /> {text}</div>
);

const TeamPickerModal: React.FC<{ teams: TQTeam[]; onClose: () => void; onSelect: (t: TQTeam) => void }> = ({ teams, onClose, onSelect }) => {
  const [q, setQ] = useState('');
  const filtered = teams.filter(t => t.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-navy-accent rounded-2xl w-full max-w-sm h-[70vh] flex flex-col p-4 border border-white/10" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3"><h2 className="font-bold">Choose a team</h2><button onClick={onClose}><X size={22} className="text-text-secondary" /></button></div>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" className="w-full bg-deep-navy border border-white/10 rounded-lg px-3 py-2 mb-3 text-text-primary placeholder:text-text-disabled" />
        <div className="flex-1 overflow-y-auto space-y-1">
          {filtered.map(t => (
            <button key={t.id} onClick={() => onSelect(t)} className="w-full flex items-center gap-2 px-3 py-2.5 bg-deep-navy rounded-lg hover:bg-white/5 text-left"><TeamChip team={t} /></button>
          ))}
        </div>
      </div>
    </div>
  );
};
