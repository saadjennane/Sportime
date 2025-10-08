import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL and Anon Key must be defined in .env file");
}

// Note: We are not using generated types from the database schema as per the instructions.
// In a real-world project, you would generate these types for full type safety.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
