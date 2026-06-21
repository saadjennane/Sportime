import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';

export interface DuelDriver { id: number; name: string; last_name: string; image: string | null; number: number | null; position: number | null }
export interface DuelLine { team_id: number; team_name: string; team_logo: string | null; a: DuelDriver; b: DuelDriver; fav_id: number }
export interface DuelGame {
  id: string;
  status: 'open' | 'locked' | 'settled';
  entryCost: number;
  rewards: Record<string, number>;
  upsetBonus: number;
  pairs: DuelLine[];
}
export interface DuelCard {
  picks: Record<string, number>;          // team_id → driver_id
  correct: number | null; upsets: number | null; faults: number | null;
  score: number | null; palier: number | null; reward: number | null;
  status: 'pending' | 'settled';
}
export interface DuelLeaderRow {
  user_id: string; username: string | null; avatar: string | null;
  correct: number; upsets: number; faults: number; score: number; palier: number | null; reward: number; rank: number;
}

export function useDuelGame(raceId: number | null | undefined, userId?: string) {
  const [game, setGame] = useState<DuelGame | null>(null);
  const [card, setCard] = useState<DuelCard | null>(null);
  const [board, setBoard] = useState<DuelLeaderRow[]>([]);
  const [outcomes, setOutcomes] = useState<Record<string, number | null>>({}); // team_id → winning driver id (null = void)
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!raceId) { setGame(null); setCard(null); setLoading(false); return; }
    setLoading(true);
    const { data: g } = await supabase
      .from('f1_duel_games')
      .select('id,status,entry_cost,rewards,upset_bonus,pairs')
      .eq('race_id', raceId).maybeSingle();
    if (!g) { setGame(null); setCard(null); setLoading(false); return; }
    const dg: DuelGame = {
      id: g.id, status: g.status, entryCost: g.entry_cost ?? 0,
      rewards: (g.rewards ?? {}) as Record<string, number>,
      upsetBonus: g.upset_bonus ?? 0,
      pairs: Array.isArray(g.pairs) ? g.pairs : [],
    };
    setGame(dg);

    if (userId) {
      const { data: p } = await supabase
        .from('f1_duel_picks')
        .select('picks,correct,upsets,faults,score,palier,reward,status')
        .eq('game_id', g.id).eq('user_id', userId).maybeSingle();
      setCard(p ? { ...(p as any), picks: (p.picks ?? {}) as Record<string, number> } : null);
    }
    if (g.status === 'settled') {
      const { data: lb } = await supabase.rpc('f1_duel_leaderboard', { p_game_id: g.id });
      setBoard((lb ?? []) as DuelLeaderRow[]);

      // Resolve the winner of each duel from the race results (mirrors f1_duel_settle).
      const { data: res } = await supabase.from('f1_results').select('driver_id,position,laps').eq('race_id', raceId);
      const rmap = new Map<number, { pos: number | null; laps: number | null }>();
      (res ?? []).forEach((r: any) => rmap.set(r.driver_id, { pos: r.position, laps: r.laps }));
      const out: Record<string, number | null> = {};
      for (const line of dg.pairs) {
        const ra = rmap.get(line.a.id); const rb = rmap.get(line.b.id);
        const pa = ra?.pos ?? null; const pb = rb?.pos ?? null;
        let winner: number | null = null;
        if (pa != null && pb != null) winner = pa < pb ? line.a.id : line.b.id;
        else if (pa != null) winner = line.a.id;
        else if (pb != null) winner = line.b.id;
        else { const la = ra?.laps ?? 0; const lb2 = rb?.laps ?? 0; if (la !== lb2) winner = la > lb2 ? line.a.id : line.b.id; }
        out[line.team_id] = winner;
      }
      setOutcomes(out);
    }
    setLoading(false);
  }, [raceId, userId]);

  useEffect(() => { load(); }, [load]);

  const savePicks = useCallback(async (picks: Record<string, number>) => {
    if (!game) return { ok: false as const, error: 'No game' };
    const { error } = await supabase.rpc('f1_duel_save_picks', { p_game_id: game.id, p_picks: picks });
    if (error) return { ok: false as const, error: error.message };
    await load();
    return { ok: true as const };
  }, [game, load]);

  return { game, card, board, outcomes, loading, savePicks, refresh: load };
}
