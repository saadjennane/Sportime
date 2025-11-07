import { supabase } from './supabase'

type GuestAccountResponse = {
  userId: string
  email: string
  password: string
  username: string
}

export async function createGuestAccount(): Promise<GuestAccountResponse> {
  const { data, error } = await supabase.functions.invoke<GuestAccountResponse>('create-guest-user', {
    body: {},
  })

  if (error) {
    console.error('[userService] Failed to create guest account', error)
    throw error
  }

  if (!data) {
    throw new Error('Guest account creation returned no data')
  }

  return data
}

export async function completeGuestRegistration(params: {
  username?: string
  displayName?: string
  email?: string
}) {
  const { data, error } = await supabase.rpc('complete_guest_registration', {
    p_username: params.username ?? null,
    p_display_name: params.displayName ?? null,
    p_email: params.email ?? null,
  })

  if (error) {
    console.error('[userService] Failed to complete guest registration', error)
    throw error
  }

  return data
}

export async function setUserRole(userId: string, role: 'guest' | 'user' | 'admin' | 'super_admin') {
  const { data, error } = await supabase.rpc('set_user_role', {
    p_user_id: userId,
    p_role: role,
  })

  if (error) {
    console.error('[userService] Failed to set user role', error)
    throw error
  }

  return data
}

export async function refreshProfile() {
  // Get current authenticated user
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('No authenticated user')
  }

  // Fetch profile for the authenticated user only
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    console.error('[userService] Failed to fetch current profile', error)
    throw error
  }

  // If profile doesn't exist, create it
  if (!data) {
    console.log('[userService] Profile not found, creating new profile for user', user.id)

    const { data: newProfile, error: insertError } = await supabase
      .from('users')
      .insert({
        id: user.id,
        email: user.email || null,
        username: user.email?.split('@')[0] || `user_${user.id.slice(0, 8)}`,
        display_name: user.email?.split('@')[0] || `User ${user.id.slice(0, 8)}`,
        coins_balance: 1000,
        xp: 0,
        xp_total: 0,
        current_level: 1, // Integer: level ID (1 = Amateur/Bronze)
        level_name: 'Amateur',
        user_type: 'user',
        is_premium: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (insertError) {
      console.error('[userService] Failed to create profile', insertError)
      throw insertError
    }

    return newProfile
  }

  return data
}
