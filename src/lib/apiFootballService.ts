import { ApiFootballResponse } from '../types';

const API_BASE_URL = 'https://v3.football.api-sports.io';
const API_KEY = import.meta.env.VITE_API_FOOTBALL_KEY;

export async function fetchFromFootball<T>(endpoint: string, params: Record<string, string>): Promise<ApiFootballResponse<T>> {
  if (!API_KEY) {
    console.error("API Football Key is not configured in .env file.");
    throw new Error("API Football Key is missing.");
  }

  const url = new URL(`${API_BASE_URL}/${endpoint}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value));

  const res = await fetch(url.toString(), {
    headers: { 'x-apisports-key': API_KEY },
  });

  if (!res.ok) {
    const errorData = await res.json();
    console.error("API Football Error Response:", errorData);
    throw new Error(`API Football error: ${res.status} - ${JSON.stringify(errorData.errors)}`);
  }

  return res.json();
}
