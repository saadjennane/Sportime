import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { USE_SUPABASE } from '../config/env';

let supabaseInstance: SupabaseClient | null = null;

if (USE_SUPABASE) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Supabase URL and Anon Key are not defined. Please check your .env file.");
  } else {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { 
        persistSession: true,
        autoRefreshToken: true 
      }
    });
  }
} else {
  console.log("Supabase is disabled. Using mock data.");
}

export const supabase = supabaseInstance;
