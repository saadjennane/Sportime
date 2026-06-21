import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';

export interface PredDriver { id: number; name: string; last_name: string | null; image: string | null; number: number | null; team_logo: string | null }
export interface PredRace { id: number; name: string; round: number | null; race_at: string | null; quali_start_at: string | null; status: string | null; sprint_session_id: number | null }
export interface PredScoring { pole: number; winner: number; top5_exact: number; top5_partial: number; fastest_lap: number; first_dnf: number; sprint?: number }
export interface PredGame {
  id: string; name: string; status: 'open' | 'settled'; entryCost: number;
  scoring: PredScoring; rewards: { upto: number; coins: number }[]; raceIds: number[];
}
export interface PredCard {
  race_id: number; pole: number | null; winner: number | null; top5: number[];
  fastest_lap: number | null; first_dnf: number | null; sprint: number | null; score: number | null; breakdown: any; status: string;
}
export interface PredLeaderRow { user_id: string; username: string | null; avatar: string | null; score: number; gps_played: number; rank: number; reward: number }

export function usePredGame(gameId: string | null, userId?: string) {
  const [game, setGame] = useState<PredGame | null>(null);
  const [races, setRaces] = useState<PredRace[]>([]);
  const [drivers, setDrivers] = useState<PredDriver[]>([]);
  const [cards, setCards] = useState<Record<number, PredCard>>({}); // race_id → card
  const [board, setBoard] = useState<PredLeaderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!gameId) { setLoading(false); return; }
    setLoading(true);
    const { data: g } = await supabase
      .from('f1_pred_games').select('id,name,status,entry_cost,scoring,rewards,race_ids').eq('id', gameId).maybeSingle();
    if (!g) { setGame(null); setLoading(false); return; }
    setGame({
      id: g.id, name: g.name, status: g.status, entryCost: g.entry_cost ?? 0,
      scoring: g.scoring as PredScoring, rewards: (Array.isArray(g.rewards) ? g.rewards : []) as any, raceIds: g.race_ids ?? [],
    });

    const [{ data: rc }, { data: dr }, { data: co }] = await Promise.all([
      supabase.from('f1_races').select('id,name,round,race_at,quali_start_at,status,sprint_session_id').in('id', g.race_ids ?? []),
      supabase.from('f1_drivers').select('id,name,last_name,image,number,constructor_id,position').order('position', { nullsFirst: false }),
      supabase.from('f1_constructors').select('id,logo'),
    ]);
    const logo = new Map<number, string | null>((co ?? []).map((c: any) => [c.id, c.logo]));
    setRaces(((rc ?? []) as any[]).sort((a, b) => new Date(a.race_at ?? 0).getTime() - new Date(b.race_at ?? 0).getTime()));
    setDrivers(((dr ?? []) as any[]).map((d) => ({ id: d.id, name: d.name, last_name: d.last_name, image: d.image, number: d.number, team_logo: logo.get(d.constructor_id) ?? null })));

    if (userId) {
      const { data: p } = await supabase
        .from('f1_pred_picks').select('race_id,pole,winner,top5,fastest_lap,first_dnf,sprint,score,breakdown,status')
        .eq('game_id', gameId).eq('user_id', userId);
      const m: Record<number, PredCard> = {};
      (p ?? []).forEach((row: any) => { m[row.race_id] = { ...row, top5: Array.isArray(row.top5) ? row.top5 : [] }; });
      setCards(m);
    }
    const { data: lb } = await supabase.rpc('f1_pred_leaderboard', { p_game_id: gameId });
    setBoard((lb ?? []) as PredLeaderRow[]);
    setLoading(false);
  }, [gameId, userId]);

  useEffect(() => { load(); }, [load]);

  const savePicks = useCallback(async (raceId: number, picks: { pole?: number | null; winner?: number | null; top5?: number[]; fastest_lap?: number | null; first_dnf?: number | null; sprint?: number | null }) => {
    if (!gameId) return { ok: false as const, error: 'No game' };
    const { error } = await supabase.rpc('f1_pred_save_picks', { p_game_id: gameId, p_race_id: raceId, p_picks: picks });
    if (error) return { ok: false as const, error: error.message };
    await load();
    return { ok: true as const };
  }, [gameId, load]);

  return { game, races, drivers, cards, board, loading, savePicks, refresh: load };
}
