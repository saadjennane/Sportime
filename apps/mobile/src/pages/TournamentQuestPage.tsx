import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Trophy, Lock, Check, X, Clock, Star, Crown, Medal, Loader2 } from 'lucide-react';
import { PullToRefresh } from '../components/PullToRefresh';
import {
  TQCompetition, TQEntry, TQLeaderboardRow, TQTeam, TQMatch, TQDailyPick,
  getTournament, getMyTournamentEntry, getTournamentLeaderboard, isPhaseOpen,
  saveLongTerm, saveGroupPrediction, saveDailyPrediction, saveBracketPrediction,
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
  // Bumped on every reload so the sections (which seed local state from `entry` at
  // mount) remount and reflect server-recomputed picks/points.
  const [version, setVersion] = useState(0);

  const reload = async () => {
    const [c, e, l] = await Promise.all([
      getTournament(competitionId), getMyTournamentEntry(competitionId, userId), getTournamentLeaderboard(competitionId),
    ]);
    setComp(c); setEntry(e); setLb(l); setLoading(false); setVersion(v => v + 1);
  };
  useEffect(() => { setLoading(true); reload(); }, [competitionId]);

  const allTeams = useMemo(() => comp?.groups.flatMap(g => g.teams) ?? [], [comp]);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2200); };

  // Optimistic entry patches so the tab badges update the instant a prediction is saved
  // (auto-save is silent — no reload — so we reflect the change locally).
  const markDaily = (matchId: string, result: string) => setEntry(e => e && ({ ...e, dailyPicks: [...e.dailyPicks.filter(p => p.match_id !== matchId), { match_id: matchId, predicted_result: result, points_awarded: null } as any] }));
  const markGroup = (groupId: string, teamIds: string[]) => setEntry(e => e && ({ ...e, groupPicks: [...e.groupPicks.filter(p => p.group_id !== groupId), ...teamIds.map((predicted_team_id, i) => ({ group_id: groupId, predicted_team_id, predicted_position: i + 1 } as any))] }));
  const markLongTerm = (patch: any) => setEntry(e => e && ({ ...e, longTerm: { ...(e.longTerm ?? {}), ...patch } }));
  const markBracket = (round: string, winners: string[]) => setEntry(e => e && ({ ...e, bracketPicks: [...e.bracketPicks.filter(p => p.round_key !== round), ...winners.map(w => ({ round_key: round, predicted_winner_team_id: w } as any))] }));

  // Pending predictions per tab (badges show only while the relevant phase is OPEN).
  const pending = useMemo<Record<Tab, number>>(() => {
    const p: Record<Tab, number> = { picks: 0, groups: 0, daily: 0, bracket: 0 };
    if (!comp) return p;
    if (isPhaseOpen(comp, 'long_term')) {
      const lt = entry?.longTerm;
      if (!lt?.champion_team_id) p.picks++;
      if (!lt?.finalist_team_id) p.picks++;
      if (!lt?.top_scorer_player_id) p.picks++;
    }
    if (isPhaseOpen(comp, 'group')) {
      for (const g of comp.groups) {
        const picks = (entry?.groupPicks ?? []).filter(pk => pk.group_id === g.id);
        if (picks.length < g.qualified_count) p.groups++;
      }
    }
    const today = new Date();
    const isToday = (t: string | null) => {
      if (!t) return false;
      const d = new Date(t);
      return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
    };
    for (const m of comp.officialMatches) {
      const predictable = m.status === 'scheduled' && (m.start_time == null || new Date(m.start_time).getTime() > Date.now());
      // Daily badge = only TODAY's predictable matches not yet predicted (matches the Daily list).
      if (predictable && isToday(m.start_time) && !(entry?.dailyPicks ?? []).some(dp => dp.match_id === m.id)) p.daily++;
    }
    for (const r of comp.format.knockout_rounds) {
      if (!isPhaseOpen(comp, r)) continue;
      for (const m of comp.knockoutMatches.filter(km => km.knockout_round === r)) {
        const hasPick = (entry?.bracketPicks ?? []).some(bp => bp.round_key === r && (bp.predicted_winner_team_id === m.team_a?.id || bp.predicted_winner_team_id === m.team_b?.id));
        if (!hasPick) p.bracket++;
      }
    }
    return p;
  }, [comp, entry]);

  if (loading || !comp) {
    return (
      <div className="min-h-screen bg-deep-navy flex flex-col items-center justify-center gap-3 text-text-secondary">
        <Loader2 className="animate-spin text-electric-blue" size={32} />
        <span className="text-sm font-semibold">Loading tournament…</span>
      </div>
    );
  }

  const total = entry?.total_score ?? 0;

  return (
    <PullToRefresh onRefresh={reload}>
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
            className={`relative flex-1 py-3 text-xs font-semibold capitalize ${tab === t ? 'text-electric-blue border-b-2 border-electric-blue' : 'text-text-secondary'}`}>
            {t === 'picks' ? 'My Picks' : t === 'daily' ? 'Daily' : t}
            {pending[t] > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-hot-red text-white text-[10px] font-bold flex items-center justify-center">{pending[t]}</span>
            )}
          </button>
        ))}
      </div>

      <div className="p-4">
        {tab === 'picks' && <PicksSection key={`picks-${version}`} comp={comp} entry={entry} allTeams={allTeams} onPredicted={markLongTerm} flash={flash} />}
        {tab === 'groups' && <GroupsSection key={`groups-${version}`} comp={comp} entry={entry} onPredicted={markGroup} flash={flash} />}
        {tab === 'daily' && <DailySection key={`daily-${version}`} comp={comp} entry={entry} onPredicted={markDaily} flash={flash} />}
        {tab === 'bracket' && <BracketSection key={`bracket-${version}`} comp={comp} entry={entry} onPredicted={markBracket} flash={flash} />}
      </div>

      {toast && <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-electric-blue text-deep-navy font-bold px-4 py-2 rounded-full text-sm z-50 animate-scale-in">{toast}</div>}

      {lbOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end z-50" onClick={() => setLbOpen(false)}>
          <div className="bg-navy-accent w-full rounded-t-3xl max-h-[80vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3"><h2 className="font-bold text-lg">Leaderboard</h2><button onClick={() => setLbOpen(false)}><X size={22} className="text-text-secondary" /></button></div>
            {lb.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">🏁</div>
                <p className="text-text-secondary text-sm font-medium">No scores yet</p>
                <p className="text-text-disabled text-xs mt-1">Be the first to make your predictions.</p>
              </div>
            ) : lb.map(r => (
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
    </PullToRefresh>
  );
};

// ── My Picks ─────────────────────────────────────────────────────────────────
const PicksSection: React.FC<{ comp: TQCompetition; entry: TQEntry | null; allTeams: TQTeam[]; onPredicted: (patch: any) => void; flash: (m: string) => void }> = ({ comp, entry, allTeams, onPredicted, flash }) => {
  const open = isPhaseOpen(comp, 'long_term');
  const s = comp.config?.scoring?.long_term ?? {};
  const [champion, setChampion] = useState<string | null>(entry?.longTerm?.champion_team_id ?? null);
  const [finalist, setFinalist] = useState<string | null>(entry?.longTerm?.finalist_team_id ?? null);
  const [scorer, setScorer] = useState<string | null>(entry?.longTerm?.top_scorer_player_id ?? null);
  const [picking, setPicking] = useState<null | 'champion' | 'finalist'>(null);
  const [pickScorer, setPickScorer] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const first = useRef(true);
  const teamById = (id: string | null) => allTeams.find(t => t.id === id) ?? null;
  const scorerById = (id: string | null) => comp.players.find(p => p.id === id) ?? null;

  // Auto-save long-term picks (debounced) — no button, no full reload.
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!open) return;
    setStatus('saving');
    const t = setTimeout(async () => {
      const { error } = await saveLongTerm(comp.id, champion, finalist, null, scorer);
      if (error) { setStatus('idle'); flash(error.message); }
      else { setStatus('saved'); onPredicted({ champion_team_id: champion, finalist_team_id: finalist, top_scorer_player_id: scorer }); }
    }, 600);
    return () => clearTimeout(t);
  }, [champion, finalist, scorer]);

  return (
    <div className="space-y-3">
      {!open && <LockedBanner text="Long-term picks are locked." />}
      <PickRow icon={<Crown size={18} className="text-warm-yellow" />} label="Champion"
        value={teamById(champion) && <TeamChip team={teamById(champion)} />}
        points={`Exact ${s.champion_exact ?? 150} · Finalist ${s.champion_finalist ?? 75} · SF ${s.champion_semi ?? 30}`}
        disabled={!open} onClick={() => setPicking('champion')} />
      <PickRow icon={<Medal size={18} className="text-text-secondary" />} label="Finalist"
        value={teamById(finalist) && <TeamChip team={teamById(finalist)} />}
        points={`Exact ${s.finalist_exact ?? 100} · SF ${s.finalist_semi ?? 40}`}
        disabled={!open} onClick={() => setPicking('finalist')} />
      <PickRow icon={<Star size={18} className="text-warm-yellow" />} label="Top scorer"
        value={scorerById(scorer) && <span className="text-text-primary text-sm">{scorerById(scorer)!.name}</span>}
        points={`Exact ${s.top_scorer_exact ?? 100} · Top 3 ${s.top_scorer_top3 ?? 40} · Top 10 ${s.top_scorer_top10 ?? 15}`}
        disabled={!open || comp.players.length === 0} onClick={() => setPickScorer(true)} />
      {open && (
        <p className="text-center text-xs h-4">
          {status === 'saving' ? <span className="text-text-disabled">Saving…</span>
            : status === 'saved' ? <span className="text-lime-glow">✓ Saved automatically</span>
            : <span className="text-text-disabled">Your picks save automatically</span>}
        </p>
      )}

      {picking && (
        <PickerModal title="Choose a team" items={[...allTeams].sort((a, b) => a.name.localeCompare(b.name)).map(t => ({ id: t.id, label: t.name, team: t }))}
          onClose={() => setPicking(null)} onSelect={(id) => { picking === 'champion' ? setChampion(id) : setFinalist(id); setPicking(null); }} />
      )}
      {pickScorer && (
        <PickerModal title="Choose the top scorer" items={comp.players.map(p => ({ id: p.id, label: p.name }))}
          onClose={() => setPickScorer(false)} onSelect={(id) => { setScorer(id); setPickScorer(false); }} />
      )}
    </div>
  );
};

const PickRow: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; points: string; disabled: boolean; onClick: () => void }> = ({ icon, label, value, points, disabled, onClick }) => (
  <button onClick={onClick} disabled={disabled} className="w-full flex items-center gap-3 bg-navy-accent rounded-xl p-4 text-left disabled:opacity-60">
    {icon}
    <div className="flex-1 min-w-0">
      <p className="text-xs text-text-secondary">{label}</p>
      {value || <p className="text-text-disabled text-sm">Tap to choose</p>}
      <p className="text-[10px] text-text-disabled mt-0.5">{points}</p>
    </div>
    {!disabled && <span className="text-electric-blue text-sm">{value ? 'Change' : 'Pick'}</span>}
  </button>
);

// ── Groups (silent auto-save, qualifiers float to the top in pick order) ─────
const GroupsSection: React.FC<{ comp: TQCompetition; entry: TQEntry | null; onPredicted: (groupId: string, teamIds: string[]) => void; flash: (m: string) => void }> = ({ comp, entry, onPredicted, flash }) => {
  const open = isPhaseOpen(comp, 'group');
  const sc = comp.config?.scoring?.group ?? {};
  const initial: Record<string, string[]> = {};
  for (const g of comp.groups) {
    const picks = (entry?.groupPicks ?? []).filter(p => p.group_id === g.id).sort((a, b) => a.predicted_position - b.predicted_position);
    initial[g.id] = picks.map(p => p.predicted_team_id);
  }
  const [sel, setSel] = useState<Record<string, string[]>>(initial);

  const persist = async (groupId: string, ids: string[], prev: string[]) => {
    const picks = ids.map((team_id, i) => ({ team_id, position: i + 1 }));
    const { error } = await saveGroupPrediction(comp.id, groupId, picks);
    if (error) { flash(error.message); setSel(p => ({ ...p, [groupId]: prev })); } // rollback
    else onPredicted(groupId, ids);
  };
  const toggle = (groupId: string, teamId: string, max: number) => {
    const cur = sel[groupId] ?? [];
    let next: string[];
    if (cur.includes(teamId)) next = cur.filter(id => id !== teamId);
    else if (cur.length >= max) return;
    else next = [...cur, teamId];
    setSel(prev => ({ ...prev, [groupId]: next }));
    persist(groupId, next, cur);
  };

  return (
    <div className="space-y-4">
      {!open && <LockedBanner text="Group predictions are locked." />}
      <div className="bg-navy-accent/60 rounded-xl px-3 py-2.5 text-xs text-text-secondary">
        Pick the <b className="text-text-primary">top {comp.groups[0]?.qualified_count ?? 2}</b> of each group, in order. Saved automatically.
        <span className="block text-[11px] text-text-disabled mt-1">Qualified: +{sc.qualified ?? 5} · exact position: +{sc.exact_position ?? 5}</span>
      </div>
      {comp.groups.map(g => {
        const picks = sel[g.id] ?? [];
        // selected (in pick order) float to the top, then the rest
        const ordered = [...picks.map(id => g.teams.find(t => t.id === id)).filter(Boolean) as TQTeam[],
                         ...g.teams.filter(t => !picks.includes(t.id))];
        return (
          <div key={g.id} className="bg-navy-accent rounded-xl p-4">
            <div className="flex justify-between items-center mb-2"><h3 className="font-bold">{g.name}</h3><span className="text-[11px] text-text-disabled">{picks.length}/{g.qualified_count}</span></div>
            <div className="space-y-1.5">
              {ordered.map(t => {
                const pos = picks.indexOf(t.id);
                const chosen = pos >= 0;
                return (
                  <button key={t.id} disabled={!open} onClick={() => toggle(g.id, t.id, g.qualified_count)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${chosen ? 'border-electric-blue bg-electric-blue/10' : 'border-white/5 bg-deep-navy'} disabled:opacity-60`}>
                    <span className={`w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center ${chosen ? 'bg-electric-blue text-deep-navy' : 'bg-white/10 text-text-disabled'}`}>{chosen ? pos + 1 : ''}</span>
                    <TeamChip team={t} size="sm" />
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── Daily scores (predict the exact score of every official match — no bonus) ─
const DailySection: React.FC<{ comp: TQCompetition; entry: TQEntry | null; onPredicted: (matchId: string, result: 'A' | 'B' | 'draw') => void; flash: (m: string) => void }> = ({ comp, entry, onPredicted, flash }) => {
  const d = comp.config?.scoring?.daily ?? {};
  const isPredictable = (m: TQMatch) => m.status === 'scheduled' && (m.start_time == null || new Date(m.start_time).getTime() > Date.now());
  const isToday = (m: TQMatch) => {
    if (!m.start_time) return false;
    const dt = new Date(m.start_time), now = new Date();
    return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth() && dt.getDate() === now.getDate();
  };
  // Daily = only TODAY's matches to predict; results below stay visible.
  const upcoming = comp.officialMatches.filter(m => isPredictable(m) && isToday(m));
  const past = comp.officialMatches.filter(m => !isPredictable(m))
    .sort((a, b) => new Date(b.start_time ?? 0).getTime() - new Date(a.start_time ?? 0).getTime()); // most recent first
  const pickOf = (id: string) => entry?.dailyPicks.find(p => p.match_id === id) ?? null;

  if (comp.officialMatches.length === 0) return (
    <div className="card-base p-8 text-center">
      <div className="text-5xl mb-3">📅</div>
      <p className="text-text-secondary font-medium">No official matches yet</p>
      <p className="text-sm text-text-disabled mt-1">Come back on match days to predict the scores.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-text-primary">Daily Predictions</h2>
      <div className="bg-navy-accent/60 rounded-xl px-3 py-2.5 text-[11px] text-text-secondary">
        <b className="text-text-primary">Scoring:</b> pick 1·X·2 — a correct result pays your <b className="text-text-primary">locked odds × 100</b> pts.
      </div>

      {/* To predict */}
      {upcoming.length > 0
        ? upcoming.map(m => <DailyMatchCard key={m.id} comp={comp} match={m} existing={pickOf(m.id)} onPredicted={onPredicted} flash={flash} />)
        : <p className="text-sm text-text-disabled text-center py-2">No matches today — come back on the next match day.</p>}

      {/* Previous predictions / results (always visible underneath) */}
      {past.length > 0 && (
        <div className="space-y-2 pt-2">
          <p className="text-xs font-bold text-text-secondary uppercase tracking-wider">Previous predictions</p>
          {past.map(m => <DailyResultCard key={m.id} match={m} existing={pickOf(m.id)} />)}
        </div>
      )}
    </div>
  );
};

type Res = 'A' | 'B' | 'draw';
const DailyMatchCard: React.FC<{ comp: TQCompetition; match: TQMatch; existing: TQDailyPick | null; onPredicted: (matchId: string, result: Res) => void; flash: (m: string) => void }> = ({ comp, match, existing, onPredicted, flash }) => {
  const [pick, setPick] = useState<Res | null>((existing?.predicted_result as Res) ?? null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>(existing ? 'saved' : 'idle');
  const oddsFor = (r: Res) => r === 'A' ? match.odds_home : r === 'B' ? match.odds_away : match.odds_draw;
  const choose = async (r: Res) => {
    setPick(r); setStatus('saving');
    const { error } = await saveDailyPrediction(comp.id, match.id, r);
    if (error) { setStatus('idle'); flash(error.message); } else { setStatus('saved'); onPredicted(match.id, r); }
  };
  const Btn: React.FC<{ r: Res; label: string }> = ({ r, label }) => {
    const odds = oddsFor(r); const on = pick === r;
    return (
      <button onClick={() => choose(r)} className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 rounded-lg border ${on ? 'border-electric-blue bg-electric-blue/15' : 'border-white/10'}`}>
        <span className="text-xs font-bold text-text-primary truncate max-w-full px-1">{label}</span>
        <span className={`text-sm font-extrabold tabular-nums ${on ? 'text-electric-blue' : 'text-text-secondary'}`}>{odds != null ? Number(odds).toFixed(2) : '—'}</span>
        {odds != null && <span className="text-[9px] text-lime-glow font-bold">+{Math.round(Number(odds) * 100)} pts</span>}
      </button>
    );
  };
  return (
    <div className="bg-navy-accent rounded-xl p-4">
      <div className="flex items-center justify-between text-xs text-text-secondary mb-3">
        <span className="flex items-center gap-1"><Star size={12} className="text-warm-yellow" /> {match.team_a?.short_name} – {match.team_b?.short_name}</span>
        {match.start_time && <span className="flex items-center gap-1"><Clock size={12} /> {new Date(match.start_time).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>}
      </div>
      <div className="flex items-stretch gap-2">
        <Btn r="A" label={match.team_a?.short_name ?? '1'} />
        <Btn r="draw" label="Draw" />
        <Btn r="B" label={match.team_b?.short_name ?? '2'} />
      </div>
      <p className="text-center text-[11px] mt-2 h-4">
        {status === 'saving' ? <span className="text-text-disabled">Saving…</span>
          : status === 'saved' && pick ? <span className="text-lime-glow">✓ {pick === 'A' ? match.team_a?.short_name : pick === 'B' ? match.team_b?.short_name : 'Draw'} @ {Number(oddsFor(pick) ?? 0).toFixed(2)} — saved</span>
          : <span className="text-text-disabled">Tap 1, X or 2</span>}
      </p>
    </div>
  );
};

// Read-only result of a past official match: final score + your 1X2 pick + points.
const DailyResultCard: React.FC<{ match: TQMatch; existing: TQDailyPick | null }> = ({ match, existing }) => {
  const resolved = match.score_a != null && match.score_b != null;
  const pts = existing?.points_awarded ?? 0;
  const r = existing?.predicted_result;
  const pickLabel = r === 'A' ? match.team_a?.short_name : r === 'B' ? match.team_b?.short_name : r === 'draw' ? 'Draw' : null;
  return (
    <div className="bg-deep-navy rounded-xl p-3 border border-white/5">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex justify-end min-w-0"><TeamChip team={match.team_a} size="sm" /></div>
        <span className="text-sm font-bold text-text-primary tabular-nums">{resolved ? `${match.score_a}-${match.score_b}` : 'vs'}</span>
        <div className="flex justify-start min-w-0"><TeamChip team={match.team_b} size="sm" /></div>
      </div>
      <div className="flex items-center justify-between mt-2 text-[11px]">
        <span className="text-text-disabled">{pickLabel ? `Your pick: ${pickLabel}${existing?.locked_odds ? ` @ ${Number(existing.locked_odds).toFixed(2)}` : ''}` : 'Not predicted'}</span>
        {pickLabel
          ? (pts > 0 ? <span className="font-bold text-lime-glow">+{pts} pts</span> : resolved ? <span className="text-text-disabled">0 pts</span> : <span className="text-warm-yellow">pending</span>)
          : <span className="text-text-disabled">—</span>}
      </div>
    </div>
  );
};

const Stepper: React.FC<{ value: number | null; onChange: (v: number) => void; disabled?: boolean }> = ({ value, onChange, disabled }) => (
  <div className="flex items-center gap-3">
    <button disabled={disabled} onClick={() => onChange(value == null ? 0 : Math.max(0, value - 1))} className="w-8 h-8 rounded-full bg-deep-navy text-text-primary font-bold disabled:opacity-40">−</button>
    <span className={`text-2xl font-bold w-6 text-center ${value == null ? 'text-text-disabled' : ''}`}>{value == null ? '–' : value}</span>
    <button disabled={disabled} onClick={() => onChange(value == null ? 1 : Math.min(9, value + 1))} className="w-8 h-8 rounded-full bg-deep-navy text-text-primary font-bold disabled:opacity-40">+</button>
  </div>
);
// ── Bracket (living: predict the advancing team per tie, round by round) ─────
const BracketSection: React.FC<{ comp: TQCompetition; entry: TQEntry | null; onPredicted: (round: string, winners: string[]) => void; flash: (m: string) => void }> = ({ comp, entry, onPredicted, flash }) => {
  const rounds = comp.format.knockout_rounds;
  const matchesOf = (r: string) => comp.knockoutMatches.filter(m => m.knockout_round === r);

  // local picks: round -> { matchId -> winnerTeamId }
  const init: Record<string, Record<string, string>> = {};
  for (const r of rounds) {
    init[r] = {};
    const picked = (entry?.bracketPicks ?? []).filter(p => p.round_key === r).map(p => p.predicted_winner_team_id);
    for (const m of matchesOf(r)) {
      const w = picked.find(id => id === m.team_a?.id || id === m.team_b?.id);
      if (w) init[r][m.id] = w;
    }
  }
  const [picks, setPicks] = useState(init);
  const [savingRounds, setSavingRounds] = useState<Record<string, 'saving' | 'saved'>>({});
  const lastSaved = useRef<Record<string, string>>({});
  const setWinner = (round: string, matchId: string, teamId: string) =>
    setPicks(p => ({ ...p, [round]: { ...p[round], [matchId]: teamId } }));

  // Auto-save each round (debounced) whenever its picks change — no button, no reload.
  useEffect(() => {
    const t = setTimeout(() => {
      for (const r of rounds) {
        const winners = matchesOf(r).map(m => picks[r]?.[m.id]).filter(Boolean) as string[];
        const key = winners.join(',');
        if (lastSaved.current[r] === undefined) { lastSaved.current[r] = key; continue; } // skip initial seed
        if (lastSaved.current[r] === key) continue;
        lastSaved.current[r] = key;
        setSavingRounds(s => ({ ...s, [r]: 'saving' }));
        saveBracketPrediction(comp.id, r, winners).then(({ error }) => {
          if (error) { flash(error.message); setSavingRounds(s => { const n = { ...s }; delete n[r]; return n; }); }
          else { setSavingRounds(s => ({ ...s, [r]: 'saved' })); onPredicted(r, winners); }
        });
      }
    }, 600);
    return () => clearTimeout(t);
  }, [picks]);

  const anyPlayable = rounds.some(r => matchesOf(r).length > 0);

  return (
    <div className="space-y-4">
      {!anyPlayable && <LockedBanner text="The living bracket opens after the group stage. You'll predict who advances, round by round." />}
      {rounds.map(round => {
        const matches = matchesOf(round);
        const open = isPhaseOpen(comp, round);
        const weight = comp.config?.scoring?.bracket?.[round];
        const pickedCount = matches.filter(m => picks[round]?.[m.id]).length;
        const incomplete = open && pickedCount < matches.length;
        return (
          <div key={round} className="bg-navy-accent rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold flex items-center gap-2"><Trophy size={16} className="text-warm-yellow" /> {ROUND_LABEL[round] ?? round}</h3>
              <span className={`text-[11px] font-bold flex items-center gap-1 ${open ? 'text-lime-glow' : 'text-text-disabled'}`}>
                {matches.length === 0 ? <><Lock size={11} /> awaiting teams</> : open ? <>Open · {weight ?? 0} pts each</> : <><Lock size={11} /> locked</>}
              </span>
            </div>
            {matches.length === 0
              ? <p className="text-xs text-text-disabled">Teams set once the previous round finishes.</p>
              : <div className="space-y-3">
                  {/* Completion counter */}
                  {open && (
                    <p className={`text-[11px] font-semibold ${incomplete ? 'text-warm-yellow' : 'text-lime-glow'}`}>
                      {pickedCount}/{matches.length} predicted{incomplete ? ' — pick the rest before kick-off' : ' ✓'}
                    </p>
                  )}
                  {matches.map(m => {
                    const pick = picks[round]?.[m.id];
                    const resolved = m.winner_team_id != null;
                    const caption = resolved ? 'Result'
                      : m.start_time ? new Date(m.start_time).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : 'Date TBD';
                    const centerScore = (resolved && m.score_a != null) ? `${m.score_a}-${m.score_b}` : 'vs';
                    const teamBtn = (t: TQTeam | null) => {
                      if (!t) return <div className="flex-1" />;
                      const chosen = pick === t.id;
                      const won = resolved && m.winner_team_id === t.id;
                      return (
                        <button disabled={!open || resolved} onClick={() => setWinner(round, m.id, t.id)}
                          className={`flex-1 flex items-center gap-1.5 px-2 py-2.5 rounded-lg border text-left min-w-0 ${
                            won ? 'border-lime-glow bg-lime-glow/10'
                            : chosen ? 'border-electric-blue bg-electric-blue/10'
                            : 'border-white/5 bg-deep-navy'} disabled:opacity-70`}>
                          <TeamChip team={t} size="sm" />
                          {won && <Check size={13} className="text-lime-glow ml-auto shrink-0" />}
                        </button>
                      );
                    };
                    return (
                      <div key={m.id} className="space-y-1">
                        {/* Date/time as a caption — keeps the center column tiny so nothing wraps. */}
                        <p className="text-[10px] text-text-disabled text-center">{caption}</p>
                        <div className="flex items-center gap-1.5">
                          {teamBtn(m.team_a)}
                          <span className={`shrink-0 w-9 text-center text-xs font-bold ${resolved && m.score_a != null ? 'text-text-primary' : 'text-text-disabled'}`}>{centerScore}</span>
                          {teamBtn(m.team_b)}
                        </div>
                      </div>
                    );
                  })}
                  {open && (
                    <p className="text-center text-[11px] mt-1 h-4">
                      {savingRounds[round] === 'saving' ? <span className="text-text-disabled">Saving…</span>
                        : savingRounds[round] === 'saved' ? <span className="text-lime-glow">✓ Saved automatically</span>
                        : <span className="text-text-disabled">Picks save automatically</span>}
                    </p>
                  )}
                </div>}
          </div>
        );
      })}
    </div>
  );
};

// ── Shared ───────────────────────────────────────────────────────────────────
const LockedBanner: React.FC<{ text: string }> = ({ text }) => (
  <div className="flex items-center gap-2 bg-warm-yellow/10 border border-warm-yellow/30 text-warm-yellow rounded-xl px-3 py-2.5 text-sm"><Lock size={16} /> {text}</div>
);

const PickerModal: React.FC<{ title: string; items: { id: string; label: string; team?: TQTeam }[]; onClose: () => void; onSelect: (id: string) => void }> = ({ title, items, onClose, onSelect }) => {
  const [q, setQ] = useState('');
  const filtered = items.filter(i => i.label.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-navy-accent rounded-2xl w-full max-w-sm h-[70vh] flex flex-col p-4 border border-white/10" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3"><h2 className="font-bold">{title}</h2><button onClick={onClose}><X size={22} className="text-text-secondary" /></button></div>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" className="w-full bg-deep-navy border border-white/10 rounded-lg px-3 py-2 mb-3 text-text-primary placeholder:text-text-disabled" />
        <div className="flex-1 overflow-y-auto space-y-1">
          {filtered.map(i => (
            <button key={i.id} onClick={() => onSelect(i.id)} className="w-full flex items-center gap-2 px-3 py-2.5 bg-deep-navy rounded-lg hover:bg-white/5 text-left">
              {i.team ? <TeamChip team={i.team} /> : <span className="text-text-primary text-sm">{i.label}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
