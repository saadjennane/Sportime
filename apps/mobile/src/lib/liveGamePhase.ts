// Shared phase model for the Live tab + Play modal, across the 3 live-game types
// (Live Prediction, Match Royale, Live Fantasy).

export type LivePhase = 'ongoing' | 'not_started' | 'results' | 'finished';
export type LiveType = 'prediction' | 'match_royale' | 'live_fantasy';

export interface LiveItem {
  type: LiveType;
  gameId: string;
  fixtureId: string;
  kickoff: number;         // ms epoch (0 if unknown)
  fixture: {
    date?: string; status?: string;
    goals_home?: number | null; goals_away?: number | null;
    home: { name: string; logo?: string };
    away: { name: string; logo?: string };
  } | null;
  gameStatus: string;
  phase: LivePhase;
  raw: any;                // original row (type-specific fields: pot_amount, predicted_score, …)
}

const FX_FINISHED = new Set(['FT', 'AET', 'PEN']);
// A game is "settled" once payouts/points are computed. MR & Prediction land on
// 'finished'; LF on 'settled'. (Others kept for safety.)
const SETTLED = new Set(['finished', 'settled', 'closed', 'paid']);

export function computePhase(fixtureStatus: string | undefined, kickoffMs: number, gameStatus: string | undefined, now: number = Date.now()): LivePhase {
  if (gameStatus && SETTLED.has(gameStatus)) return 'finished';
  if (fixtureStatus && FX_FINISHED.has(fixtureStatus)) return 'results';
  if (kickoffMs && kickoffMs <= now) return 'ongoing';
  return 'not_started';
}

function normFixture(fx: any): LiveItem['fixture'] {
  if (!fx) return null;
  return {
    date: fx.date,
    status: fx.status,
    goals_home: fx.goals_home,
    goals_away: fx.goals_away,
    home: { name: fx.home?.name ?? 'Home', logo: fx.home?.logo_url ?? fx.home?.logo },
    away: { name: fx.away?.name ?? 'Away', logo: fx.away?.logo_url ?? fx.away?.logo },
  };
}

export function toLiveItem(type: LiveType, g: any): LiveItem | null {
  if (!g?.id) return null;
  const fx = normFixture(g.fixture);
  const kickoff = fx?.date ? new Date(fx.date).getTime() : 0;
  const gameStatus = String(g.status ?? '');
  return {
    type,
    gameId: g.id,
    fixtureId: g.fixture_id,
    kickoff,
    fixture: fx,
    gameStatus,
    phase: computePhase(fx?.status, kickoff, gameStatus),
    raw: g,
  };
}

export const PHASE_ORDER: LivePhase[] = ['ongoing', 'not_started', 'results', 'finished'];

export const PHASE_META: Record<LivePhase, { label: string; chip: string; emoji: string }> = {
  ongoing: { label: 'Ongoing', chip: 'bg-hot-red/15 text-hot-red', emoji: '🔴' },
  not_started: { label: 'Not Started', chip: 'bg-electric-blue/15 text-electric-blue', emoji: '⏳' },
  results: { label: 'Results', chip: 'bg-warm-yellow/15 text-warm-yellow', emoji: '🏁' },
  finished: { label: 'Finished', chip: 'bg-white/10 text-text-secondary', emoji: '📦' },
};

export const TYPE_META: Record<LiveType, { label: string; badge: string; emoji: string }> = {
  prediction: { label: 'Prediction', badge: 'bg-electric-blue/15 text-electric-blue', emoji: '🔮' },
  match_royale: { label: 'Match Royale', badge: 'bg-warm-yellow/15 text-warm-yellow', emoji: '🏆' },
  live_fantasy: { label: 'Live Fantasy', badge: 'bg-lime-glow/15 text-lime-glow', emoji: '⭐' },
};

/** Sort within a group by kickoff: upcoming = soonest first; live/past = most recent/advanced first. */
export function sortForPhase(items: LiveItem[], phase: LivePhase): LiveItem[] {
  const asc = phase === 'not_started';
  return [...items].sort((a, b) => (asc ? a.kickoff - b.kickoff : b.kickoff - a.kickoff));
}
