// TODO: Will be refactored to use Supabase Edge Function proxy
import { ApiFootballResponse } from '../types';

export async function fetchFromFootball<T>(endpoint: string, params: Record<string, string>): Promise<ApiFootballResponse<T>> {
  throw new Error('Direct API fetch is disabled. Use Supabase Edge Function proxy.');
}
