import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { teamService } from '../../services/teamService';
import type { TeamWithCounts, TeamInput } from '../../types/football';

interface TeamFormModalProps {
  team: TeamWithCounts | null;
  onClose: (success: boolean) => void;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export function TeamFormModal({ team, onClose, addToast }: TeamFormModalProps) {
  const [formData, setFormData] = useState<TeamInput>({
    name: '',
    logo_url: '',
    logo: '',
    country: '',
    founded: undefined,
    venue_name: '',
    venue_capacity: undefined,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (team) {
      setFormData({
        name: team.name,
        logo_url: team.logo_url || '',
        logo: team.logo || '',
        country: team.country,
        founded: team.founded,
        venue_name: team.venue_name || '',
        venue_capacity: team.venue_capacity,
      });
    }
  }, [team]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (team) {
        // Update
        const { error } = await teamService.update(team.id, formData);
        if (error) throw error;
        addToast('Team updated successfully', 'success');
      } else {
        // Create
        const { error } = await teamService.create(formData);
        if (error) throw error;
        addToast('Team created successfully', 'success');
      }
      onClose(true);
    } catch (error) {
      console.error(error);
      addToast('Failed to save team', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-surface border border-border-subtle rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border-subtle">
          <h2 className="text-2xl font-bold">
            {team ? 'Edit Team' : 'Create Team'}
          </h2>
          <button
            onClick={() => onClose(false)}
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Name <span className="text-hot-red">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 bg-background-dark border border-border-subtle rounded-lg focus:outline-none focus:border-electric-blue"
              placeholder="Manchester United"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Country <span className="text-hot-red">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              className="w-full px-4 py-2 bg-background-dark border border-border-subtle rounded-lg focus:outline-none focus:border-electric-blue"
              placeholder="England"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Logo URL</label>
            <input
              type="url"
              value={formData.logo_url}
              onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
              className="w-full px-4 py-2 bg-background-dark border border-border-subtle rounded-lg focus:outline-none focus:border-electric-blue"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Logo (API-Football)
            </label>
            <input
              type="url"
              value={formData.logo}
              onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
              className="w-full px-4 py-2 bg-background-dark border border-border-subtle rounded-lg focus:outline-none focus:border-electric-blue"
              placeholder="https://..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Founded</label>
              <input
                type="number"
                value={formData.founded || ''}
                onChange={(e) => setFormData({ ...formData, founded: e.target.value ? parseInt(e.target.value) : undefined })}
                className="w-full px-4 py-2 bg-background-dark border border-border-subtle rounded-lg focus:outline-none focus:border-electric-blue"
                placeholder="1878"
                min="1800"
                max={new Date().getFullYear()}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Venue Capacity</label>
              <input
                type="number"
                value={formData.venue_capacity || ''}
                onChange={(e) => setFormData({ ...formData, venue_capacity: e.target.value ? parseInt(e.target.value) : undefined })}
                className="w-full px-4 py-2 bg-background-dark border border-border-subtle rounded-lg focus:outline-none focus:border-electric-blue"
                placeholder="75000"
                min="0"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Venue Name</label>
            <input
              type="text"
              value={formData.venue_name}
              onChange={(e) => setFormData({ ...formData, venue_name: e.target.value })}
              className="w-full px-4 py-2 bg-background-dark border border-border-subtle rounded-lg focus:outline-none focus:border-electric-blue"
              placeholder="Old Trafford"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => onClose(false)}
              className="px-4 py-2 bg-surface-hover hover:bg-border-subtle rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-electric-blue hover:bg-electric-blue/80 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : team ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
