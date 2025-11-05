import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../services/supabase'
import { createGuestAccount, refreshProfile } from '../services/userService'
import type { Profile } from '../types'

interface AuthContextValue {
  user: User | null
  session: Session | null
  profile: Profile | null
  isLoading: boolean
  signOut: () => Promise<void>
  ensureGuest: () => Promise<{ userId: string }>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadProfile = useCallback(async () => {
    if (!user) {
      setProfile(null)
      return
    }

    try {
      const data = await refreshProfile()
      setProfile(data as Profile)
    } catch (error) {
      console.error('[AuthContext] Failed to load profile', error)
    }
  }, [user])

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession()
      setSession(data.session)
      setUser(data.session?.user ?? null)
      setIsLoading(false)
    }

    init()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setUser(newSession?.user ?? null)
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!user) {
      setProfile(null)
      return
    }

    loadProfile()
  }, [user, loadProfile])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setSession(null)
    setUser(null)
    setProfile(null)
  }, [])

  const ensureGuest = useCallback(async () => {
    if (user) return { userId: user.id }

    const guest = await createGuestAccount()

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: guest.email,
      password: guest.password,
    })

    if (signInError || !signInData.session?.user) {
      console.error('[AuthContext] Failed to sign in guest account', signInError)
      throw signInError ?? new Error('Unable to sign in guest account')
    }

    setSession(signInData.session)
    setUser(signInData.session.user)
    await loadProfile()
    return { userId: signInData.session.user.id }
  }, [user, loadProfile])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    session,
    profile,
    isLoading,
    signOut,
    ensureGuest,
    refreshProfile: loadProfile,
  }), [user, session, profile, isLoading, signOut, ensureGuest, loadProfile])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
