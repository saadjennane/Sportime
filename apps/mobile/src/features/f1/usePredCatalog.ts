import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import type { SportimeGame } from '../../types';

export const PRED_ID_PREFIX = 'f1pred:';
export const SEASON_ID_PREFIX = 'f1season:';
export const predGameId = (id: string): string | null =>
  id.startsWith(PRED_ID_PREFIX) ? id.slice(PRED_ID_PREFIX.length) : null;
export const seasonGameId = (id: string): string | null =>
  id.startsWith(SEASON_ID_PREFIX) ? id.slice(SEASON_ID_PREFIX.length) : null;

/** Maps GP Predictor games into the unified SportimeGame catalog (F1 Games list). */
export function usePredCatalog(userId: string | null | undefined) {
  const [games, setGames] = useState<SportimeGame[]>([]);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('f1_pred_games')
      .select('id,kind,name,race_ids,status,entry_cost,rewards,lock_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    const all = (data ?? []) as any[];
    const rows = all.filter((r) => r.kind === 'gp');
    const seasonRows = all.filter((r) => r.kind === 'season');
    if (!rows.length && !seasonRows.length) { setGames([]); setJoinedIds(new Set()); return; }

    const allRaceIds = Array.from(new Set(rows.flatMap((r) => r.race_ids ?? [])));
    const { data: races } = await supabase
      .from('f1_races').select('id,race_at,quali_start_at').in('id', allRaceIds.length ? allRaceIds : [-1]);
    const raceMap = new Map<number, { race_at: string | null; quali_start_at: string | null }>();
    (races ?? []).forEach((r: any) => raceMap.set(r.id, { race_at: r.race_at, quali_start_at: r.quali_start_at }));

    const joined = new Set<string>();
    if (userId) {
      const ids = [...rows, ...seasonRows].map((r) => r.id);
      const [{ data: gpPicks }, { data: seasonPicks }] = await Promise.all([
        rows.length ? supabase.from('f1_pred_picks').select('game_id').eq('user_id', userId).in('game_id', rows.map((r) => r.id)) : Promise.resolve({ data: [] as any[] }),
        seasonRows.length ? supabase.from('f1_pred_season_picks').select('game_id').eq('user_id', userId).in('game_id', seasonRows.map((r) => r.id)) : Promise.resolve({ data: [] as any[] }),
      ]);
      const gj = new Set((gpPicks ?? []).map((p: any) => p.game_id));
      const sj = new Set((seasonPicks ?? []).map((p: any) => p.game_id));
      rows.filter((r) => gj.has(r.id)).forEach((r) => joined.add(PRED_ID_PREFIX + r.id));
      seasonRows.filter((r) => sj.has(r.id)).forEach((r) => joined.add(SEASON_ID_PREFIX + r.id));
      void ids;
    }

    const now = Date.now();
    const mapped: SportimeGame[] = rows.map((r) => {
      const times = (r.race_ids ?? []).map((id: number) => raceMap.get(id)).filter(Boolean) as { race_at: string | null; quali_start_at: string | null }[];
      const raceTimes = times.map((t) => t.race_at).filter(Boolean).map((d) => new Date(d as string).getTime());
      const endMs = raceTimes.length ? Math.max(...raceTimes) : now + 7 * 864e5;
      const nextQuali = times.map((t) => t.quali_start_at).filter(Boolean).map((d) => new Date(d as string).getTime()).filter((t) => t > now).sort((a, b) => a - b)[0];
      const topReward = Math.max(0, ...(Array.isArray(r.rewards) ? r.rewards : []).map((t: any) => Number(t.coins) || 0));
      const status: SportimeGame['status'] = r.status === 'settled' ? 'Finished' : endMs <= now ? 'Ongoing' : 'Upcoming';
      return {
        id: PRED_ID_PREFIX + r.id,
        name: r.name,
        description: `Predict Pole · Winner · Top 5 · Fastest lap · First DNF across ${(r.race_ids ?? []).length} Grand Prix${(r.race_ids ?? []).length > 1 ? 's' : ''}.`,
        start_date: new Date().toISOString(),
        end_date: new Date(endMs).toISOString(),
        game_type: 'predictor',
        entry_cost: r.entry_cost ?? 0,
        minimum_players: 0, maximum_players: 1_000_000,
        status,
        totalPlayers: 0, participants: [],
        rewards: topReward > 0 ? [{ rank: '1', reward: { type: 'coins', amount: topReward } } as any] : [],
        first_kickoff_time: nextQuali ? new Date(nextQuali).toISOString() : undefined,
        entry_deadline: nextQuali ? new Date(nextQuali).toISOString() : undefined,
      };
    });

    const seasonMapped: SportimeGame[] = seasonRows.map((r) => {
      const lockMs = r.lock_at ? new Date(r.lock_at).getTime() : null;
      const topReward = Math.max(0, ...(Array.isArray(r.rewards) ? r.rewards : []).map((t: any) => Number(t.coins) || 0));
      const status: SportimeGame['status'] = r.status === 'settled' ? 'Finished' : (lockMs && lockMs <= now) ? 'Ongoing' : 'Upcoming';
      return {
        id: SEASON_ID_PREFIX + r.id,
        name: r.name,
        description: 'Forecast the season: Champion + Top 3 drivers + Top 3 constructors.',
        start_date: new Date().toISOString(),
        end_date: lockMs ? new Date(lockMs).toISOString() : new Date(now + 200 * 864e5).toISOString(),
        game_type: 'predictor',
        entry_cost: r.entry_cost ?? 0,
        minimum_players: 0, maximum_players: 1_000_000,
        status,
        totalPlayers: 0, participants: [],
        rewards: topReward > 0 ? [{ rank: '1', reward: { type: 'coins', amount: topReward } } as any] : [],
        first_kickoff_time: r.lock_at ?? undefined,
        entry_deadline: r.lock_at ?? undefined,
      };
    });

    setGames([...mapped, ...seasonMapped]);
    setJoinedIds(joined);
  }, [userId]);

  useEffect(() => { load(); }, [load]);
  return { predGames: games, predJoinedIds: joinedIds, refreshPred: load };
}
