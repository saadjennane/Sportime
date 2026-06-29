import React, { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { supabase } from '../../services/supabase';

/** Driver & Constructor championship standings (ordered by championship position). */
export const F1Standings: React.FC<{ type: 'drivers' | 'teams'; onClose: () => void }> = ({ type, onClose }) => {
  const [rows, setRows] = useState<any[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase) { setRows([]); return; }
      const res = type === 'drivers'
        ? await supabase.from('f1_drivers')
            .select('id,name,last_name,image,number,points,position, constructor:f1_constructors(name,logo)')
            .order('position', { nullsFirst: false })
        : await supabase.from('f1_constructors')
            .select('id,name,logo,points,position')
            .order('position', { nullsFirst: false });
      if (!cancelled) setRows(res.data ?? []);
    })();
    return () => { cancelled = true; };
  }, [type]);

  return (
    <div className="fixed inset-0 z-[70] bg-deep-navy flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="font-bold text-text-primary">{type === 'drivers' ? 'Drivers championship' : 'Teams championship'}</div>
        <button onClick={onClose} className="p-2 text-text-secondary"><X size={20} /></button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {rows == null ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-electric-blue" size={28} /></div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-center text-text-secondary text-sm">No standings available.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {rows.map((r, i) => {
              const pos = r.position ?? i + 1;
              const posColor = pos === 1 ? 'text-warm-yellow' : pos === 2 ? 'text-text-secondary' : pos === 3 ? 'text-[#CD7F32]' : 'text-text-disabled';
              const img = type === 'drivers' ? r.image : r.logo;
              const label = type === 'drivers' ? (r.last_name || r.name) : r.name;
              return (
                <div key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className={`w-6 text-center font-bold tabular-nums ${posColor}`}>{pos}</span>
                  {img
                    ? <img src={img} alt="" className={`w-9 h-9 shrink-0 ${type === 'teams' ? 'object-contain bg-white rounded-md p-1' : 'rounded-full object-cover bg-navy-accent'}`} />
                    : <div className="w-9 h-9 rounded-full bg-navy-accent shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-text-primary truncate">{label}</div>
                    {type === 'drivers' && r.constructor?.name && <div className="text-[11px] text-text-secondary truncate">{r.constructor.name}</div>}
                  </div>
                  {r.points != null && <span className="text-sm font-bold text-text-primary tabular-nums shrink-0">{r.points} pts</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default F1Standings;
