import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';

export interface F1ResultBet {
  key: string;
  label: string;
  marketLabel: string;
  image: string | null;
  teamLogo: string | null;
  odds: number;
  stake: number;
  status: string;     // won | lost | void
  net: number;        // won: +profit · lost: -stake · void: 0
}
export interface F1ResultGroup {
  raceId: number;
  name: string;
  round: number | null;
  raceAt: string | null;
  bets: F1ResultBet[];
  totalNet: number;
}

export function useF1Results(userId?: string) {
  const [groups, setGroups] = useState<F1ResultGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) { setGroups([]); setLoading(false); return; }
    setLoading(true);
    const { data: betRows } = await supabase
      .from('f1_bets')
      .select('race_id,market_key,entity_id,selection,odds,stake,potential_win,status,settled_at')
      .eq('user_id', userId).neq('status', 'pending').order('settled_at', { ascending: false });
    const bets = betRows ?? [];
    if (!bets.length) { setGroups([]); setLoading(false); return; }

    const raceIds = [...new Set(bets.map((b: any) => b.race_id))];
    const [races, markets, drivers, constructors] = await Promise.all([
      supabase.from('f1_races').select('id,name,round,race_at').in('id', raceIds),
      supabase.from('f1_markets').select('key,label,scope'),
      supabase.from('f1_drivers').select('id,last_name,name,image,constructor_id'),
      supabase.from('f1_constructors').select('id,name,logo'),
    ]);
    const raceMap = new Map<number, any>((races.data ?? []).map((r: any) => [r.id, r]));
    const mkMap = new Map<string, any>((markets.data ?? []).map((m: any) => [m.key, m]));
    const drMap = new Map<number, any>((drivers.data ?? []).map((d: any) => [d.id, d]));
    const coMap = new Map<number, any>((constructors.data ?? []).map((c: any) => [c.id, c]));

    const byRace = new Map<number, F1ResultGroup>();
    for (const b of bets as any[]) {
      const mk = mkMap.get(b.market_key);
      let label = ''; let image: string | null = null; let teamLogo: string | null = null;
      if (mk?.scope === 'driver' && b.entity_id != null) {
        const d = drMap.get(b.entity_id);
        label = d?.last_name || d?.name || `#${b.entity_id}`;
        image = d?.image ?? null;
        teamLogo = d?.constructor_id != null ? coMap.get(d.constructor_id)?.logo ?? null : null;
      } else if (mk?.scope === 'constructor' && b.entity_id != null) {
        const c = coMap.get(b.entity_id);
        label = c?.name || `#${b.entity_id}`; teamLogo = c?.logo ?? null;
      } else {
        label = b.selection === 'no' ? 'No' : 'Yes';
      }
      const net = b.status === 'won' ? b.potential_win - b.stake : b.status === 'lost' ? -b.stake : 0;
      const r = raceMap.get(b.race_id);
      if (!byRace.has(b.race_id)) byRace.set(b.race_id, { raceId: b.race_id, name: r?.name ?? 'Grand Prix', round: r?.round ?? null, raceAt: r?.race_at ?? null, bets: [], totalNet: 0 });
      const g = byRace.get(b.race_id)!;
      g.bets.push({ key: `${b.market_key}|${b.entity_id ?? ''}|${b.selection ?? ''}`, label, marketLabel: mk?.label ?? b.market_key, image, teamLogo, odds: Number(b.odds), stake: b.stake, status: b.status, net });
      g.totalNet += net;
    }
    setGroups([...byRace.values()].sort((a, b) => new Date(b.raceAt ?? 0).getTime() - new Date(a.raceAt ?? 0).getTime()));
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);
  return { groups, loading, refresh: load };
}
