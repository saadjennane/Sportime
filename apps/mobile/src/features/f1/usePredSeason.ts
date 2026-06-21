import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import type { PredDriver, PredLeaderRow } from './usePredGame';

export interface PredConstructor { id: number; name: string; logo: string | null }
export interface SeasonScoring { champion: number; driver_exact: number; driver_partial: number; constructor_exact: number; constructor_partial: number }
export interface SeasonGame {
  id: string; name: string; status: 'open' | 'settled'; season: number | null; entryCost: number;
  scoring: SeasonScoring; rewards: { upto: number; coins: number }[]; lockAt: string | null;
}
export interface SeasonCard {
  champion: number | null; top3_drivers: number[]; top3_constructors: number[];
  score: number | null; breakdown: any; status: string;
}

export function usePredSeason(gameId: string | null, userId?: string) {
  const [game, setGame] = useState<SeasonGame | null>(null);
  const [drivers, setDrivers] = useState<PredDriver[]>([]);
  const [constructors, setConstructors] = useState<PredConstructor[]>([]);
  const [card, setCard] = useState<SeasonCard | null>(null);
  const [board, setBoard] = useState<PredLeaderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!gameId) { setLoading(false); return; }
    setLoading(true);
    const { data: g } = await supabase
      .from('f1_pred_games').select('id,name,status,season,entry_cost,scoring,rewards,lock_at').eq('id', gameId).maybeSingle();
    if (!g) { setGame(null); setLoading(false); return; }
    setGame({
      id: g.id, name: g.name, status: g.status, season: g.season, entryCost: g.entry_cost ?? 0,
      scoring: g.scoring as SeasonScoring, rewards: (Array.isArray(g.rewards) ? g.rewards : []) as any, lockAt: g.lock_at,
    });

    const [{ data: dr }, { data: co }] = await Promise.all([
      supabase.from('f1_drivers').select('id,name,last_name,image,number,constructor_id,position').order('position', { nullsFirst: false }),
      supabase.from('f1_constructors').select('id,name,logo,position').order('position', { nullsFirst: false }),
    ]);
    const logo = new Map<number, string | null>((co ?? []).map((c: any) => [c.id, c.logo]));
    setDrivers(((dr ?? []) as any[]).map((d) => ({ id: d.id, name: d.name, last_name: d.last_name, image: d.image, number: d.number, team_logo: logo.get(d.constructor_id) ?? null })));
    setConstructors(((co ?? []) as any[]).map((c) => ({ id: c.id, name: c.name, logo: c.logo })));

    if (userId) {
      const { data: p } = await supabase
        .from('f1_pred_season_picks').select('champion,top3_drivers,top3_constructors,score,breakdown,status')
        .eq('game_id', gameId).eq('user_id', userId).maybeSingle();
      setCard(p ? { ...(p as any), top3_drivers: Array.isArray(p.top3_drivers) ? p.top3_drivers : [], top3_constructors: Array.isArray(p.top3_constructors) ? p.top3_constructors : [] } : null);
    }
    const { data: lb } = await supabase.rpc('f1_pred_season_leaderboard', { p_game_id: gameId });
    setBoard((lb ?? []) as PredLeaderRow[]);
    setLoading(false);
  }, [gameId, userId]);

  useEffect(() => { load(); }, [load]);

  const savePicks = useCallback(async (picks: { champion?: number | null; top3_drivers?: number[]; top3_constructors?: number[] }) => {
    if (!gameId) return { ok: false as const, error: 'No game' };
    const { error } = await supabase.rpc('f1_pred_save_season', { p_game_id: gameId, p_picks: picks });
    if (error) return { ok: false as const, error: error.message };
    await load();
    return { ok: true as const };
  }, [gameId, load]);

  return { game, drivers, constructors, card, board, loading, savePicks, refresh: load };
}
