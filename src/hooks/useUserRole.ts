/**
 * useUserRole Hook
 *
 * Retrieves and caches the current user's role for permission checks
 * Roles: 'user' (default), 'admin' (read-only admin panel), 'super_admin' (full access)
 */

import { useEffect, useState } from 'react'
import { supabase } from '../services/supabase'

export type UserRole = 'user' | 'admin' | 'super_admin'

let cachedRole: UserRole | null = null
let cachedUserId: string | null = null

/**
 * Hook to get current user's role
 *
 * @returns User role ('user', 'admin', or 'super_admin')
 */
export function useUserRole(): UserRole {
  const [role, setRole] = useState<UserRole>(() => cachedRole || 'user')

  useEffect(() => {
    let mounted = true

    async function loadUserRole() {
      try {
        // Get current user
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
          console.warn('[useUserRole] No authenticated user')
          if (mounted) {
            setRole('user')
            cachedRole = 'user'
          }
          return
        }

        // Check if we already have cached role for this user
        if (cachedUserId === user.id && cachedRole) {
          if (mounted) {
            setRole(cachedRole)
          }
          return
        }

        // Fetch role from database
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single()

        if (profileError) {
          console.warn('[useUserRole] Failed to fetch user profile:', profileError)
          // Default to 'user' role on error
          if (mounted) {
            setRole('user')
            cachedRole = 'user'
            cachedUserId = user.id
          }
          return
        }

        const userRole = (profile?.role || 'user') as UserRole

        if (mounted) {
          setRole(userRole)
          cachedRole = userRole
          cachedUserId = user.id
        }
      } catch (error) {
        console.error('[useUserRole] Error loading user role:', error)
        if (mounted) {
          setRole('user')
          cachedRole = 'user'
        }
      }
    }

    loadUserRole()

    return () => {
      mounted = false
    }
  }, [])

  return role
}

/**
 * Check if user is admin (includes super_admin)
 *
 * @returns True if user is admin or super_admin
 */
export function useIsAdmin(): boolean {
  const role = useUserRole()
  return role === 'admin' || role === 'super_admin'
}

/**
 * Check if user is super_admin (full config access)
 *
 * @returns True if user is super_admin
 */
export function useIsSuperAdmin(): boolean {
  const role = useUserRole()
  return role === 'super_admin'
}

/**
 * Clear role cache (useful when role changes or for testing)
 */
export function clearRoleCache(): void {
  cachedRole = null
  cachedUserId = null
  console.log('[useUserRole] Role cache cleared')
}

/**
 * Update user's role (super_admin only)
 *
 * @param userId - User ID to update
 * @param newRole - New role to assign
 */
export async function updateUserRole(
  userId: string,
  newRole: UserRole
): Promise<void> {
  try {
    const { error } = await supabase
      .from('users')
      .update({ role: newRole })
      .eq('id', userId)

    if (error) {
      throw error
    }

    // Clear cache if updating current user
    const { data: { user } } = await supabase.auth.getUser()
    if (user && user.id === userId) {
      clearRoleCache()
    }

    console.log(`[useUserRole] User ${userId} role updated to: ${newRole}`)
  } catch (error) {
    console.error('[useUserRole] Failed to update user role:', error)
    throw error
  }
}

/**
 * Get all users with their roles (admin panel use)
 *
 * @returns Array of users with roles
 */
export async function getAllUsersWithRoles(): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, username, role, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return data || []
  } catch (error) {
    console.error('[useUserRole] Failed to fetch users:', error)
    throw error
  }
}
