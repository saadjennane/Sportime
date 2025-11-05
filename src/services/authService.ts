import { supabase } from './supabase'

/**
 * Send a magic link for sign up or sign in
 * - If user doesn't exist: creates new account and sends magic link
 * - If user exists: sends magic link to sign in
 */
export async function sendMagicLink(email: string): Promise<{ isNewUser: boolean; message: string }> {
  const normalizedEmail = email.trim().toLowerCase()
  const redirectTo = window.location.origin

  try {
    // Try to send magic link (works for both new users and existing users)
    const { data, error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: redirectTo,
        shouldCreateUser: true, // Allow creating new users
      },
    })

    if (error) {
      throw error
    }

    // Check if this is a new user or existing user
    // Supabase doesn't return this info directly, so we'll assume success means link was sent
    return {
      isNewUser: true, // We'll determine this later when they click the link
      message: 'Check your inbox! We sent you a magic link. It expires in 15 minutes.',
    }
  } catch (error: any) {
    console.error('[authService] Failed to send magic link:', error)
    throw new Error(error.message || 'Unable to send magic link. Please try again.')
  }
}

/**
 * Check if a user with the given email exists in public.users
 */
export async function checkUserExists(email: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle()

  if (error) {
    console.error('[authService] Error checking user existence:', error)
    return false
  }

  return !!data
}

/**
 * Check if the current authenticated user has completed onboarding
 */
export async function hasCompletedOnboarding(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('users')
    .select('username, role')
    .eq('id', userId)
    .single()

  if (error || !data) {
    return false
  }

  // User has completed onboarding if they have a username and are not a guest
  return !!data.username && data.role !== 'guest'
}
