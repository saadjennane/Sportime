import { supabase } from '../services/supabase'

type Params = Record<string, string | number>

export async function apiFootball<T = any>(path: string, params?: Params): Promise<T> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const filteredParams = params
    ? Object.fromEntries(
        Object.entries(params).filter(([, value]) => value !== undefined && value !== null)
      )
    : undefined

  if (import.meta.env.DEV) {
    console.debug('[apiFootball] request', normalizedPath, filteredParams)
  }

  const { data, error } = await supabase.functions.invoke('api-football-proxy', {
    body: { path: normalizedPath, params: filteredParams },
  })

  if (error) {
    console.error('apiFootball error:', error)
    throw new Error(error.message)
  }

  if (import.meta.env.DEV) {
    console.debug('[apiFootball] response', data)
  }

  return data as T
}
