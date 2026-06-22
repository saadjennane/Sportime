import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';

export type HofKind = 'driver' | 'constructor';
export interface HofCandidate { key: string; name: string; image: string | null }
export interface HofAggItem { key: string; name: string; image: string | null; count: number; pct: number }
export interface HofAgg { participants: number; items: HofAggItem[] }

export function useHof(kind: HofKind, userId?: string) {
  const [candidates, setCandidates] = useState<HofCandidate[]>([]);
  const [picks, setPicks] = useState<string[]>([]);
  const [agg, setAgg] = useState<HofAgg>({ participants: 0, items: [] });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: cand }, { data: a }] = await Promise.all([
      supabase.from('f1_hof_candidates').select('key,name,image').eq('kind', kind).order('sort_order'),
      supabase.rpc('f1_hof_aggregate', { p_kind: kind }),
    ]);
    setCandidates((cand ?? []) as HofCandidate[]);
    setAgg((a as any) ?? { participants: 0, items: [] });
    if (userId) {
      const { data: e } = await supabase.from('f1_hof_entries').select('picks').eq('user_id', userId).eq('kind', kind).maybeSingle();
      setPicks(Array.isArray((e as any)?.picks) ? (e as any).picks : []);
    } else setPicks([]);
    setLoading(false);
  }, [kind, userId]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (next: string[]) => {
    const { error } = await supabase.rpc('f1_hof_save', { p_kind: kind, p_picks: next });
    if (error) return { ok: false as const, error: error.message };
    await load();
    return { ok: true as const };
  }, [kind, load]);

  return { candidates, picks, agg, loading, save, refresh: load };
}
