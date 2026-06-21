import { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';

export interface F1Session { type: string; id: number; date: string; status: string }

export interface GrandPrix {
  id: number;
  name: string;
  country: string | null;
  city: string | null;
  circuitName: string | null;
  circuitImage: string | null;
  round: number | null;
  raceAt: string | null;
  qualiStartAt: string | null;
  status: string | null;
  sessions: F1Session[];
  apiCompetitionId: number | null;
}

const mapGp = (r: any): GrandPrix => ({
  id: r.id, name: r.name, country: r.country, city: r.city,
  circuitName: r.circuit_name, circuitImage: r.circuit_image, round: r.round,
  raceAt: r.race_at, qualiStartAt: r.quali_start_at, status: r.status,
  sessions: Array.isArray(r.sessions) ? r.sessions : [],
  apiCompetitionId: r.api_competition_id ?? null,
});

const GP_COLS = 'id,name,country,city,circuit_name,circuit_image,round,race_at,quali_start_at,status,sessions,api_competition_id';

/** Past Grands Prix (most recent first) for the results / sessions history. */
export function usePastGrandPrix(limit = 10) {
  const [gps, setGps] = useState<GrandPrix[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('f1_races')
        .select(GP_COLS)
        .neq('status', 'Cancelled')
        .lt('race_at', new Date().toISOString())
        .order('race_at', { ascending: false })
        .limit(limit);
      if (cancelled) return;
      setGps((data ?? []).map(mapGp));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [limit]);
  return { gps, loading };
}

/** The next Grand Prix whose race is still in the future (skips Cancelled). */
export function useNextGrandPrix() {
  const [gp, setGp] = useState<GrandPrix | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('f1_races')
        .select(GP_COLS)
        .neq('status', 'Cancelled')
        .gt('race_at', new Date().toISOString())
        .order('race_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      setGp(data ? mapGp(data) : null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return { gp, loading };
}
