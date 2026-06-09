import { supabase } from './supabase';

export interface SpinSegment {
  id: string;
  tier: string;
  segment_key: string;
  label: string;
  base_chance: number;
  category: string;
  value: number | null;
  reward_tier: string | null;
  sort_order: number;
  is_active: boolean;
}

const CACHE_KEY = 'spin_segments_cache_v1';
const VERSION_KEY = 'spin_segments_version_v1';
let memCache: Record<string, SpinSegment[]> | null = null;
let memVersion: number | null = null;

function loadPersisted() {
  if (memCache) return;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    memCache = raw ? JSON.parse(raw) : null;
    memVersion = Number(localStorage.getItem(VERSION_KEY)) || null;
  } catch { memCache = null; }
}

async function fetchVersion(): Promise<number | null> {
  const { data } = await supabase.from('content_versions').select('version').eq('key', 'spin_segments').maybeSingle();
  return data ? Number(data.version) : null;
}

async function refetchAll(): Promise<Record<string, SpinSegment[]>> {
  const { data } = await supabase.from('spin_segments').select('*').eq('is_active', true).order('tier').order('sort_order');
  const grouped: Record<string, SpinSegment[]> = {};
  for (const s of (data ?? []) as SpinSegment[]) (grouped[s.tier] ??= []).push(s);
  return grouped;
}

/**
 * Returns the active segments for a wheel tier. Serves the persisted cache
 * instantly and only re-downloads from the DB when the server-side version
 * counter changed (so admin edits propagate, without reloading every open).
 */
export async function getSpinSegments(tier: string): Promise<SpinSegment[]> {
  loadPersisted();
  try {
    const serverVersion = await fetchVersion();
    if (!memCache || serverVersion == null || serverVersion !== memVersion) {
      memCache = await refetchAll();
      memVersion = serverVersion;
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(memCache));
        if (serverVersion != null) localStorage.setItem(VERSION_KEY, String(serverVersion));
      } catch { /* ignore quota */ }
    }
  } catch {
    // offline / error → fall back to whatever cache we have
  }
  return (memCache?.[tier] ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
}

/** Prefetch all wheels (call on FunZone mount so the modal opens instantly). */
export async function prefetchSpinSegments(): Promise<void> {
  try { await getSpinSegments('free'); } catch { /* ignore */ }
}

/** Server-side spin: validates eligibility, draws from the DB, grants, returns the winning segment. */
export async function spinWheel(tier: string): Promise<{ ok: boolean; index?: number; label?: string; category?: string; error?: string; next_at?: string }> {
  const { data, error } = await supabase.rpc('spin_wheel', { p_tier: tier });
  if (error) return { ok: false, error: error.message };
  return data as any;
}
