/**
 * useUserTimezone Hook
 *
 * Retrieves and caches the user's timezone preference
 * Auto-detects from browser if not set in database
 */

import { useEffect, useState } from 'react'
import { supabase } from '../services/supabase'
import { getUserTimezone } from '../utils/timezoneUtils'
import type { User } from '@supabase/supabase-js'

let cachedTimezone: string | null = null
let cachedUser: User | null = null

/**
 * Hook to get user's timezone
 * Returns auto-detected timezone immediately, then updates if user has preference in DB
 *
 * @returns Timezone string (IANA format)
 */
export function useUserTimezone(): string {
  const [timezone, setTimezone] = useState<string>(() => {
    // Return cached value if available
    if (cachedTimezone) {
      return cachedTimezone
    }
    // Otherwise auto-detect from browser
    return getUserTimezone()
  })

  useEffect(() => {
    let mounted = true

    async function loadUserTimezone() {
      try {
        // Get current user
        const { data: { user }, error } = await supabase.auth.getUser()

        if (error) {
          console.warn('[useUserTimezone] Failed to get user:', error)
          return
        }

        if (!user) {
          // No user logged in, use browser detection
          const detected = getUserTimezone()
          if (mounted) {
            setTimezone(detected)
            cachedTimezone = detected
          }
          return
        }

        // Check if this is a different user than cached
        if (cachedUser?.id !== user.id) {
          cachedUser = user
          cachedTimezone = null
        }

        // Try to get timezone from user profile
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('timezone')
          .eq('id', user.id)
          .single()

        if (profileError) {
          console.warn('[useUserTimezone] Failed to fetch user profile:', profileError)
          // Fallback to user metadata or browser detection
          const userTz = getUserTimezone(user)
          if (mounted) {
            setTimezone(userTz)
            cachedTimezone = userTz
          }
          return
        }

        // Use profile timezone if set, otherwise detect
        const userTz = profile?.timezone || getUserTimezone(user)

        if (mounted) {
          setTimezone(userTz)
          cachedTimezone = userTz
        }
      } catch (error) {
        console.error('[useUserTimezone] Error loading timezone:', error)
        // Fallback to browser detection
        const detected = getUserTimezone()
        if (mounted) {
          setTimezone(detected)
          cachedTimezone = detected
        }
      }
    }

    loadUserTimezone()

    return () => {
      mounted = false
    }
  }, [])

  return timezone
}

/**
 * Hook to update user's timezone preference in database
 *
 * @returns Function to update timezone
 */
export function useUpdateUserTimezone(): (newTimezone: string) => Promise<void> {
  return async (newTimezone: string) => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error('User not authenticated')
      }

      // Update timezone in database
      const { error: updateError } = await supabase
        .from('users')
        .update({ timezone: newTimezone })
        .eq('id', user.id)

      if (updateError) {
        throw updateError
      }

      // Update cache
      cachedTimezone = newTimezone

      console.log('[useUpdateUserTimezone] Timezone updated to:', newTimezone)
    } catch (error) {
      console.error('[useUpdateUserTimezone] Failed to update timezone:', error)
      throw error
    }
  }
}

/**
 * Clear timezone cache (useful for testing or manual cache invalidation)
 */
export function clearTimezoneCache(): void {
  cachedTimezone = null
  cachedUser = null
}
