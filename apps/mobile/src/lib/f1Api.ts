import { supabase } from '../services/supabase';

/** Call the api-sports Formula-1 API through the server-side proxy. Returns `response`. */
export async function f1Api(path: string, params: Record<string, any> = {}): Promise<any[]> {
  const { data, error } = await supabase.functions.invoke('api-f1-proxy', { body: { path, params } });
  if (error) throw error;
  return (data as any)?.response ?? [];
}
