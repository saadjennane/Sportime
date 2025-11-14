import React, { useState } from 'react';
import { X, Users, Loader2 } from 'lucide-react';

interface MiniCreateLeagueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string) => void;
  loading: boolean;
}

export const MiniCreateLeagueModal: React.FC<MiniCreateLeagueModalProps> = ({ isOpen, onClose, onCreate, loading }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onCreate(name, description);
    }
  };

  return (
    <div className="fixed inset-0 bg-deep-navy/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
      <div className="modal-base max-w-sm w-full p-6 space-y-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-text-secondary hover:bg-white/10 rounded-full">
          <X size={24} />
        </button>
        <div className="text-center">
          <div className="inline-block bg-electric-blue/10 p-3 rounded-full mb-3">
            <Users className="w-8 h-8 text-electric-blue" />
          </div>
          <h2 className="text-2xl font-bold text-text-primary">Create Your Squad</h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Squad Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="input-base" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Description (Optional)</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} className="input-base h-24" />
          </div>
          <button type="submit" disabled={!name.trim() || loading} className="w-full primary-button">
            {loading ? <Loader2 className="animate-spin mx-auto" /> : 'Create & Link Game'}
          </button>
        </form>
      </div>
    </div>
  );
};
