import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';

export interface F1Selection {
  key: string;                 // `${entityId ?? ''}|${selection ?? ''}`
  entityId: number | null;
  selection: string | null;
  label: string;               // driver last name / constructor name / Yes / No
  sublabel?: string;           // #num · team
  image?: string | null;
  teamLogo?: string | null;
  odds: number;
}

export interface F1MarketView {
  key: string;
  label: string;
  type: string;                // outright | yesno_entity | yesno_single
  scope: string;               // driver | constructor | race
  source: string;
  locked: boolean;
  selections: F1Selection[];   // sorted by odds asc (favourites first)
}

export interface F1Bet {
  market_key: string;
  entity_id: number | null;
  selection: string | null;
  odds: number;
  stake: number;
  potential_win: number;
  status: string;
}

const betKey = (marketKey: string, entityId: number | null, selection: string | null) =>
  `${marketKey}|${entityId ?? ''}|${selection ?? ''}`;

export function useRaceBetting(raceId: number | null | undefined, userId?: string) {
  const [markets, setMarkets] = useState<F1MarketView[]>([]);
  const [bets, setBets] = useState<Map<string, F1Bet>>(new Map());
  const [loading, setLoading] = useState(true);

  const loadBets = useCallback(async () => {
    if (!raceId || !userId) { setBets(new Map()); return; }
    const { data } = await supabase
      .from('f1_bets')
      .select('market_key,entity_id,selection,odds,stake,potential_win,status')
      .eq('race_id', raceId).eq('user_id', userId);
    const m = new Map<string, F1Bet>();
    (data ?? []).forEach((b: any) => m.set(betKey(b.market_key, b.entity_id, b.selection), b as F1Bet));
    setBets(m);
  }, [raceId, userId]);

  const load = useCallback(async () => {
    if (!raceId) { setMarkets([]); setLoading(false); return; }
    setLoading(true);
    const [mk, od, dr, co] = await Promise.all([
      supabase.from('f1_markets').select('key,label,type,scope,source,sort_order').eq('is_visible', true).order('sort_order'),
      supabase.from('f1_odds').select('market_key,entity_id,selection,odds,locks_at').eq('race_id', raceId),
      supabase.from('f1_drivers').select('id,last_name,name,number,image,constructor_id'),
      supabase.from('f1_constructors').select('id,name,logo'),
    ]);
    const drivers = new Map<number, any>((dr.data ?? []).map((d: any) => [d.id, d]));
    const constructors = new Map<number, any>((co.data ?? []).map((c: any) => [c.id, c]));
    const now = Date.now();

    const views: F1MarketView[] = [];
    for (const m of (mk.data ?? []) as any[]) {
      const rows = (od.data ?? []).filter((o: any) => o.market_key === m.key);
      if (!rows.length) continue; // only show markets that have odds entered
      const locked = rows.some((o: any) => o.locks_at && new Date(o.locks_at).getTime() <= now);
      const selections: F1Selection[] = rows.map((o: any) => {
        let label = ''; let sublabel: string | undefined; let image: string | null = null; let teamLogo: string | null = null;
        if (m.scope === 'driver' && o.entity_id != null) {
          const d = drivers.get(o.entity_id);
          label = d?.last_name || d?.name || `#${o.entity_id}`;
          const team = d?.constructor_id != null ? constructors.get(d.constructor_id) : null;
          sublabel = [d?.number ? `#${d.number}` : null, team?.name].filter(Boolean).join(' · ');
          image = d?.image ?? null; teamLogo = team?.logo ?? null;
        } else if (m.scope === 'constructor' && o.entity_id != null) {
          const c = constructors.get(o.entity_id);
          label = c?.name || `#${o.entity_id}`; teamLogo = c?.logo ?? null;
        } else {
          label = o.selection === 'no' ? 'No' : 'Yes';
        }
        return { key: `${o.entity_id ?? ''}|${o.selection ?? ''}`, entityId: o.entity_id, selection: o.selection, label, sublabel, image, teamLogo, odds: Number(o.odds) };
      }).sort((a, b) => a.odds - b.odds);
      views.push({ key: m.key, label: m.label, type: m.type, scope: m.scope, source: m.source, locked, selections });
    }
    setMarkets(views);
    await loadBets();
    setLoading(false);
  }, [raceId, loadBets]);

  useEffect(() => { load(); }, [load]);

  const placeBet = useCallback(async (marketKey: string, entityId: number | null, selection: string | null, stake: number) => {
    const { data, error } = await supabase.rpc('f1_place_bet', {
      p_race_id: raceId, p_market_key: marketKey, p_entity_id: entityId, p_selection: selection, p_amount: stake,
    });
    if (error) return { ok: false as const, error: error.message };
    await loadBets();
    const row = Array.isArray(data) ? data[0] : data;
    return { ok: true as const, newBalance: row?.new_balance as number | undefined };
  }, [raceId, loadBets]);

  const cancelBet = useCallback(async (marketKey: string, entityId: number | null, selection: string | null) => {
    const { data, error } = await supabase.rpc('f1_cancel_bet', {
      p_race_id: raceId, p_market_key: marketKey, p_entity_id: entityId, p_selection: selection,
    });
    if (error) return { ok: false as const, error: error.message };
    await loadBets();
    const row = Array.isArray(data) ? data[0] : data;
    return { ok: true as const, newBalance: row?.new_balance as number | undefined };
  }, [raceId, loadBets]);

  return { markets, bets, betKey, loading, placeBet, cancelBet, refresh: load };
}
