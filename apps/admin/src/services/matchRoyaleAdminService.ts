import { supabase } from './supabase';

// ── Gameplay config ──────────────────────────────────────────────────────────
export async function getMRConfig() {
  const { data } = await supabase.from('mr_config').select('*').eq('id', 1).single();
  return data;
}
export async function updateMRConfig(patch: any) {
  return supabase.from('mr_config').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', 1);
}

// ── Event catalog ────────────────────────────────────────────────────────────
export async function listMRCatalog() {
  const { data } = await supabase.from('mr_event_catalog').select('*').order('sort_order');
  return data ?? [];
}
export async function updateMRCatalog(id: string, patch: any) {
  return supabase.from('mr_event_catalog').update(patch).eq('id', id);
}

// ── Pot profiles ─────────────────────────────────────────────────────────────
export async function listPotProfiles() {
  const { data } = await supabase.from('mr_pot_profiles').select('*').order('created_at');
  return data ?? [];
}
export async function upsertPotProfile(p: any) {
  if (p.id) return supabase.from('mr_pot_profiles').update(p).eq('id', p.id);
  return supabase.from('mr_pot_profiles').insert(p);
}
export async function deletePotProfile(id: string) {
  return supabase.from('mr_pot_profiles').delete().eq('id', id);
}

// ── Assignment rules ─────────────────────────────────────────────────────────
export async function listAssignments() {
  const { data } = await supabase.from('mr_pot_assignments')
    .select('*, profile:mr_pot_profiles(name)').order('scope');
  return data ?? [];
}
export async function createAssignment(a: any) { return supabase.from('mr_pot_assignments').insert(a); }
export async function deleteAssignment(id: string) { return supabase.from('mr_pot_assignments').delete().eq('id', id); }

// ── Activation ───────────────────────────────────────────────────────────────
export async function listActivations() {
  const { data } = await supabase.from('mr_activation').select('*');
  return data ?? [];
}
export async function setActivation(scope: 'league' | 'fixture', targetId: string, enabled: boolean) {
  return supabase.from('mr_activation').upsert({ scope, target_id: targetId, enabled }, { onConflict: 'scope,target_id' });
}

// ── Lookups + games ──────────────────────────────────────────────────────────
export async function listLeaguesMR() {
  const { data } = await supabase.from('fb_leagues').select('id, name').order('name');
  return data ?? [];
}
export async function listGamesMR() {
  const { data } = await supabase.from('mr_games')
    .select('id, name, status, pot_amount, created_at').order('created_at', { ascending: false }).limit(50);
  return data ?? [];
}
