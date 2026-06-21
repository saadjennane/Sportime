import { useEffect, useState } from 'react';
import { X, Search } from 'lucide-react';
import { playerService } from '../../services/playerService';
import { teamService } from '../../services/teamService';
import type { PlayerWithTeam } from '../../types/football';
import { toast } from '../ui/Toast';

const POSITIONS = ['Goalkeeper', 'Defender', 'Midfielder', 'Attacker'];

export function PlayerEditModal({ player, onClose }: { player: PlayerWithTeam; onClose: (saved: boolean) => void }) {
  const [name, setName] = useState(player.name || '');
  const [firstName, setFirstName] = useState(player.first_name || '');
  const [lastName, setLastName] = useState(player.last_name || '');
  const [position, setPosition] = useState(player.position || '');
  const [teamQuery, setTeamQuery] = useState('');
  const [teamResults, setTeamResults] = useState<{ id: string; name: string; logo: string | null }[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<{ id: string; name: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // Debounced team search.
  useEffect(() => {
    if (!teamQuery.trim()) { setTeamResults([]); return; }
    const t = setTimeout(async () => setTeamResults(await teamService.search(teamQuery)), 250);
    return () => clearTimeout(t);
  }, [teamQuery]);

  const save = async () => {
    if (!name.trim() && !lastName.trim()) { toast('Name required', 'error'); return; }
    setSaving(true);
    const update: any = { name: name.trim(), first_name: firstName.trim(), last_name: lastName.trim(), position };
    if (selectedTeam) update.team_id = selectedTeam.id;
    const { error } = await playerService.update(player.id, update);
    // Keep the team-history table in sync (ends the old association, opens a new one).
    if (!error && selectedTeam) await playerService.addToTeam(player.id, selectedTeam.id, new Date().toISOString().slice(0, 10));
    setSaving(false);
    if (error) toast(`Failed to update player: ${error.message}`, 'error');
    else { toast('Player updated ✓', 'success'); onClose(true); }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={() => onClose(false)}>
      <div className="bg-surface border border-border-subtle rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border-subtle">
          <h2 className="text-xl font-bold">Edit player</h2>
          <button onClick={() => onClose(false)} className="text-text-secondary hover:text-text-primary"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Display name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Lamine Yamal"
              className="w-full px-3 py-2 bg-background-dark border border-border-subtle rounded-lg focus:outline-none focus:border-electric-blue" />
            <p className="text-xs text-text-disabled mt-1">Shown everywhere in the app.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">First name</label>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-3 py-2 bg-background-dark border border-border-subtle rounded-lg focus:outline-none focus:border-electric-blue" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Last name</label>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)}
                className="w-full px-3 py-2 bg-background-dark border border-border-subtle rounded-lg focus:outline-none focus:border-electric-blue" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Position</label>
            <select value={position} onChange={(e) => setPosition(e.target.value)}
              className="w-full px-3 py-2 bg-background-dark border border-border-subtle rounded-lg focus:outline-none focus:border-electric-blue">
              <option value="">—</option>
              {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* Team */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Team</label>
            <div className="text-sm text-text-secondary mb-2">
              Current: <span className="text-text-primary font-medium">{selectedTeam?.name || player.team_name || '—'}</span>
              {selectedTeam && <span className="text-lime-glow ml-1">(changed)</span>}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-disabled" />
              <input value={teamQuery} onChange={(e) => setTeamQuery(e.target.value)} placeholder="Search a team to reassign…"
                className="w-full pl-9 pr-3 py-2 bg-background-dark border border-border-subtle rounded-lg focus:outline-none focus:border-electric-blue" />
            </div>
            {teamResults.length > 0 && (
              <div className="mt-1 border border-border-subtle rounded-lg overflow-hidden divide-y divide-border-subtle/50 max-h-48 overflow-y-auto">
                {teamResults.map((t) => (
                  <button key={t.id} onClick={() => { setSelectedTeam({ id: t.id, name: t.name }); setTeamQuery(''); setTeamResults([]); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-surface-hover">
                    {t.logo ? <img src={t.logo} alt="" className="w-5 h-5 object-contain" /> : <div className="w-5 h-5 bg-background-dark rounded" />}
                    {t.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-5 border-t border-border-subtle">
          <button onClick={() => onClose(false)} className="px-4 py-2 rounded-lg bg-background-dark border border-border-subtle text-sm font-semibold">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-electric-blue text-white text-sm font-semibold disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
