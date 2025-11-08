import React, { useState } from 'react';
import { X, Users } from 'lucide-react';

interface CreateLeagueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string, imageUrl: string | null) => void;
}

export const CreateLeagueModal: React.FC<CreateLeagueModalProps> = ({ isOpen, onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onCreate(name, description, null); // Image URL not implemented in this MVP
    }
  };

  return (
    <div className="fixed inset-0 bg-deep-navy/80 backdrop-blur-lg flex items-center justify-center p-4 z-50 animate-scale-in">
      <div className="modal-base max-w-sm w-full p-8 space-y-6 relative border-2 border-electric-blue/30">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-text-secondary hover:bg-white/10 rounded-full transition-colors">
          <X size={24} />
        </button>
        <div className="text-center">
          <div className="inline-block bg-electric-blue/10 p-4 rounded-full mb-3">
            <Users className="w-12 h-12 text-electric-blue" />
          </div>
          <h2 className="text-3xl font-bold text-text-primary">Create a New Squad</h2>
          <p className="text-text-secondary mt-2">Compete with friends in private challenges</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-text-secondary mb-2">Squad Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="input-base"
              placeholder="Enter squad name..."
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-text-secondary mb-2">Description (Optional)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="input-base h-24 resize-none"
              placeholder="Describe your squad..."
            />
          </div>
          <button type="submit" disabled={!name.trim()} className="w-full primary-button text-lg">
            Create Squad
          </button>
        </form>
      </div>
    </div>
  );
};
