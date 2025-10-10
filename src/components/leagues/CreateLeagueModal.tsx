import React, { useState } from 'react';
import { X, Shield } from 'lucide-react';

interface CreateLeagueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string | null) => void;
}

export const CreateLeagueModal: React.FC<CreateLeagueModalProps> = ({ isOpen, onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onCreate(name.trim(), description.trim() || null);
      onClose();
      setName('');
      setDescription('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 space-y-5 relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-gray-500 hover:bg-gray-100 rounded-full">
          <X size={24} />
        </button>

        <div className="text-center">
            <div className="inline-block bg-purple-100 p-3 rounded-full mb-3">
                <Shield className="w-8 h-8 text-purple-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Create a New League</h2>
            <p className="text-sm text-gray-500 mt-1">Compete with your friends in a private group.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">League Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg"
              placeholder="e.g., The Champions"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg"
              placeholder="e.g., Weekly predictions on PL matches"
              rows={2}
            />
          </div>
          <button type="submit" className="w-full py-3 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700">
            Create League
          </button>
        </form>
      </div>
    </div>
  );
};
