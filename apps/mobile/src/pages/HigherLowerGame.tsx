import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Flame, ChevronUp, ChevronDown, Trophy, Share2 } from 'lucide-react';
import { getHlToday, submitHl, getPuzzleStats, HlToday } from '../services/puzzleService';
import { GameResultModal } from '../components/funzone/GameResultModal';
import { getValueIndex, HL_CRITERIA, critByKey, ValuePlayer, HlCriterion } from '../services/valueService';

interface Props { userId: string; onBack: () => void; addToast: (m: string, t: 'success' | 'error' | 'info') => void; initialCriterion?: string }

const HigherLowerGame: React.FC<Props> = ({ onBack, addToast, initialCriterion }) => {
  const [data, setData] = useState<HlToday | null>(null);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(false);
  const [pickCrit, setPickCrit] = useState('value');
  const [stats, setStats] = useState<any>(null);
  const [index, setIndex] = useState<ValuePlayer[]>([]);
  const [playing, setPlaying] = useState(false);
  const [left, setLeft] = useState<ValuePlayer | null>(null);
  const [right, setRight] = useState<ValuePlayer | null>(null);
  const [streak, setStreak] = useState(0);
  const [phase, setPhase] = useState<'play' | 'reveal'>('play');
  const [lastOk, setLastOk] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const usedRef = useRef<Set<number>>(new Set());

  const crit: HlCriterion = critByKey(data?.criterion ?? 'value');
  const pool = useMemo(() => index.filter(p => crit.valid(p)), [index, crit]);

  const load = useCallback(async (criterion?: string) => {
    setLoading(true);
    try {
      const d = await getHlToday(criterion);
      setData(d); if (d.criterion) setPickCrit(d.criterion);
      getPuzzleStats(undefined as any, 'higherlower').then(setStats).catch(() => {});
      if (!criterion && !d.has_prefs) setConfig(true);
    } catch { addToast('Could not load', 'error'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(initialCriterion); }, [load]);
  useEffect(() => { getValueIndex().then(setIndex).catch(() => {}); }, []);

  const confirmConfig = async () => { setConfig(false); setSummary(null); setPlaying(false); await load(pickCrit); };

  const rnd = (exclude?: number): ValuePlayer => {
    let avail = pool.filter(p => !usedRef.current.has(p.id) && p.id !== exclude);
    if (avail.length === 0) { usedRef.current = new Set(exclude != null ? [exclude] : []); avail = pool.filter(p => p.id !== exclude); }
    const p = avail[Math.floor(Math.random() * avail.length)];
    usedRef.current.add(p.id);
    return p;
  };
  const start = () => {
    usedRef.current = new Set();
    const a = rnd(); const b = rnd(a.id);
    setLeft(a); setRight(b); setStreak(0); setPhase('play'); setSummary(null); setPlaying(true);
  };

  const end = (finalStreak: number) => {
    setPlaying(false);
    if (data?.game) submitHl(data.game.id, finalStreak).then(s => { if (s?.ok) { setSummary(s); getPuzzleStats(undefined as any, 'higherlower').then(setStats); } }).catch(() => setSummary({ streak: finalStreak, pending: true }));
    else setSummary({ streak: finalStreak });
  };

  const guess = (dir: 'higher' | 'lower') => {
    if (phase !== 'play' || !left || !right) return;
    const lv = crit.get(left), rv = crit.get(right);
    const ok = dir === 'higher' ? rv >= lv : rv <= lv;
    setLastOk(ok); setPhase('reveal');
    setTimeout(() => {
      if (ok) { const ns = streak + 1; setStreak(ns); const nl = right; const nr = rnd(nl.id); setLeft(nl); setRight(nr); setPhase('play'); }
      else end(streak);
    }, 1200);
  };

  const Card = ({ p, value, hidden }: { p: ValuePlayer; value?: number; hidden?: boolean }) => (
    <div className="relative flex-1 flex flex-col items-center justify-center text-center px-4 overflow-hidden">
      {p.p && <img src={p.p} className="w-20 h-20 rounded-full object-cover border-2 border-white/30 mb-2" />}
      <p className="text-lg font-extrabold text-text-primary leading-tight">{p.n}</p>
      {hidden
        ? <p className="text-3xl font-extrabold text-warm-yellow mt-1">?</p>
        : <p className="text-3xl font-extrabold text-lime-glow mt-1">{crit.fmt(value ?? crit.get(p))}</p>}
    </div>
  );

  const Shell = (c: React.ReactNode) => (
    <div className="fixed inset-0 z-50 bg-deep-navy overflow-y-auto">
      <div className="max-w-md mx-auto h-full px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-6 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <button onClick={onBack}><ArrowLeft className="text-text-primary" /></button>
          <div className="flex items-center gap-3 text-sm">
            {stats && <span className="flex items-center gap-1 text-hot-red font-bold"><Flame size={16} /> {stats.current_streak}</span>}
            {playing && <span className="text-electric-blue font-extrabold">🔥 {streak}</span>}
          </div>
        </div>
        {c}
      </div>
    </div>
  );

  if (loading) return Shell(<div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-electric-blue border-t-transparent rounded-full animate-spin" /></div>);

  if (config) return Shell(
    <div className="py-4">
      <h1 className="text-2xl font-extrabold text-text-primary text-center mb-1">Higher or Lower</h1>
      <p className="text-text-secondary text-center text-sm mb-6">Pick a stat — one per game.</p>
      <div className="grid grid-cols-2 gap-2 mb-8">
        {HL_CRITERIA.map(c => (
          <button key={c.key} onClick={() => setPickCrit(c.key)} className={`p-3 rounded-xl border text-sm font-bold flex items-center gap-2 ${pickCrit === c.key ? 'border-electric-blue bg-electric-blue/10 text-text-primary' : 'border-white/10 text-text-secondary'}`}>
            <span>{c.emoji}</span> {c.label}</button>
        ))}
      </div>
      <button onClick={confirmConfig} className="w-full bg-electric-blue text-white font-bold py-3 rounded-xl">Select</button>
    </div>
  );

  if (!data?.game) return Shell(<div className="text-center py-20 text-text-secondary">Unavailable today.</div>);

  if (summary) {
    return (
      <GameResultModal
        meta={{ icon: '⬆️', label: 'Higher / Lower', accent: 'from-lime-glow/30 to-emerald-500/10' }}
        gameType="higherlower"
        statsLevel={data?.criterion}
        xp={50}
        hero={{ primary: `Streak: ${summary.streak}`, sub: `${crit.emoji} ${crit.label}`, win: true }}
        percentile={summary.percentile}
        extraActions={
          <button onClick={() => setConfig(true)} className="mt-2 w-full text-electric-blue font-semibold text-sm py-1.5">Change stat</button>
        }
        onShare={() => navigator.clipboard?.writeText(`Higher or Lower (${crit.label}) — streak ${summary.streak} 🔥`).then(() => addToast('Copied!', 'success'))}
        onReplay={start}
        onBack={onBack}
      />
    );
  }

  if (!playing) return Shell(
    <div className="text-center py-14">
      <div className="text-5xl mb-4">{crit.emoji}</div>
      <h1 className="text-2xl font-extrabold text-text-primary mb-1">Higher or Lower</h1>
      <p className="text-text-secondary mb-2">Guess if the next player has a higher or lower</p>
      <p className="text-lg font-extrabold text-electric-blue mb-5">{crit.label}</p>
      {(data.best ?? 0) > 0 && <p className="text-text-secondary text-sm mb-5">Your best: 🔥 {data.best}</p>}
      <button onClick={start} disabled={pool.length < 4} className="w-full bg-electric-blue text-white font-extrabold py-3.5 rounded-xl disabled:opacity-40">Start</button>
      <button onClick={() => setConfig(true)} className="mt-3 text-electric-blue font-semibold text-sm">Change stat</button>
    </div>
  );

  // playing
  return Shell(<div className="flex-1 flex flex-col">
    <p className="text-center text-xs text-text-secondary mb-1">{crit.emoji} {crit.label}</p>
    <div className="flex-1 flex flex-col rounded-2xl overflow-hidden border border-white/10">
      <div className="flex-1 flex bg-navy-accent/60 py-6"><Card p={left!} /></div>
      <div className="bg-deep-navy py-2 text-center text-text-secondary text-xs font-bold relative">
        <span className="absolute left-1/2 -translate-x-1/2 -top-3 bg-electric-blue text-white text-[10px] font-extrabold px-3 py-1 rounded-full">VS</span>
        has a {crit.label.toLowerCase()} that is…
      </div>
      <div className="flex-1 flex flex-col bg-navy-accent/30 py-6">
        <Card p={right!} hidden={phase === 'play'} value={crit.get(right!)} />
        {phase === 'play' ? (
          <div className="flex gap-2 px-4 mt-2">
            <button onPointerDown={(e) => { e.preventDefault(); guess('higher'); }} className="flex-1 py-3 rounded-xl bg-lime-glow text-deep-navy font-extrabold flex items-center justify-center gap-1"><ChevronUp size={18} /> Higher</button>
            <button onPointerDown={(e) => { e.preventDefault(); guess('lower'); }} className="flex-1 py-3 rounded-xl bg-warm-yellow text-deep-navy font-extrabold flex items-center justify-center gap-1"><ChevronDown size={18} /> Lower</button>
          </div>
        ) : (
          <p className={`text-center font-extrabold mt-2 ${lastOk ? 'text-lime-glow' : 'text-hot-red'}`}>{lastOk ? '✅ Correct!' : '❌ Wrong'}</p>
        )}
      </div>
    </div>
  </div>);
};

export default HigherLowerGame;
