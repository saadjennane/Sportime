import { supabase } from './supabaseClient';

type Params = Record<string, string | number | boolean | undefined>

export async function apiFootball<T>(path: string, params?: Params): Promise<T> {
  if (!supabase) {
    throw new Error("Supabase client is not initialized. Cannot call Edge Function.");
  }
  
  const { data, error } = await supabase.functions.invoke('api-football-proxy', {
    body: { path, params }
  });

  if (error) {
    console.error('apiFootball error:', error);
    throw new Error(error.message);
  }
  
  return data;
}
