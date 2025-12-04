import type { Profile } from '../types'
import { supabase } from './supabase'

type UpdateProfileInput = {
  username?: string | null
  displayName?: string | null
  favoriteClub?: string | null
  favoriteNationalTeam?: string | null
  profilePictureUrl?: string | null
}

export async function updateUserProfile(userId: string, updates: UpdateProfileInput): Promise<Profile> {
  if (!userId) {
    throw new Error('[profileService] Cannot update profile without a user id')
  }

  const payload: Record<string, string | null> = {}

  if (updates.username !== undefined) {
    payload.username = updates.username
  }
  if (updates.displayName !== undefined) {
    payload.display_name = updates.displayName
  }
  if (updates.favoriteClub !== undefined) {
    payload.favorite_club = updates.favoriteClub
  }
  if (updates.favoriteNationalTeam !== undefined) {
    payload.favorite_national_team = updates.favoriteNationalTeam
  }
  if (updates.profilePictureUrl !== undefined) {
    payload.profile_picture_url = updates.profilePictureUrl
  }

  const { data, error } = await supabase
    .from('users')
    .update(payload)
    .eq('id', userId)
    .select('*')
    .single()

  if (error) {
    console.error('[profileService] Failed to update profile', error)
    throw error
  }

  return data as Profile
}

export async function isUsernameTaken(username: string, currentUserId?: string): Promise<boolean> {
  const normalized = username.trim().toLowerCase()
  if (!normalized) return false

  let query = supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .filter('username', 'ilike', normalized)

  if (currentUserId) {
    query = query.neq('id', currentUserId)
  }

  const { count, error } = await query

  if (error) {
    console.error('[profileService] Failed to check username availability', error)
    throw error
  }

  return (count ?? 0) > 0
}
