import { supabase } from './supabase';
import { norm, searchPlayers, IndexedPlayer } from './playerIndexService';

export interface GridCrit { type: 'club' | 'nat' | 'born' | 'trophy'; value: any; label: string }
export interface GridPlayer extends IndexedPlayer { clubs: string[]; nat: string | null; by: number | null; tr: string[]; mv: number }

// must mirror the generator's trophyLabel
function trophyLabel(raw: string): string | null {
  const t = (raw || '').toLowerCase();
  if (t.includes('champions league winner')) return 'CHAMPIONS LEAGUE';
  if (t.includes("ballon d'or")) return "BALLON D'OR";
  if (t.includes('world cup winner') && !t.includes('club')) return 'WORLD CUP';
  if (t.includes('europa league')) return 'EUROPA LEAGUE';
  if (t.includes('spanish champion')) return 'LALIGA TITLE';
  if (t.includes('english champion') || t.includes('premier league')) return 'PREMIER LEAGUE';
  if (t.includes('italian champion') || t.includes('serie a')) return 'SERIE A TITLE';
  if (t.includes('german champion') || t.includes('bundesliga')) return 'BUNDESLIGA TITLE';
  if (t.includes('french champion') || t.includes('ligue 1')) return 'LIGUE 1 TITLE';
  return null;
}

const KEY = 'sportime_grid_index_v1';
const TTL = 24 * 3600 * 1000;
let MEM: GridPlayer[] | null = null;

export async function getGridIndex(): Promise<GridPlayer[]> {
  if (MEM?.length) return MEM;
  try { const raw = localStorage.getItem(KEY); if (raw) { const c = JSON.parse(raw); if (Date.now() - c.ts < TTL && Array.isArray(c.data) && c.data.length) { MEM = c.data; return MEM!; } } } catch { /**/ }
  const { data } = await supabase.rpc('puzzle_grid_index');
  const list: GridPlayer[] = (data ?? []).map((p: any) => ({
    id: p.id, name: p.n, photo: p.p, r: 50, key: norm(p.n),
    clubs: p.cl ?? [], nat: p.nat, by: p.by, tr: (p.tr ?? []).map(trophyLabel).filter(Boolean), mv: p.mv ?? 0,
  }));
  if (list.length) { MEM = list; try { localStorage.setItem(KEY, JSON.stringify({ ts: Date.now(), data: list })); } catch { /**/ } }
  return list;
}
export function prefetchGridIndex() { getGridIndex().catch(() => {}); }
export { searchPlayers };

export function fits(p: GridPlayer, c: GridCrit): boolean {
  if (c.type === 'club') return p.clubs.includes(c.value);
  if (c.type === 'nat') return p.nat === c.value;
  if (c.type === 'born') return p.by != null && p.by >= c.value && p.by <= c.value + 9;
  if (c.type === 'trophy') return p.tr.includes(c.value);
  return false;
}
// rarity % of a pick within a cell's valid players (by notoriety): obscure valid pick -> high %
export function cellRarity(index: GridPlayer[], row: GridCrit, col: GridCrit, pid: number): number {
  const valid = index.filter(p => fits(p, row) && fits(p, col));
  const me = valid.find(p => p.id === pid); if (!me || valid.length <= 1) return 0;
  const moreFamous = valid.filter(p => p.mv > me.mv).length;
  return Math.round((100 * moreFamous) / valid.length);
}
