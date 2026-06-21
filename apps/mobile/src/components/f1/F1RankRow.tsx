import React from 'react';

const driverName = (d: any) => d?.abbr || d?.name?.split(' ').slice(-1)[0] || '?';

/** One classification line — podium-coloured position, driver photo, full name,
 *  constructor logo (on a light backdrop so dark logos stay visible), time/gap. */
export const F1RankRow: React.FC<{ row: any; index: number }> = ({ row, index }) => {
  const pos = row.position ?? index + 1;
  const posColor = pos === 1 ? 'text-warm-yellow' : pos === 2 ? 'text-text-secondary' : pos === 3 ? 'text-[#CD7F32]' : 'text-text-disabled';
  return (
    <div className="flex items-center gap-3 px-2 py-2 border-t border-white/5 first:border-0">
      <span className={`w-5 text-center font-bold tabular-nums text-base ${posColor}`}>{pos}</span>
      {row.driver?.image
        ? <img src={row.driver.image} alt="" className="w-11 h-11 rounded-full object-cover bg-navy-accent shrink-0" />
        : <div className="w-11 h-11 rounded-full bg-navy-accent flex items-center justify-center text-xs font-bold text-text-secondary shrink-0">{driverName(row.driver).slice(0, 3)}</div>}
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-bold text-text-primary truncate leading-tight">{row.driver?.name || driverName(row.driver)}</div>
        {row.driver?.number != null && <div className="text-[11px] text-text-secondary tabular-nums">#{row.driver.number}</div>}
      </div>
      {row.team?.logo && <img src={row.team.logo} alt={row.team?.name ?? ''} className="w-7 h-7 object-contain bg-white rounded-md p-0.5 shrink-0" />}
      <span className="text-xs text-text-secondary tabular-nums shrink-0 w-16 text-right">{(row.time && String(row.time)) || row.gap || '—'}</span>
    </div>
  );
};

export default F1RankRow;
