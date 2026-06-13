import { supabase } from './supabase';

export async function getLFConfig() {
  const { data } = await supabase.from('lf_config').select('*').eq('id', 1).single();
  return data;
}
export async function updateLFConfig(patch: any) {
  return supabase.from('lf_config').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', 1);
}
export async function listLFActivations() {
  const { data } = await supabase.from('lf_activation').select('*').order('created_at', { ascending: false });
  return data ?? [];
}
export async function setLFActivation(scope: 'global' | 'league' | 'team' | 'match', targetId: string | null, enabled: boolean) {
  const col = scope === 'league' ? 'league_id' : scope === 'team' ? 'team_id' : scope === 'match' ? 'fixture_id' : null;
  const row: any = { scope, enabled };
  if (col && targetId) row[col] = targetId;
  return supabase.from('lf_activation').insert(row);
}
export async function deleteLFActivation(id: string) {
  return supabase.from('lf_activation').delete().eq('id', id);
}
// Pots are shared with Match Royale; assignments are tagged with game='live_fantasy'.
export async function listLFAssignments() {
  const { data } = await supabase.from('mr_pot_assignments').select('*').eq('game', 'live_fantasy').order('created_at', { ascending: false });
  return data ?? [];
}
export async function createLFAssignment(a: any) {
  return supabase.from('mr_pot_assignments').insert({ ...a, game: 'live_fantasy' });
}
export async function deleteLFAssignment(id: string) {
  return supabase.from('mr_pot_assignments').delete().eq('id', id);
}
