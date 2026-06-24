import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'
import { USE_SUPABASE } from '../config/env'
import { capacitorAuthStorage } from './authStorage'

let supabase: SupabaseClient | null = null

if (USE_SUPABASE) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase URL and Anon Key must be defined in .env file. Supabase features will be disabled.')
  } else {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Native: keep the session in Capacitor Preferences (UserDefaults) so it survives
        // WebView storage eviction. Web keeps the default (localStorage).
        ...(Capacitor.isNativePlatform() ? { storage: capacitorAuthStorage } : {}),
      },
    })
  }
}

export { supabase }
