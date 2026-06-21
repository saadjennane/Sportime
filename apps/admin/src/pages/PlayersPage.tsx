import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Trash2, Edit2, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { playerService } from '../services/playerService';
import type { PlayerWithTeam } from '../types/football';
import { ConfirmationModal } from '../components/admin/ConfirmationModal';
import { PlayerEditModal } from '../components/admin/PlayerEditModal';
import { PageHeader } from '../components/ui/PageHeader';
import { Spinner, EmptyState } from '../components/ui/States';
import { toast } from '../components/ui/Toast';

const PAGE_SIZE = 50;

export function PlayersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const teamId = searchParams.get('teamId') || '';
  const teamName = searchParams.get('teamName') || '';
  const [rows, setRows] = useState<PlayerWithTeam[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [debounced, setDebounced] = useState({ q: '', team: '' });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<PlayerWithTeam | null>(null);

  // Debounce search / team filter → reset to first page.
  useEffect(() => {
    const t = setTimeout(() => { setDebounced({ q: search, team: teamFilter }); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [search, teamFilter]);

  useEffect(() => { setPage(0); }, [teamId]);
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [debounced, page, teamId]);

  const load = async () => {
    setLoading(true);
    const { data, count, error } = await playerService.getPaged({ q: debounced.q, team: debounced.team, teamId, page, pageSize: PAGE_SIZE });
    if (error) { toast('Failed to load players', 'error'); console.error(error); }
    else { setRows(data); setTotal(count); setSelected(new Set()); }
    setLoading(false);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const fromN = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const toN = Math.min(total, (page + 1) * PAGE_SIZE);

  const toggleSel = (id: string) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected((p) => (p.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))));

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    const { error } = await playerService.delete(deleteConfirm.id);
    if (error) { toast('Failed to delete player', 'error'); console.error(error); }
    else { toast('Player deleted', 'success'); load(); }
    setDeleteConfirm(null);
  };

  const confirmBulkDelete = async () => {
    let ok = 0, fail = 0;
    for (const id of Array.from(selected)) {
      const { error } = await playerService.delete(id);
      error ? fail++ : ok++;
    }
    toast(`Deleted ${ok} player(s)${fail ? ` · failed ${fail}` : ''}`, fail ? 'error' : 'success');
    setSelected(new Set());
    setBulkDeleteConfirm(false);
    load();
  };

  return (
    <div>
      <PageHeader
        title="Players"
        subtitle={`${total.toLocaleString()} players`}
        actions={selected.size > 0 ? (
          <button onClick={() => setBulkDeleteConfirm(true)} className="flex items-center gap-2 px-4 py-2 bg-hot-red hover:bg-hot-red/80 text-white rounded-lg">
            <Trash2 className="w-4 h-4" /> Delete selected ({selected.size})
          </button>
        ) : undefined}
      />

      {/* Team drill-down banner */}
      {teamId && (
        <div className="mb-4 flex items-center justify-between gap-3 px-4 py-2.5 bg-electric-blue/10 border border-electric-blue/20 rounded-lg">
          <span className="text-sm">Filtered to team <span className="font-semibold">{teamName || 'selected team'}</span></span>
          <button onClick={() => setSearchParams({})} className="flex items-center gap-1 text-sm text-electric-blue font-semibold hover:underline">
            <X className="w-4 h-4" /> Clear
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-disabled" />
          <input type="text" placeholder="Search players…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface border border-border-subtle rounded-lg focus:outline-none focus:border-electric-blue" />
        </div>
        <div className="relative w-64">
          <input type="text" placeholder="Filter by team…" value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}
            className="w-full px-4 py-2 bg-surface border border-border-subtle rounded-lg focus:outline-none focus:border-electric-blue" />
          {teamFilter && <button onClick={() => setTeamFilter('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-disabled hover:text-text-primary">×</button>}
        </div>
      </div>

      <div className="bg-surface border border-border-subtle rounded-lg overflow-hidden">
        {loading ? (
          <Spinner label="Loading players…" />
        ) : rows.length === 0 ? (
          <EmptyState title="No players found" subtitle={debounced.q || debounced.team ? 'Try a different search.' : 'No players in the database.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-background-dark border-b border-border-subtle">
                <tr>
                  <th className="px-4 py-3 w-12"><input type="checkbox" checked={rows.length > 0 && selected.size === rows.length} onChange={toggleAll} className="w-4 h-4 rounded" /></th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">Photo</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">Position</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">API ID</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">Current Team</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-text-secondary">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {rows.map((player) => (
                  <tr key={player.id} className="hover:bg-surface-hover transition-colors">
                    <td className="px-4 py-3"><input type="checkbox" checked={selected.has(player.id)} onChange={() => toggleSel(player.id)} className="w-4 h-4 rounded" /></td>
                    <td className="px-4 py-3">
                      {player.photo || (player as any).photo_url ? (
                        <img src={player.photo || (player as any).photo_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 bg-background-dark rounded-full flex items-center justify-center text-text-disabled text-xs">N/A</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">{player.name || `${player.first_name} ${player.last_name}`}</td>
                    <td className="px-4 py-3 text-text-secondary">{player.position || '-'}</td>
                    <td className="px-4 py-3 text-text-secondary">{(player as any).api_player_id || (player as any).api_id || '-'}</td>
                    <td className="px-4 py-3 text-text-secondary">{player.team_name || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setEditingPlayer(player)}
                          className="p-2 hover:bg-background-dark rounded-lg" title="Edit player">
                          <Edit2 className="w-4 h-4 text-electric-blue" />
                        </button>
                        <button onClick={() => setDeleteConfirm({ id: player.id, name: player.name || `${player.first_name} ${player.last_name}` })}
                          className="p-2 hover:bg-hot-red/10 rounded-lg group" title="Delete player">
                          <Trash2 className="w-4 h-4 text-text-secondary group-hover:text-hot-red" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && total > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-text-secondary">
          <span>{fromN.toLocaleString()}–{toN.toLocaleString()} of {total.toLocaleString()}</span>
          <div className="flex items-center gap-2">
            <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface border border-border-subtle disabled:opacity-40"><ChevronLeft size={15} /> Prev</button>
            <span>Page {page + 1} / {totalPages}</span>
            <button disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface border border-border-subtle disabled:opacity-40">Next <ChevronRight size={15} /></button>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <ConfirmationModal title="Delete Player" message={`Delete "${deleteConfirm.name}"? This cannot be undone.`}
          confirmText="Delete" cancelText="Cancel" isDangerous onConfirm={confirmDelete} onCancel={() => setDeleteConfirm(null)} />
      )}
      {bulkDeleteConfirm && (
        <ConfirmationModal title="Delete Multiple Players" message={`Delete ${selected.size} player(s)? This cannot be undone.`}
          confirmText="Delete All" cancelText="Cancel" isDangerous onConfirm={confirmBulkDelete} onCancel={() => setBulkDeleteConfirm(false)} />
      )}
      {editingPlayer && (
        <PlayerEditModal player={editingPlayer} onClose={(saved) => { setEditingPlayer(null); if (saved) load(); }} />
      )}
    </div>
  );
}
