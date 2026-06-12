import React, { useState } from 'react';

// Wordle feedback: 2 = green (right letter, right spot), 1 = yellow (in word, wrong spot), 0 = gray.
export function wordleFeedback(guess: string, target: string): number[] {
  const res = new Array(guess.length).fill(0);
  const counts: Record<string, number> = {};
  for (const ch of target) counts[ch] = (counts[ch] || 0) + 1;
  for (let i = 0; i < guess.length; i++) if (guess[i] === target[i]) { res[i] = 2; counts[guess[i]]--; }
  for (let i = 0; i < guess.length; i++) if (res[i] === 0 && counts[guess[i]] > 0) { res[i] = 1; counts[guess[i]]--; }
  return res;
}
export const fbEmoji = (fb: number[]) => fb.map(v => v === 2 ? '🟩' : v === 1 ? '🟨' : '⬜').join('');

const Tile: React.FC<{ ch?: string; state?: number; active?: boolean }> = ({ ch, state, active }) => {
  const bg = state === 2 ? 'bg-lime-glow text-deep-navy border-lime-glow'
    : state === 1 ? 'bg-warm-yellow text-deep-navy border-warm-yellow'
    : state === 0 ? 'bg-navy-accent text-text-disabled border-navy-accent'
    : active ? 'bg-transparent text-text-primary border-electric-blue/60' : 'bg-transparent text-text-primary border-white/15';
  return <div className={`flex-1 aspect-square rounded-md border-2 flex items-center justify-center font-extrabold text-lg ${bg}`}>{ch}</div>;
};

interface Props {
  target: string;                       // normalized A-Z surname
  rows: string[];                       // submitted guesses
  solved: boolean;
  onSubmit: (guess: string) => void;    // parent validates + stores
  onGiveUp: () => void;
}

export const WordleHole: React.FC<Props> = ({ target, rows, solved, onSubmit, onGiveUp }) => {
  const [cur, setCur] = useState('');
  const L = target.length;
  const submit = () => { if (cur.length === L && !solved) { onSubmit(cur); setCur(''); } };

  return (
    <div>
      <div className="space-y-1.5">
        {rows.map((g, ri) => {
          const fb = wordleFeedback(g, target);
          return <div key={ri} className="flex gap-1.5">{Array.from({ length: L }).map((_, i) => <Tile key={i} ch={g[i]} state={fb[i]} />)}</div>;
        })}
        {!solved && (
          <div className="flex gap-1.5">{Array.from({ length: L }).map((_, i) => <Tile key={i} ch={cur[i]} active />)}</div>
        )}
      </div>
      {!solved && (
        <>
          <div className="mt-3 flex items-center gap-2">
            <input
              value={cur}
              onChange={e => setCur(e.target.value.toUpperCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^A-Z]/g, '').slice(0, L))}
              onKeyDown={e => { if (e.key === 'Enter') submit(); }}
              placeholder={`${L} letters`} autoFocus
              className="flex-1 bg-navy-accent rounded-xl px-3 py-2.5 outline-none text-text-primary tracking-[0.3em] font-bold uppercase placeholder:tracking-normal placeholder:font-normal placeholder:text-text-disabled" />
            <button onPointerDown={(e) => { e.preventDefault(); submit(); }} disabled={cur.length !== L}
              className="px-4 py-2.5 rounded-xl bg-electric-blue text-white font-bold disabled:opacity-40">Go</button>
          </div>
          <button onPointerDown={(e) => { e.preventDefault(); onGiveUp(); }} className="mt-2 w-full text-text-disabled text-sm font-semibold py-1.5 active:opacity-60">Give up this player</button>
        </>
      )}
    </div>
  );
};
