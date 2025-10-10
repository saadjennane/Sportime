import React, { useState } from 'react';
import { League } from '../../types';
import { X } from 'lucide-react';

interface ManageLeagueModalProps {
  isOpen: boolean;
  onClose: () => void;
  league: League;
  onUpdate: (leagueId: string, name: string, description: string | null) => void;
}

export const ManageLeagueModal: React.FC<ManageLeagueModalProps> = ({ isOpen, onClose, league, onUpdate }) => {
  const [name, setName] = useState(league.name);
  const [description, setDescription] = useState(league.description || '');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onUpdate(league.id, name.trim(), description.trim() || null);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 space-y-5 relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-gray-500 hover:bg-gray-100 rounded-full">
          <X size={24} />
        </button>

        <h2 className="text-2xl font-bold text-center text-gray-900">Manage League</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">League Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg"
              rows={2}
            />
          </div>
          <button type="submit" className="w-full py-3 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700">
            Save Changes
          </button>
        </form>
      </div>
    </div>
  );
};
