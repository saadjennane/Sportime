// Fan Pulse — fans build XIs for their club and see the aggregated "pulse" (% of
// fans picking each player). Backend: fan_pulse_legends / fan_pulse_entries /
// fan_pulse_aggregate. Squads reuse fb_players.
import { supabase } from './supabase';

export interface Club { id: string; name: string; logo: string | null; }
export type Bucket = 'GK' | 'DEF' | 'MID' | 'FWD';
export interface Legend { id: string; player_key: string; name: string; position: Bucket; photo_url: string | null; }
export interface PulsePick { player_key: string; name: string; photo: string | null; position: Bucket; is_starter: boolean; slot: number; }
export interface AggPlayer { player_key: string; name: string; photo: string | null; position: Bucket; count: number; pct: number; }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const toClub = (t: any): Club => ({ id: t.id, name: t.name, logo: t.logo || t.logo_url || null });

/** Resolve profiles.favorite_club (stores a team id, or legacy name) to a club. */
export async function getFavoriteClub(userId: string): Promise<Club | null> {
  const { data: prof } = await supabase.from('profiles').select('favorite_club').eq('id', userId).maybeSingle();
  const fav = (prof as any)?.favorite_club;
  if (!fav) return null;
  const q = supabase.from('fb_teams').select('id, name, logo_url, logo');
  const { data } = await (UUID.test(fav) ? q.eq('id', fav) : q.eq('name', fav)).limit(1).maybeSingle();
  return data ? toClub(data) : null;
}

export async function setFavoriteClub(userId: string, teamId: string) {
  return supabase.from('profiles').update({ favorite_club: teamId }).eq('id', userId);
}

export async function searchClubs(query: string): Promise<Club[]> {
  const { data } = await supabase.from('fb_teams').select('id, name, logo_url, logo')
    .ilike('name', `%${query}%`).order('name').limit(25);
  return (data ?? []).map(toClub);
}

export async function getLegends(teamId: string): Promise<Legend[]> {
  const { data } = await supabase.from('fan_pulse_legends').select('id, player_key, name, position, photo_url')
    .eq('team_id', teamId).order('sort_order');
  return (data ?? []) as Legend[];
}

export async function getMyEntry(userId: string, scopeType: string, scopeRef: string): Promise<{ formation: string; picks: PulsePick[]; sell: SellItem[] }> {
  const { data } = await supabase.from('fan_pulse_entries').select('formation, picks, sell_list')
    .eq('user_id', userId).eq('scope_type', scopeType).eq('scope_ref', scopeRef).maybeSingle();
  return { formation: (data as any)?.formation ?? '4-3-3', picks: ((data as any)?.picks ?? []) as PulsePick[], sell: ((data as any)?.sell_list ?? []) as SellItem[] };
}

export async function saveEntry(userId: string, scopeType: string, scopeRef: string, formation: string, picks: PulsePick[], sellList?: SellItem[]) {
  const row: any = { user_id: userId, scope_type: scopeType, scope_ref: scopeRef, formation, picks, updated_at: new Date().toISOString() };
  if (sellList !== undefined) row.sell_list = sellList;
  return supabase.from('fan_pulse_entries').upsert(row, { onConflict: 'user_id,scope_type,scope_ref' });
}

export async function getSellAggregate(scopeRef: string): Promise<{ participants: number; players: AggPlayer[] }> {
  const { data } = await supabase.rpc('fan_pulse_sell_aggregate', { p_scope_ref: scopeRef });
  return (data as any) ?? { participants: 0, players: [] };
}

export interface SquadPlayer { id: string; name: string; photo: string | null; position: Bucket; club: string | null; }
export interface SellItem { player_key: string; name: string; photo: string | null; }
const FB_POS: Record<Bucket, string> = { GK: 'Goalkeeper', DEF: 'Defender', MID: 'Midfielder', FWD: 'Attacker' };
const toBucket = (p: string): Bucket => p === 'Goalkeeper' ? 'GK' : p === 'Defender' ? 'DEF' : p === 'Attacker' ? 'FWD' : 'MID';

/** Search any player (transfer targets) by name; optional position bucket filter (omit for bench). */
export async function searchPlayers(query: string, bucket?: Bucket): Promise<SquadPlayer[]> {
  let q = supabase.from('fb_players')
    .select('id, name, photo, photo_url, position, fb_player_team_association(fb_teams(name))')
    .ilike('name', `%${query}%`).limit(40);
  if (bucket) q = q.eq('position', FB_POS[bucket]);
  const { data } = await q;
  return (data ?? []).map((p: any) => ({
    id: p.id, name: p.name, photo: p.photo || p.photo_url || null, position: toBucket(p.position),
    club: p.fb_player_team_association?.[0]?.fb_teams?.name ?? null,
  }));
}

/** The club's current squad (used to deduce "buys" and to power the sell list). */
export async function getCurrentSquad(teamId: string): Promise<SquadPlayer[]> {
  const { data } = await supabase.from('fb_player_team_association')
    .select('fb_players(id, name, photo, photo_url, position)').eq('team_id', teamId).limit(80);
  return (data ?? []).map((r: any) => r.fb_players).filter(Boolean).map((p: any) => ({
    id: p.id, name: p.name, photo: p.photo || p.photo_url || null, position: toBucket(p.position), club: null,
  }));
}

export async function getAggregate(scopeType: string, scopeRef: string): Promise<{ participants: number; players: AggPlayer[] }> {
  const { data } = await supabase.rpc('fan_pulse_aggregate', { p_scope_type: scopeType, p_scope_ref: scopeRef });
  return (data as any) ?? { participants: 0, players: [] };
}
