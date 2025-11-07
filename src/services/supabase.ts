import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { USE_SUPABASE } from '../config/env'

let supabase: SupabaseClient | null = null

if (USE_SUPABASE) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase URL and Anon Key must be defined in .env file. Supabase features will be disabled.')
  } else {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true }
    })
  }
}

export { supabase }
