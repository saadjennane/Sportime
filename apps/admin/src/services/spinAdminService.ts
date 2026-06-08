import { supabase } from './supabase';

export async function listSpinSegments() {
  const { data } = await supabase.from('spin_segments').select('*').order('tier').order('sort_order');
  return data ?? [];
}
export async function updateSpinSegment(id: string, patch: any) {
  return supabase.from('spin_segments').update(patch).eq('id', id);
}
export async function createSpinSegment(seg: any) {
  return supabase.from('spin_segments').insert(seg).select().single();
}
export async function deleteSpinSegment(id: string) {
  return supabase.from('spin_segments').delete().eq('id', id);
}
