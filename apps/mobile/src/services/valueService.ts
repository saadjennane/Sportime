import { supabase } from './supabase';

export interface ValuePlayer { id: number; n: string; p?: string; mv: number | null; maxv: number | null; fee: number | null; h: number | null; by: number | null; tro: number; clubs: number }

const eur = (v: number) => v >= 1e9 ? `€${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `€${Math.round(v / 1e6)}M` : v >= 1e3 ? `€${Math.round(v / 1e3)}K` : `€${v}`;
const NOW_YEAR = 2026;

export interface HlCriterion { key: string; label: string; emoji: string; get: (p: ValuePlayer) => number; fmt: (v: number) => string; valid: (p: ValuePlayer) => boolean }
export const HL_CRITERIA: HlCriterion[] = [
  { key: 'value', label: 'Market value', emoji: '💰', get: p => p.mv ?? 0, fmt: eur, valid: p => (p.mv ?? 0) > 0 },
  { key: 'peak', label: 'Career-high value', emoji: '📈', get: p => p.maxv ?? 0, fmt: eur, valid: p => (p.maxv ?? 0) > 0 },
  { key: 'fee', label: 'Record transfer fee', emoji: '🔁', get: p => p.fee ?? 0, fmt: eur, valid: p => (p.fee ?? 0) > 0 },
  { key: 'age', label: 'Age', emoji: '🎂', get: p => p.by ? NOW_YEAR - p.by : 0, fmt: v => `${v} yrs`, valid: p => !!p.by },
  { key: 'height', label: 'Height', emoji: '📏', get: p => p.h ?? 0, fmt: v => `${v} cm`, valid: p => (p.h ?? 0) > 0 },
  { key: 'trophies', label: 'Trophies won', emoji: '🏆', get: p => p.tro, fmt: v => `${v}`, valid: p => p.tro > 0 },
  { key: 'clubs', label: 'Clubs played for', emoji: '🧳', get: p => p.clubs, fmt: v => `${v}`, valid: p => p.clubs > 1 },
];
export const critByKey = (k: string) => HL_CRITERIA.find(c => c.key === k) ?? HL_CRITERIA[0];

const KEY = 'sportime_value_index_v1';
const TTL = 24 * 3600 * 1000;
let MEM: ValuePlayer[] | null = null;
export async function getValueIndex(): Promise<ValuePlayer[]> {
  if (MEM?.length) return MEM;
  try { const raw = localStorage.getItem(KEY); if (raw) { const c = JSON.parse(raw); if (Date.now() - c.ts < TTL && Array.isArray(c.data) && c.data.length) { MEM = c.data; return MEM!; } } } catch { /**/ }
  const { data } = await supabase.rpc('puzzle_value_index');
  const list = (data ?? []) as ValuePlayer[];
  if (list.length) { MEM = list; try { localStorage.setItem(KEY, JSON.stringify({ ts: Date.now(), data: list })); } catch { /**/ } }
  return list;
}
export function prefetchValueIndex() { getValueIndex().catch(() => {}); }
