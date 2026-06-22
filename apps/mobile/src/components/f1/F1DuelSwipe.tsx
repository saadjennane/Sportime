import React, { useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate, type MotionValue, type PanInfo } from 'framer-motion';
import { X, Crown, Check } from 'lucide-react';
import type { DuelLine, DuelDriver } from '../../features/f1/useDuelGame';

const SUFFIX = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v']);
const last = (d: DuelDriver) => {
  const parts = (d.name || d.last_name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length > 1 && SUFFIX.has(parts[parts.length - 1].toLowerCase())) parts.pop();
  return parts[parts.length - 1] || d.last_name || '?';
};

const THRESHOLD = 60;
const FLY = 700;

const DriverCol: React.FC<{ d: DuelDriver; isFav: boolean; glow?: MotionValue<number> }> = ({ d, isFav, glow }) => (
  <div className="flex-1 min-w-0 flex flex-col items-center gap-1.5 relative">
    {glow && <motion.div style={{ opacity: glow }} className="absolute top-2 z-10 bg-lime-glow text-deep-navy rounded-full p-1.5"><Check size={20} /></motion.div>}
    {d.image ? <img src={d.image} alt="" className="w-32 h-32 rounded-full object-cover bg-navy-accent" /> : <div className="w-32 h-32 rounded-full bg-navy-accent" />}
    <div className="text-base font-bold text-text-primary text-center truncate max-w-full px-1 leading-tight">{last(d)}</div>
    <div className="flex items-center gap-1 text-xs text-text-secondary">P{d.position ?? '–'}{isFav ? <Crown size={12} className="text-warm-yellow" /> : <span className="text-lime-glow font-bold">+5</span>}</div>
  </div>
);

/** One card in the deck — owns its own drag x so exits never share state with the next card. */
const DeckCard: React.FC<{ line: DuelLine; idx: number; isTop: boolean; onCommit: (teamId: number, driverId: number, dir: -1 | 1) => void }>
  = ({ line, idx, isTop, onCommit }) => {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-14, 14]);
  const leftGlow = useTransform(x, [-THRESHOLD, -12], [1, 0]);
  const rightGlow = useTransform(x, [12, THRESHOLD], [0, 1]);
  const depth = Math.min(idx, 2);

  const onDragEnd = (_e: any, info: PanInfo) => {
    if (info.offset.x < -THRESHOLD || info.velocity.x < -500) onCommit(line.team_id, line.a.id, -1);
    else if (info.offset.x > THRESHOLD || info.velocity.x > 500) onCommit(line.team_id, line.b.id, 1);
    else animate(x, 0, { type: 'spring', stiffness: 350, damping: 30 });
  };

  return (
    <motion.div
      className="absolute inset-0 card-base p-5 select-none"
      style={{ x: isTop ? x : undefined, rotate: isTop ? rotate : undefined, zIndex: 30 - idx, cursor: isTop ? 'grab' : 'default' }}
      initial={{ scale: 1 - depth * 0.05, y: depth * 16, opacity: idx > 2 ? 0 : 1 }}
      animate={{ scale: 1 - depth * 0.05, y: depth * 16, opacity: 1 }}
      variants={{ exit: (dir: number) => ({ x: dir * FLY, opacity: 0, transition: { duration: 0.32, ease: 'easeOut' } }) }}
      exit="exit"
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      drag={isTop ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={isTop ? onDragEnd : undefined}
    >
      <div className="flex flex-col items-center gap-1 mb-5">
        {line.team_logo && <img src={line.team_logo} alt="" className="w-14 h-14 object-contain bg-white rounded-xl p-1.5" />}
        <div className="text-sm font-semibold text-text-secondary truncate max-w-full px-2">{line.team_name}</div>
      </div>
      <div className="flex items-start gap-2">
        <DriverCol d={line.a} isFav={line.fav_id === line.a.id} glow={isTop ? leftGlow : undefined} />
        <div className="text-text-disabled font-bold text-sm pt-14">VS</div>
        <DriverCol d={line.b} isFav={line.fav_id === line.b.id} glow={isTop ? rightGlow : undefined} />
      </div>
    </motion.div>
  );
};

/** Swipe mode for Teammates Duels — Tinder-style deck; swipe left = left driver, right = right driver. */
export const F1DuelSwipe: React.FC<{ lines: DuelLine[]; initialPicks: Record<string, number>; onPick: (teamId: number, driverId: number) => void; onClose: () => void }>
  = ({ lines, onPick, onClose }) => {
  const [i, setI] = useState(0);
  const [exitDir, setExitDir] = useState<number>(1); // resolved at exit time via AnimatePresence custom

  const line = lines[i];
  const done = i >= lines.length;
  const stack = lines.slice(i, i + 3); // top + 2 behind

  const commit = (teamId: number, driverId: number, dir: -1 | 1) => {
    setExitDir(dir);
    onPick(teamId, driverId);
    setI((n) => n + 1);
  };

  return (
    <div className="fixed inset-0 z-[80] bg-deep-navy flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="font-bold text-text-primary">Swipe your duels</div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-text-secondary tabular-nums">{Math.min(i + 1, lines.length)}/{lines.length}</span>
          <button onClick={onClose} className="p-1 text-text-secondary"><X size={22} /></button>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-5">
        {done ? (
          <div className="text-center space-y-4">
            <div className="text-lime-glow"><Check size={48} className="mx-auto" /></div>
            <div className="text-text-primary font-bold text-lg">All {lines.length} duels picked!</div>
            <button onClick={onClose} className="px-6 py-3 rounded-xl font-bold bg-electric-blue text-white">Back to card</button>
          </div>
        ) : (
          <>
            <div className="relative w-full max-w-sm" style={{ height: 430 }}>
              <AnimatePresence initial={false} custom={exitDir}>
                {stack.map((l, idx) => (
                  <DeckCard key={l.team_id} line={l} idx={idx} isTop={idx === 0} onCommit={commit} />
                ))}
              </AnimatePresence>
            </div>

            <div className="mt-6 flex items-center gap-3 w-full max-w-sm">
              <button onClick={() => commit(line.team_id, line.a.id, -1)} className="flex-1 py-3 rounded-xl bg-navy-accent border border-disabled text-text-primary font-bold text-sm truncate">← {last(line.a)}</button>
              <button onClick={() => commit(line.team_id, line.b.id, 1)} className="flex-1 py-3 rounded-xl bg-navy-accent border border-disabled text-text-primary font-bold text-sm truncate">{last(line.b)} →</button>
            </div>
            <div className="mt-2 text-[11px] text-text-secondary">Swipe left or right — or tap a name</div>
          </>
        )}
      </div>
    </div>
  );
};

export default F1DuelSwipe;
