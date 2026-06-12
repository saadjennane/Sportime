import React from 'react';

export interface PitchCell {
  grid: string;
  kind: 'player' | 'hole';
  name?: string;
  number?: number;
  pos?: string;
  photo?: string;
  holeIdx?: number;
  status?: 'open' | 'solved';   // hole state
  selected?: boolean;
  label?: string;               // surname shown when solved
  goal?: boolean;               // scored in this match
  assist?: boolean;             // assisted in this match
}

const Badge: React.FC<{ goal?: boolean; assist?: boolean }> = ({ goal, assist }) =>
  (goal || assist) ? <span className="absolute -top-1 -right-1.5 text-[11px] leading-none drop-shadow">{goal ? '⚽' : ''}{assist ? '👟' : ''}</span> : null;

const parseGrid = (g: string) => { const [r, c] = (g || '0:0').split(':').map(n => parseInt(n, 10)); return { row: isNaN(r) ? 0 : r, col: isNaN(c) ? 0 : c }; };
const posColor: Record<string, string> = { G: 'from-amber-400 to-amber-600', D: 'from-emerald-400 to-emerald-600', M: 'from-blue-400 to-blue-600', F: 'from-red-400 to-red-600' };

const PlayerNode: React.FC<{ c: PitchCell }> = ({ c }) => {
  const [err, setErr] = React.useState(false);
  return (
    <div className="flex flex-col items-center gap-0.5 w-[58px]">
      <div className="relative w-10 h-10">
        <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/40 shadow">
          {c.photo && !err
            ? <img src={c.photo} alt="" className="w-full h-full object-cover" onError={() => setErr(true)} />
            : <div className={`w-full h-full bg-gradient-to-b ${posColor[c.pos || ''] || 'from-gray-400 to-gray-600'} flex items-center justify-center text-white font-bold text-xs`}>{c.number ?? '?'}</div>}
        </div>
        <Badge goal={c.goal} assist={c.assist} />
      </div>
      <span className="text-[9px] font-semibold text-white/90 text-center leading-tight truncate max-w-[58px]">{(c.name || '').split(' ').pop()}</span>
    </div>
  );
};

const HoleNode: React.FC<{ c: PitchCell; showShirt: boolean; onSelect: () => void }> = ({ c, showShirt, onSelect }) => (
  <button onClick={onSelect} className="flex flex-col items-center gap-0.5 w-[58px]">
    <div className="relative w-10 h-10">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-extrabold text-base border-2 transition-all
        ${c.status === 'solved' ? 'bg-lime-glow/90 text-deep-navy border-white' : c.selected ? 'bg-warm-yellow text-deep-navy border-white scale-110' : 'bg-deep-navy/70 text-warm-yellow border-warm-yellow border-dashed'}`}>
        {c.status === 'solved' ? '✓' : (showShirt && c.number != null ? c.number : '?')}
      </div>
      <Badge goal={c.goal} assist={c.assist} />
    </div>
    <span className={`text-[9px] font-bold text-center leading-tight truncate max-w-[58px] ${c.status === 'solved' ? 'text-lime-glow' : 'text-warm-yellow'}`}>
      {c.status === 'solved' ? (c.label || c.name || '') : (c.pos || '?')}
    </span>
  </button>
);

export const GuessLineupPitch: React.FC<{ cells: PitchCell[]; showShirt?: boolean; onSelectHole: (idx: number) => void }> = ({ cells, showShirt = false, onSelectHole }) => {
  const rows = new Map<number, PitchCell[]>();
  for (const c of cells) { const { row } = parseGrid(c.grid); if (!rows.has(row)) rows.set(row, []); rows.get(row)!.push(c); }
  for (const [, arr] of rows) arr.sort((a, b) => parseGrid(a.grid).col - parseGrid(b.grid).col);
  const sortedRows = Array.from(rows.keys()).sort((a, b) => b - a);   // attack on top, GK at bottom

  return (
    <div className="relative w-full rounded-2xl overflow-hidden" style={{ aspectRatio: '3 / 4' }}>
      <div className="absolute inset-0" style={{ background: 'repeating-linear-gradient(to bottom,#1a472a 0 28px,#2d5a3a 28px 56px)' }} />
      {/* simple pitch markings */}
      <div className="absolute inset-2 border-2 border-white/20 rounded-lg" />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 border-2 border-white/20 rounded-full" />
      <div className="absolute left-0 right-0 top-1/2 h-[2px] bg-white/20" />
      <div className="relative h-full flex flex-col justify-evenly py-3">
        {sortedRows.map(rn => (
          <div key={rn} className="flex justify-center items-center gap-1.5">
            {(rows.get(rn) || []).map((c, i) => c.kind === 'hole'
              ? <HoleNode key={`h${i}`} c={c} showShirt={showShirt} onSelect={() => onSelectHole(c.holeIdx!)} />
              : <PlayerNode key={`p${i}`} c={c} />)}
          </div>
        ))}
      </div>
    </div>
  );
};
