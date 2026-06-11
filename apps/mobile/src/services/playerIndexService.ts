import { supabase } from './supabase';

export interface IndexedPlayer { id: number; name: string; photo?: string; r: number; key: string }
const CACHE_KEY = 'sportime_player_index_v4';
const TTL = 24 * 3600 * 1000;
let MEM: IndexedPlayer[] | null = null;

// ̀-ͯ = combining diacritics (explicit escapes; literal chars mis-strip in some webviews)
const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

export async function getPlayerIndex(): Promise<IndexedPlayer[]> {
  if (MEM && MEM.length) return MEM;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) { const c = JSON.parse(raw); if (Date.now() - c.ts < TTL && Array.isArray(c.data) && c.data.length) { MEM = c.data; return MEM!; } }
  } catch { /* ignore */ }
  const { data } = await supabase.rpc('puzzle_player_index');
  const list: IndexedPlayer[] = (data ?? []).map((p: any) => ({ id: p.id, name: p.n, photo: p.p, r: p.r ?? 30, key: norm(p.n) }));
  if (list.length) {   // never cache an empty/failed fetch
    MEM = list;
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: list })); } catch { /* quota */ }
  }
  return list;
}
export function prefetchPlayerIndex() { getPlayerIndex().catch(() => {}); }

// small Levenshtein (early-exit) for typo tolerance
function lev(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let best = i;
    for (let j = 1; j <= b.length; j++) {
      const v = a[i - 1] === b[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j - 1], prev[j], cur[j - 1]);
      cur[j] = v; if (v < best) best = v;
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

export function searchPlayers(list: IndexedPlayer[], query: string, limit = 8): IndexedPlayer[] {
  const q = norm(query);
  if (q.length < 2) return [];
  const maxDist = q.length <= 4 ? 1 : 2;
  const scored: { p: IndexedPlayer; s: number }[] = [];
  for (const p of list) {
    const k = p.key;
    let s = -1;
    if (k.startsWith(q)) s = 0;
    else if (k.split(' ').some(tok => tok.startsWith(q))) s = 1;        // word-start (last name etc.)
    else if (k.includes(q)) s = 2;                                       // substring
    else { // fuzzy on whole key or any token
      let d = lev(q, k, maxDist);
      if (d > maxDist) for (const tok of k.split(' ')) { d = Math.min(d, lev(q, tok, maxDist)); if (d <= maxDist) break; }
      if (d <= maxDist) s = 3 + d;
    }
    if (s >= 0) scored.push({ p, s });
  }
  scored.sort((a, b) => a.s - b.s || b.p.r - a.p.r);
  return scored.slice(0, limit).map(x => x.p);
}
