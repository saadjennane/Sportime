// Fan Pulse — fans build XIs for their club and see the aggregated "pulse" (% of
// fans picking each player). Backend: fan_pulse_legends / fan_pulse_entries /
// fan_pulse_aggregate. Squads reuse fb_players.
import { supabase } from './supabase';

export interface Club { id: string; name: string; logo: string | null; }
export type Bucket = 'GK' | 'DEF' | 'MID' | 'FWD';
export interface Legend { id: string; player_key: string; name: string; position: Bucket; photo_url: string | null; }
export interface PulsePick { player_key: string; name: string; photo: string | null; position: Bucket; is_starter: boolean; slot: number; buy?: boolean; }
export interface AggPlayer { player_key: string; name: string; photo: string | null; position: Bucket; count: number; pct: number; }
export interface AggSlot extends AggPlayer { slot: number; buy?: boolean; }
export interface AggCoach { coach_key: string; name: string; photo: string | null; count: number; pct: number; }
export interface Aggregate { participants: number; players: AggPlayer[]; slots: AggSlot[]; coach: AggCoach | null; }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const toClub = (t: any): Club => ({ id: t.id, name: t.name, logo: t.logo || t.logo_url || null });

// In-memory caches so re-opening Fan Pulse (or a builder) within a session is
// instant instead of re-spinning. Cleared on club change.
const clubCache = new Map<string, Club | null>();
const legendsCache = new Map<string, Legend[]>();

/** Resolve users.favorite_club (stores a team id, or a legacy name like 'team-2') to a club. */
export async function getFavoriteClub(userId: string): Promise<Club | null> {
  if (clubCache.has(userId)) return clubCache.get(userId)!;
  const { data: prof } = await supabase.from('users').select('favorite_club').eq('id', userId).maybeSingle();
  const fav = (prof as any)?.favorite_club;
  if (!fav || !UUID.test(fav)) { clubCache.set(userId, null); return null; } // legacy values ('team-2') → pick again
  const { data } = await supabase.from('fb_teams').select('id, name, logo_url, logo').eq('id', fav).limit(1).maybeSingle();
  const club = data ? toClub(data) : null;
  if (club) clubCache.set(userId, club); // don't cache a transient miss as the answer
  return club;
}

export async function setFavoriteClub(userId: string, teamId: string) {
  clubCache.delete(userId);
  return supabase.from('users').update({ favorite_club: teamId }).eq('id', userId);
}

export async function searchClubs(query: string): Promise<Club[]> {
  // Accent-insensitive RPC (so "munchen" matches "München", "atletico" → "Atlético").
  const { data } = await supabase.rpc('fb_search_clubs', { p_q: query });
  return (data ?? []).map(toClub);
}

// Default suggestions shown before the user searches — Barcelona first (only club
// with seeded legends), then big recognizable clubs.
const SUGGESTED = ['Barcelona', 'Real Madrid', 'Manchester City', 'Manchester United', 'Liverpool', 'Arsenal', 'Chelsea', 'Bayern', 'Paris', 'Juventus', 'Inter', 'Milan'];
let suggestedCache: Club[] | null = null;
export async function getSuggestedClubs(): Promise<Club[]> {
  if (suggestedCache) return suggestedCache;
  const { data } = await supabase.from('fb_teams').select('id, name, logo_url, logo')
    .or(SUGGESTED.map(n => `name.ilike.%${n}%`).join(','));
  const rank = (name: string) => { const i = SUGGESTED.findIndex(n => name.toLowerCase().includes(n.toLowerCase())); return i < 0 ? 99 : i; };
  // De-dupe to one club per suggestion keyword (avoids "Inter Miami"/"Inter" clashes
  // and reserve/women teams) and order by the curated priority.
  const seen = new Set<number>(); const out: Club[] = [];
  for (const t of (data ?? []).sort((a, b) => rank(a.name) - rank(b.name)).map(toClub)) {
    const r = rank(t.name); if (seen.has(r)) continue; seen.add(r); out.push(t);
  }
  suggestedCache = out;
  return out;
}

/** Seed a club's all-time legends on demand (Wikidata). Returns how many were added. */
export async function seedLegends(teamId: string, teamName: string): Promise<number> {
  legendsCache.delete(teamId);
  const { data } = await supabase.functions.invoke('seed-legends', { body: { team_id: teamId, team_name: teamName } });
  return (data as any)?.count ?? 0;
}

export async function getLegends(teamId: string): Promise<Legend[]> {
  const cached = legendsCache.get(teamId);
  if (cached) return cached;
  const { data } = await supabase.from('fan_pulse_legends').select('id, player_key, name, position, photo_url')
    .eq('team_id', teamId).order('sort_order');
  const legends = (data ?? []) as Legend[];
  if (legends.length) legendsCache.set(teamId, legends);
  return legends;
}

export interface Coach { coach_key: string; name: string; photo: string | null; matches: number; }
export interface CoachPick { coach_key: string; name: string; photo: string | null; }

/** Club coaches, ranked by matches managed (desc). */
export async function getCoaches(teamId: string): Promise<Coach[]> {
  const { data } = await supabase.from('fan_pulse_coaches').select('coach_key, name, photo_url, matches')
    .eq('team_id', teamId).order('matches', { ascending: false });
  return (data ?? []).map((c: any) => ({ coach_key: c.coach_key, name: c.name, photo: c.photo_url, matches: c.matches ?? 0 }));
}

export async function getMyEntry(userId: string, scopeType: string, scopeRef: string): Promise<{ formation: string; picks: PulsePick[]; sell: SellItem[]; coach: CoachPick | null }> {
  const { data } = await supabase.from('fan_pulse_entries').select('formation, picks, sell_list, coach')
    .eq('user_id', userId).eq('scope_type', scopeType).eq('scope_ref', scopeRef).maybeSingle();
  return { formation: (data as any)?.formation ?? '4-3-3', picks: ((data as any)?.picks ?? []) as PulsePick[], sell: ((data as any)?.sell_list ?? []) as SellItem[], coach: ((data as any)?.coach ?? null) as CoachPick | null };
}

export async function saveEntry(userId: string, scopeType: string, scopeRef: string, formation: string, picks: PulsePick[], sellList?: SellItem[], coach?: CoachPick | null) {
  const row: any = { user_id: userId, scope_type: scopeType, scope_ref: scopeRef, formation, picks, updated_at: new Date().toISOString() };
  if (sellList !== undefined) row.sell_list = sellList;
  if (coach !== undefined) row.coach = coach;
  return supabase.from('fan_pulse_entries').upsert(row, { onConflict: 'user_id,scope_type,scope_ref' });
}

export interface MatchFixture { id: string; date: string; opponent: string; opponentLogo: string | null; home: boolean; }
/** The club's NEXT fixture, or null if none scheduled yet (off-season). */
export async function getMatchFixture(teamId: string): Promise<MatchFixture | null> {
  const { data } = await supabase.from('fb_fixtures')
    .select('id, date, status, home_team_id, away_team_id')
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .gt('date', new Date().toISOString()).order('date', { ascending: true }).limit(1).maybeSingle();
  if (!data) return null;
  const home = (data as any).home_team_id === teamId;
  const oppId = home ? (data as any).away_team_id : (data as any).home_team_id;
  const { data: opp } = await supabase.from('fb_teams').select('name, logo, logo_url').eq('id', oppId).maybeSingle();
  return { id: (data as any).id, date: (data as any).date, opponent: (opp as any)?.name ?? 'TBD', opponentLogo: (opp as any)?.logo || (opp as any)?.logo_url || null, home };
}

export async function getSellAggregate(scopeRef: string): Promise<{ participants: number; players: AggPlayer[] }> {
  const { data } = await supabase.rpc('fan_pulse_sell_aggregate', { p_scope_ref: scopeRef });
  return (data as any) ?? { participants: 0, players: [] };
}

export interface SquadPlayer { id: string; name: string; photo: string | null; position: Bucket; club: string | null; injured?: boolean; number?: number | null; }
export interface SellItem { player_key: string; name: string; photo: string | null; }
const FB_POS: Record<Bucket, string> = { GK: 'Goalkeeper', DEF: 'Defender', MID: 'Midfielder', FWD: 'Attacker' };
const toBucket = (p: string): Bucket => p === 'Goalkeeper' ? 'GK' : p === 'Defender' ? 'DEF' : p === 'Attacker' ? 'FWD' : 'MID';

/** Search any player (transfer targets) by name; optional position bucket filter (omit for bench).
 *  Uses an accent-insensitive RPC so "alva"/"julian" match "Álvarez"/"Julián". */
export async function searchPlayers(query: string, bucket?: Bucket): Promise<SquadPlayer[]> {
  const { data } = await supabase.rpc('fb_search_players', { p_q: query, p_pos: bucket ? FB_POS[bucket] : null });
  return (data ?? []).map((p: any) => ({
    id: p.id, name: p.name, photo: p.photo || p.photo_url || null, position: toBucket(p.position), club: p.club ?? null,
  }));
}

/** The club's current squad (used to deduce "buys" and to power the sell list). */
export async function getCurrentSquad(teamId: string): Promise<SquadPlayer[]> {
  const { data } = await supabase.from('fb_player_team_association')
    .select('shirt_number, fb_players(id, name, photo, photo_url, position, injured)').eq('team_id', teamId).limit(80);
  return (data ?? []).filter((r: any) => r.fb_players).map((r: any) => ({
    id: r.fb_players.id, name: r.fb_players.name, photo: r.fb_players.photo || r.fb_players.photo_url || null,
    position: toBucket(r.fb_players.position), club: null, injured: !!r.fb_players.injured, number: r.shirt_number ?? null,
  })).sort((a: SquadPlayer, b: SquadPlayer) => a.name.localeCompare(b.name));
}

export async function getAggregate(scopeType: string, scopeRef: string): Promise<Aggregate> {
  const { data } = await supabase.rpc('fan_pulse_aggregate', { p_scope_type: scopeType, p_scope_ref: scopeRef });
  return { participants: 0, players: [], slots: [], coach: null, ...((data as any) ?? {}) };
}
