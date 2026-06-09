import { useEffect, useState } from 'react';
import { apiFootball } from '../../lib/apiFootballService';

export interface TeamStatBlock {
  teamId: number;
  teamName: string;
  teamLogo?: string;
  stats: Record<string, number | string | null>;
}
export interface MatchEvent {
  elapsed: number;
  extra?: number | null;
  teamId: number;
  teamName: string;
  player?: string | null;
  assist?: string | null;
  type: string;     // Goal | Card | subst | Var
  detail: string;   // Normal Goal | Yellow Card | ...
}

interface State { stats: TeamStatBlock[]; events: MatchEvent[]; loading: boolean; error: string | null; }

type StatsResp = { response?: Array<{ team?: { id?: number; name?: string; logo?: string }; statistics?: Array<{ type?: string; value?: number | string | null }> }> };
type EventsResp = { response?: Array<{ time?: { elapsed?: number; extra?: number | null }; team?: { id?: number; name?: string }; player?: { name?: string | null }; assist?: { name?: string | null }; type?: string; detail?: string }> };

export function useMatchStatsEvents(fixtureId?: number | null): State {
  const [state, setState] = useState<State>({ stats: [], events: [], loading: false, error: null });

  useEffect(() => {
    if (!fixtureId) { setState({ stats: [], events: [], loading: false, error: null }); return; }
    let cancelled = false;
    setState(s => ({ ...s, loading: true, error: null }));
    (async () => {
      try {
        const [statsRes, eventsRes] = await Promise.all([
          apiFootball<StatsResp>('/fixtures/statistics', { fixture: fixtureId }),
          apiFootball<EventsResp>('/fixtures/events', { fixture: fixtureId }),
        ]);
        if (cancelled) return;
        const stats: TeamStatBlock[] = (statsRes?.response ?? []).map(r => ({
          teamId: r.team?.id ?? 0,
          teamName: r.team?.name ?? '',
          teamLogo: r.team?.logo,
          stats: Object.fromEntries((r.statistics ?? []).map(s => [s.type ?? '', s.value ?? null])),
        }));
        const events: MatchEvent[] = (eventsRes?.response ?? []).map(e => ({
          elapsed: e.time?.elapsed ?? 0,
          extra: e.time?.extra ?? null,
          teamId: e.team?.id ?? 0,
          teamName: e.team?.name ?? '',
          player: e.player?.name ?? null,
          assist: e.assist?.name ?? null,
          type: e.type ?? '',
          detail: e.detail ?? '',
        })).sort((a, b) => (a.elapsed + (a.extra ?? 0)) - (b.elapsed + (b.extra ?? 0)));
        setState({ stats, events, loading: false, error: null });
      } catch (err: any) {
        if (!cancelled) setState({ stats: [], events: [], loading: false, error: err?.message ?? 'Failed to load stats' });
      }
    })();
    return () => { cancelled = true; };
  }, [fixtureId]);

  return state;
}
