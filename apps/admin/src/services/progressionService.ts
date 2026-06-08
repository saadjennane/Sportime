import { supabase } from './supabase'

export async function addXpToUser(userId: string, amount: number) {
  if (!supabase) {
    throw new Error('Supabase client not initialized')
  }

  const { data, error } = await supabase.rpc('add_xp_to_user', {
    p_user_id: userId,
    p_xp_amount: amount,
  })

  if (error) {
    console.error('[progressionService] Failed to add XP', error)
    throw error
  }

  return data
}

// ── Levels ───────────────────────────────────────────────────────────────────
export async function listLevels() {
  const { data } = await supabase.from('levels_config').select('*').order('level');
  return data ?? [];
}
export async function updateLevel(level: number, patch: { name?: string; xp_required?: number }) {
  return supabase.from('levels_config').update(patch).eq('level', level);
}

// ── Badges ───────────────────────────────────────────────────────────────────
export async function listBadges() {
  const { data } = await supabase.from('badges').select('*').order('created_at');
  return data ?? [];
}
export async function upsertBadge(badge: any) {
  if (badge.id) return supabase.from('badges').update(badge).eq('id', badge.id);
  return supabase.from('badges').insert(badge);
}
export async function deleteBadge(id: string) {
  return supabase.from('badges').delete().eq('id', id);
}

// ── XP formula coefficients ──────────────────────────────────────────────────
export async function listXpCoefs() {
  const { data } = await supabase.from('xp_formula_config').select('*').order('key');
  return data ?? [];
}
export async function updateXpCoef(key: string, value: number) {
  return supabase.from('xp_formula_config').update({ value }).eq('key', key);
}
