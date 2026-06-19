// Fan Pulse — fans build XIs for their club and see the aggregated "pulse" (% of
// fans picking each player). Backend: fan_pulse_legends / fan_pulse_entries /
// fan_pulse_aggregate. Squads reuse fb_players.
import { supabase } from './supabase';

export interface Club { id: string; name: string; logo: string | null; }
export type Bucket = 'GK' | 'DEF' | 'MID' | 'FWD';
export interface Legend { id: string; name: string; position: Bucket; photo_url: string | null; }
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
  const { data } = await supabase.from('fan_pulse_legends').select('id, name, position, photo_url')
    .eq('team_id', teamId).order('sort_order');
  return (data ?? []) as Legend[];
}

export async function getMyEntry(userId: string, scopeType: string, scopeRef: string): Promise<PulsePick[]> {
  const { data } = await supabase.from('fan_pulse_entries').select('picks')
    .eq('user_id', userId).eq('scope_type', scopeType).eq('scope_ref', scopeRef).maybeSingle();
  return ((data as any)?.picks ?? []) as PulsePick[];
}

export async function saveEntry(userId: string, scopeType: string, scopeRef: string, formation: string, picks: PulsePick[]) {
  return supabase.from('fan_pulse_entries').upsert(
    { user_id: userId, scope_type: scopeType, scope_ref: scopeRef, formation, picks, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,scope_type,scope_ref' });
}

export async function getAggregate(scopeType: string, scopeRef: string): Promise<{ participants: number; players: AggPlayer[] }> {
  const { data } = await supabase.rpc('fan_pulse_aggregate', { p_scope_type: scopeType, p_scope_ref: scopeRef });
  return (data as any) ?? { participants: 0, players: [] };
}
