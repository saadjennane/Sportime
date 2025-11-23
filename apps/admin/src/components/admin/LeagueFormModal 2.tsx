import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { leagueService } from '../../services/leagueService';
import type { LeagueWithTeamCount, LeagueInput } from '../../types/football';

interface LeagueFormModalProps {
  league: LeagueWithTeamCount | null;
  onClose: (success: boolean) => void;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export function LeagueFormModal({ league, onClose, addToast }: LeagueFormModalProps) {
  const [formData, setFormData] = useState<LeagueInput>({
    name: '',
    country_id: '',
    logo_url: '',
    logo: '',
    type: '',
    description: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (league) {
      setFormData({
        name: league.name,
        country_id: league.country_id,
        logo_url: league.logo_url || '',
        logo: league.logo || '',
        type: league.type || '',
        description: league.description || '',
      });
    }
  }, [league]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (league) {
        // Update
        const { error } = await leagueService.update(league.id, formData);
        if (error) throw error;
        addToast('League updated successfully', 'success');
      } else {
        // Create
        const { error } = await leagueService.create(formData);
        if (error) throw error;
        addToast('League created successfully', 'success');
      }
      onClose(true);
    } catch (error) {
      console.error(error);
      addToast('Failed to save league', 'error');
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
            {league ? 'Edit League' : 'Create League'}
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
              placeholder="Premier League"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Country <span className="text-hot-red">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.country_id}
              onChange={(e) => setFormData({ ...formData, country_id: e.target.value })}
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

          <div>
            <label className="block text-sm font-medium mb-2">Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full px-4 py-2 bg-background-dark border border-border-subtle rounded-lg focus:outline-none focus:border-electric-blue"
            >
              <option value="">Select type...</option>
              <option value="football_competition">Football Competition</option>
              <option value="cup">Cup</option>
              <option value="international">International</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 bg-background-dark border border-border-subtle rounded-lg focus:outline-none focus:border-electric-blue"
              placeholder="League description..."
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
              {loading ? 'Saving...' : league ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
