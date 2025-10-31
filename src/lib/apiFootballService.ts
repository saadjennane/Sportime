import { supabase } from '@/services/supabase'

type Params = Record<string, string | number | boolean | undefined>

export async function apiFootball(path: string, params?: Params) {
  const { data, error } = await supabase.functions.invoke('api-football-proxy', {
    body: { path, params }
  })
  if (error) {
    // Optionnel: meilleure trace côté UI
    console.error('apiFootball error:', error)
    throw new Error(error.message)
  }
  return data
}
