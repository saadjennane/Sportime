// Fan Pulse F1 — Favourite Pilot & Favourite Team (constructor), stored on the user
// profile with a public "fan count" (how many fans share that favourite), mirroring
// Football's favourite club. Pickers pull from the latest F1 season's grid.
import { supabase } from './supabase';

export interface F1Driver { id: string; name: string; image: string | null; team: string | null; }
export interface F1Constructor { id: string; name: string; logo: string | null; }

let driversCache: F1Driver[] | null = null;
let constructorsCache: F1Constructor[] | null = null;

async function latestSeason(table: 'f1_drivers' | 'f1_constructors'): Promise<number | null> {
  const { data } = await supabase.from(table).select('season').order('season', { ascending: false }).limit(1).maybeSingle();
  return (data as any)?.season ?? null;
}

export async function getCurrentDrivers(): Promise<F1Driver[]> {
  if (driversCache) return driversCache;
  const season = await latestSeason('f1_drivers');
  const { data } = await supabase.from('f1_drivers').select('id, name, image, team_name, position')
    .eq('season', season as number).order('position', { ascending: true, nullsFirst: false });
  driversCache = (data ?? []).map((d: any) => ({ id: String(d.id), name: d.name, image: d.image, team: d.team_name ?? null }));
  return driversCache;
}

export async function getCurrentConstructors(): Promise<F1Constructor[]> {
  if (constructorsCache) return constructorsCache;
  const season = await latestSeason('f1_constructors');
  const { data } = await supabase.from('f1_constructors').select('id, name, logo, position')
    .eq('season', season as number).order('position', { ascending: true, nullsFirst: false });
  constructorsCache = (data ?? []).map((c: any) => ({ id: String(c.id), name: c.name, logo: c.logo }));
  return constructorsCache;
}

export interface F1Favourites { driverId: string | null; constructorId: string | null; }
export async function getFavourites(userId: string): Promise<F1Favourites> {
  const { data } = await supabase.from('users').select('favorite_f1_driver, favorite_f1_constructor').eq('id', userId).maybeSingle();
  return { driverId: (data as any)?.favorite_f1_driver ?? null, constructorId: (data as any)?.favorite_f1_constructor ?? null };
}

export async function setFavouriteDriver(userId: string, driverId: string) {
  return supabase.from('users').update({ favorite_f1_driver: driverId }).eq('id', userId);
}
export async function setFavouriteConstructor(userId: string, constructorId: string) {
  return supabase.from('users').update({ favorite_f1_constructor: constructorId }).eq('id', userId);
}

/** How many fans share this favourite pilot / team (its fan base on Sportime). */
export async function getDriverFanCount(driverId: string): Promise<number> {
  const { count } = await supabase.from('users').select('id', { count: 'exact', head: true }).eq('favorite_f1_driver', driverId);
  return count ?? 0;
}
export async function getConstructorFanCount(constructorId: string): Promise<number> {
  const { count } = await supabase.from('users').select('id', { count: 'exact', head: true }).eq('favorite_f1_constructor', constructorId);
  return count ?? 0;
}
