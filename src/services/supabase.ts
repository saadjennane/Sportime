import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { USE_SUPABASE } from "../config/env";

let supabase: SupabaseClient | null = null;

if (USE_SUPABASE) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase URL and Anon Key must be defined in .env file. Please create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    );
  }

  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

export { supabase };
