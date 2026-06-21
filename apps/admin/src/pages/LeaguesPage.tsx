import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, Edit2, Trash2, Download, Eye, EyeOff, Database, Loader2 } from 'lucide-react';
import { Spinner, EmptyState } from '../components/ui/States';
import { PageHeader } from '../components/ui/PageHeader';
import { leagueService } from '../services/leagueService';
import type { LeagueWithTeamCount } from '../types/football';
import { LeagueFormModal } from '../components/admin/LeagueFormModal';
import { ConfirmationModal } from '../components/admin/ConfirmationModal';
import { toast } from '../components/ui/Toast';

type Seed = { teams: number; players: number; fixtures: number };

/** One seeded entity count, green when present / red when empty. */
function SeedBit({ label, n }: { label: string; n: number }) {
  return <span className={n > 0 ? 'text-lime-glow' : 'text-hot-red'}>{label} {n}</span>;
}

export function LeaguesPage() {
  const [leagues, setLeagues] = useState<LeagueWithTeamCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingLeague, setEditingLeague] = useState<LeagueWithTeamCount | null>(null);
  const [season, setSeason] = useState<number>(2026);
  const [leagueIds, setLeagueIds] = useState('');
  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [seedStatus, setSeedStatus] = useState<Record<string, Seed>>({});
  const [seedingId, setSeedingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => { loadLeagues(); }, []);

  const loadLeagues = async () => {
    setLoading(true);
    const { data, error } = await leagueService.getAll();
    if (error) { toast('Failed to load leagues', 'error'); console.error(error); }
    else { setLeagues(data || []); loadSeedStatus(data || []); }
    setLoading(false);
  };

  const loadSeedStatus = async (list: LeagueWithTeamCount[]) => {
    const entries = await Promise.all(list.map(async (l) => [l.id, await leagueService.getSeedStatus(l.id)] as const));
    setSeedStatus(Object.fromEntries(entries));
  };

  // Seed teams + players + fixtures for one league (import-league-full) for the chosen season.
  const handleSeed = async (league: LeagueWithTeamCount) => {
    if (!league.api_id) { toast('League needs an API ID to seed', 'error'); return; }
    setSeedingId(league.id);
    const { data, error } = await leagueService.importFull(league.api_id, season);
    if (!error && data?.ok) toast(`${league.name} ${season}: ${data.teams} teams · ${data.players} players · ${data.fixtures} fixtures`, 'success');
    else toast(`Seed failed: ${error?.message || data?.error || 'unknown'}`, 'error');
    setSeedingId(null);
    await loadLeagues();
  };

  const toggleVisibility = async (league: LeagueWithTeamCount) => {
    const next = (league as any).is_visible === false; // currently hidden → show
    setTogglingId(league.id);
    const { error } = await leagueService.setVisibility(league.id, next);
    if (error) toast('Failed to update visibility', 'error');
    else { toast(next ? `${league.name} is now visible` : `${league.name} hidden`, 'success'); await loadLeagues(); }
    setTogglingId(null);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    const { error } = await leagueService.delete(deleteConfirm.id);
    if (error) { toast('Failed to delete league', 'error'); console.error(error); }
    else { toast('League deleted', 'success'); loadLeagues(); }
    setDeleteConfirm(null);
  };

  const handleModalClose = (success: boolean) => {
    setShowModal(false); setEditingLeague(null);
    if (success) loadLeagues();
  };

  const handleBulkImport = async () => {
    const ids = leagueIds.split(',').map((id) => parseInt(id.trim())).filter((id) => !isNaN(id));
    if (!ids.length) { toast('Enter valid league IDs', 'error'); return; }
    setIsBulkImporting(true);
    let ok = 0, fail = 0;
    for (const id of ids) {
      const { data, error } = await leagueService.importFull(id, season);
      if (!error && data?.ok) { ok++; toast(`${data.league}: ${data.teams ?? 0} teams · ${data.players ?? 0} players · ${data.fixtures ?? 0} fixtures`, 'success'); }
      else { fail++; toast(`League ${id} failed: ${error?.message || data?.error || 'unknown'}`, 'error'); }
    }
    await loadLeagues();
    setIsBulkImporting(false); setLeagueIds('');
    toast(`Import complete: ${ok} ok${fail ? ` · ${fail} failed` : ''}`, fail ? 'error' : 'success');
  };

  const q = searchQuery.trim().toLowerCase();
  const matches = (l: LeagueWithTeamCount) => !q || l.name.toLowerCase().includes(q) || (l.country_id || '').toLowerCase().includes(q);
  const visible = leagues.filter((l) => (l as any).is_visible !== false && matches(l));
  const hidden = leagues.filter((l) => (l as any).is_visible === false && matches(l));

  const Section = ({ title, list, tone }: { title: string; list: LeagueWithTeamCount[]; tone: 'on' | 'off' }) => (
    <section>
      <div className="flex items-center gap-2 mb-2">
        {tone === 'on' ? <Eye className="w-4 h-4 text-lime-glow" /> : <EyeOff className="w-4 h-4 text-text-disabled" />}
        <h2 className="text-lg font-bold">{title}</h2>
        <span className="text-sm text-text-secondary">({list.length})</span>
      </div>
      {list.length === 0 ? (
        <div className="bg-surface border border-border-subtle rounded-xl"><EmptyState title={tone === 'on' ? 'No visible leagues' : 'No hidden leagues'} /></div>
      ) : (
        <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden divide-y divide-border-subtle">
          {list.map((league) => {
            const seed = seedStatus[league.id];
            const seeded = (seed?.teams ?? 0) > 0;
            const busy = seedingId === league.id;
            return (
              <div key={league.id} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-hover">
                {league.logo || (league as any).logo_url
                  ? <img src={league.logo || (league as any).logo_url} alt="" className="w-8 h-8 object-contain shrink-0" />
                  : <div className="w-8 h-8 bg-background-dark rounded flex items-center justify-center text-text-disabled text-[10px] shrink-0">N/A</div>}
                <div className="min-w-0 flex-1">
                  <Link to={`/teams?leagueId=${league.id}&leagueName=${encodeURIComponent(league.name)}`}
                    className="font-medium truncate block hover:text-electric-blue hover:underline" title="View teams in this league">
                    {league.name}
                  </Link>
                  <div className="text-xs text-text-secondary truncate">
                    {(league.country_id || '—')} · {league.type || 'League'} · API {league.api_league_id || league.api_id || '—'}
                  </div>
                </div>
                {/* Seed status */}
                <div className="hidden sm:flex flex-col text-xs leading-tight text-right mr-1 w-28">
                  {seed ? (
                    <>
                      <SeedBit label="Teams" n={seed.teams} />
                      <span className="text-text-secondary">{seed.players} players · {seed.fixtures} fixtures</span>
                    </>
                  ) : <span className="text-text-disabled">loading…</span>}
                </div>
                {/* Seed / Update */}
                <button
                  onClick={() => handleSeed(league)}
                  disabled={busy || !league.api_id}
                  title={league.api_id ? `Seed/refresh teams + players + fixtures for season ${season}` : 'Needs an API ID'}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50 ${seeded ? 'bg-surface-hover text-text-secondary border border-border-subtle' : 'bg-warm-yellow/15 text-warm-yellow'}`}
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                  {seeded ? 'Update' : 'Seed'}
                </button>
                {/* Visibility toggle */}
                <button onClick={() => toggleVisibility(league)} disabled={togglingId === league.id}
                  className="p-2 rounded-lg hover:bg-background-dark disabled:opacity-50"
                  title={tone === 'on' ? 'Visible — click to hide' : 'Hidden — click to show'}>
                  {tone === 'on' ? <Eye className="w-4 h-4 text-lime-glow" /> : <EyeOff className="w-4 h-4 text-text-disabled" />}
                </button>
                <button onClick={() => { setEditingLeague(league); setShowModal(true); }} className="p-2 rounded-lg hover:bg-background-dark" title="Edit"><Edit2 className="w-4 h-4 text-electric-blue" /></button>
                <button onClick={() => setDeleteConfirm({ id: league.id, name: league.name })} className="p-2 rounded-lg hover:bg-background-dark" title="Delete"><Trash2 className="w-4 h-4 text-hot-red" /></button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );

  return (
    <div>
      <PageHeader
        title="Leagues"
        subtitle={`${visible.length} visible · ${hidden.length} hidden`}
        actions={
          <>
            <label className="flex items-center gap-1.5 text-sm text-text-secondary">
              Season
              <input type="number" value={season} onChange={(e) => setSeason(parseInt(e.target.value) || 2026)}
                className="w-24 px-2 py-1.5 bg-surface border border-border-subtle rounded-lg text-text-primary" />
            </label>
            <button onClick={() => { setEditingLeague(null); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-electric-blue hover:bg-electric-blue/80 text-white rounded-lg">
              <Plus className="w-5 h-5" /> Create League
            </button>
          </>
        }
      />

      {/* Import new leagues by API id (collapsible) */}
      <details className="mb-5 bg-surface border border-border-subtle rounded-xl">
        <summary className="cursor-pointer select-none px-4 py-3 font-semibold flex items-center gap-2"><Download className="w-4 h-4" /> Import leagues from API-Football</summary>
        <div className="px-4 pb-4">
          <p className="text-sm text-text-secondary mb-3">League ID(s), comma-separated — e.g. 39 (PL), 140 (La Liga), 78 (Bundesliga), 135 (Serie A), 1 (World Cup). Uses the Season above.</p>
          <div className="flex gap-3">
            <input type="text" value={leagueIds} onChange={(e) => setLeagueIds(e.target.value)} placeholder="39,140,78,135" disabled={isBulkImporting}
              className="flex-1 px-4 py-2 bg-background-dark border border-border-subtle rounded-lg disabled:opacity-50" />
            <button onClick={handleBulkImport} disabled={isBulkImporting || !leagueIds.trim()}
              className="flex items-center gap-2 px-5 py-2 bg-electric-blue hover:bg-electric-blue/80 disabled:opacity-50 text-white rounded-lg">
              {isBulkImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Import
            </button>
          </div>
        </div>
      </details>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-disabled" />
        <input type="text" placeholder="Search leagues…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-surface border border-border-subtle rounded-lg focus:outline-none focus:border-electric-blue" />
      </div>

      {loading ? (
        <Spinner label="Loading leagues…" />
      ) : (
        <div className="space-y-8">
          <Section title="Visible in app" list={visible} tone="on" />
          <Section title="Hidden" list={hidden} tone="off" />
        </div>
      )}

      {showModal && <LeagueFormModal league={editingLeague} onClose={handleModalClose} addToast={toast} />}
      {deleteConfirm && (
        <ConfirmationModal title="Delete League" message={`Delete "${deleteConfirm.name}"? This cannot be undone and removes associated data.`}
          confirmText="Delete" cancelText="Cancel" isDangerous onConfirm={confirmDelete} onCancel={() => setDeleteConfirm(null)} />
      )}
    </div>
  );
}
