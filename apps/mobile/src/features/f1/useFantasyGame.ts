import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../services/supabase';

export type Cat = 'elite' | 'confirmed' | 'outsider';
export interface FDriver { id: number; name: string; last_name: string | null; image: string | null; number: number | null; constructor_id: number | null; category: Cat | null }
export interface FConstructor { id: number; name: string; logo: string | null; category: Cat | null }
export interface FRule { drivers: { elite: number; confirmed: number; outsider: number } | null; constructor_block?: string | null }
export interface FGame { id: string; condition: string; rule: FRule; status: string; raceName: string; qualiStartAt: string | null }
export interface FRoster {
  drivers: number[]; constructor_id: number | null; captain_driver_id: number | null; flp_driver_id: number | null;
  energy_shots: { type: 'driver' | 'constructor'; id: number }[]; score: number | null; breakdown: any; status: string;
}
export interface FLeaderRow { user_id: string; username: string | null; avatar: string | null; score: number; rank: number }

export function useFantasyGame(gameId: string | null, userId?: string) {
  const [game, setGame] = useState<FGame | null>(null);
  const [drivers, setDrivers] = useState<FDriver[]>([]);
  const [constructors, setConstructors] = useState<FConstructor[]>([]);
  const [roster, setRoster] = useState<FRoster | null>(null);
  const [energy, setEnergy] = useState<Record<string, number>>({});
  const [board, setBoard] = useState<FLeaderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!gameId) { setLoading(false); return; }
    setLoading(true);
    const { data: g } = await supabase
      .from('f1_fantasy_games').select('id,condition,rule,status,race:f1_races(name,quali_start_at)').eq('id', gameId).maybeSingle();
    if (!g) { setGame(null); setLoading(false); return; }
    setGame({ id: g.id, condition: g.condition, rule: (g.rule ?? {}) as FRule, status: g.status, raceName: (g as any).race?.name ?? 'Grand Prix', qualiStartAt: (g as any).race?.quali_start_at ?? null });

    const season = '(select max(season) from f1_drivers)';
    const [{ data: dr }, { data: co }] = await Promise.all([
      supabase.from('f1_drivers').select('id,name,last_name,image,number,constructor_id,category,season').order('rating', { ascending: false, nullsFirst: false }),
      supabase.from('f1_constructors').select('id,name,logo,category,season,position').order('position'),
    ]);
    const maxS = Math.max(0, ...((dr ?? []) as any[]).map((d) => d.season ?? 0));
    setDrivers(((dr ?? []) as any[]).filter((d) => d.season === maxS) as FDriver[]);
    setConstructors(((co ?? []) as any[]).filter((c) => c.season === maxS) as FConstructor[]);
    void season;

    if (userId) {
      const [{ data: r }, { data: en }] = await Promise.all([
        supabase.from('f1_fantasy_rosters').select('drivers,constructor_id,captain_driver_id,flp_driver_id,energy_shots,score,breakdown,status').eq('game_id', gameId).eq('user_id', userId).maybeSingle(),
        supabase.from('f1_fantasy_energy').select('entity_type,entity_id,energy').eq('user_id', userId),
      ]);
      setRoster(r ? { ...(r as any), drivers: Array.isArray((r as any).drivers) ? (r as any).drivers : [], energy_shots: Array.isArray((r as any).energy_shots) ? (r as any).energy_shots : [] } : null);
      const m: Record<string, number> = {};
      (en ?? []).forEach((e: any) => { m[`${e.entity_type}:${e.entity_id}`] = e.energy; });
      setEnergy(m);
    }
    const { data: lb } = await supabase.rpc('f1_fantasy_leaderboard', { p_game_id: gameId });
    setBoard((lb ?? []) as FLeaderRow[]);
    setLoading(false);
  }, [gameId, userId]);

  useEffect(() => { load(); }, [load]);
  // While the race is live, refresh the live score / leaderboard every 45s.
  useEffect(() => {
    if (game?.status !== 'live') return;
    const t = window.setInterval(() => { load(); }, 45000);
    return () => window.clearInterval(t);
  }, [game?.status, load]);

  const energyOf = useCallback((type: 'driver' | 'constructor', id: number) => energy[`${type}:${id}`] ?? 100, [energy]);

  const saveRoster = useCallback(async (p: { drivers: number[]; constructor: number; captain: number | null; flp: number | null; energyShots: { type: 'driver' | 'constructor'; id: number }[] }) => {
    const { error } = await supabase.rpc('f1_fantasy_save_roster', {
      p_game_id: gameId, p_drivers: p.drivers, p_constructor: p.constructor,
      p_captain: p.captain, p_flp: p.flp, p_energy_shots: p.energyShots,
    });
    if (error) return { ok: false as const, error: error.message };
    await load();
    return { ok: true as const };
  }, [gameId, load]);

  const driversByCat = useMemo(() => {
    const m: Record<string, FDriver[]> = { elite: [], confirmed: [], outsider: [] };
    drivers.forEach((d) => { if (d.category) m[d.category]?.push(d); });
    return m;
  }, [drivers]);

  return { game, drivers, constructors, driversByCat, roster, energyOf, board, loading, saveRoster, refresh: load };
}
