import React, { useState, useMemo } from 'react';
import { UserLeague } from '../../types';
import { X, Users, Loader2 } from 'lucide-react';

interface SelectLeaguesToLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLink: (leagueIds: string[]) => void;
  adminLeagues: UserLeague[];
  alreadyLinkedLeagueIds: string[];
  loading: boolean;
}

export const SelectLeaguesToLinkModal: React.FC<SelectLeaguesToLinkModalProps> = ({ isOpen, onClose, onLink, adminLeagues, alreadyLinkedLeagueIds, loading }) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const availableLeagues = useMemo(() => {
    return adminLeagues.filter(l => !alreadyLinkedLeagueIds.includes(l.id));
  }, [adminLeagues, alreadyLinkedLeagueIds]);

  if (!isOpen) return null;

  const toggleSelection = (leagueId: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(leagueId)) {
        newSet.delete(leagueId);
      } else {
        newSet.add(leagueId);
      }
      return newSet;
    });
  };

  const handleLink = () => {
    onLink(Array.from(selectedIds));
  };

  return (
    <div className="fixed inset-0 bg-deep-navy/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
      <div className="modal-base max-w-sm w-full h-auto max-h-[80vh] flex flex-col p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-text-primary">Select Leagues to Link</h2>
          <button onClick={onClose} className="p-2 text-text-secondary hover:bg-white/10 rounded-full">
            <X size={24} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {availableLeagues.length > 0 ? availableLeagues.map(league => (
            <button
              key={league.id}
              onClick={() => toggleSelection(league.id)}
              className={`w-full flex items-center gap-3 p-3 text-left rounded-xl transition-colors ${selectedIds.has(league.id) ? 'bg-electric-blue/20' : 'bg-deep-navy hover:bg-navy-accent'}`}
            >
              <div className={`w-5 h-5 flex-shrink-0 rounded-md border-2 transition-all ${selectedIds.has(league.id) ? 'bg-electric-blue border-electric-blue' : 'border-disabled'}`} />
              <div className="w-8 h-8 bg-black/20 rounded-md flex items-center justify-center">
                {league.image_url ? <img src={league.image_url} alt={league.name} className="w-full h-full object-cover rounded-md" /> : <Users size={18} className="text-text-disabled" />}
              </div>
              <span className="font-semibold text-text-primary">{league.name}</span>
            </button>
          )) : (
            <p className="text-center text-text-disabled py-8">No unlinked admin leagues available.</p>
          )}
        </div>

        <button onClick={handleLink} disabled={selectedIds.size === 0 || loading} className="w-full primary-button">
          {loading ? <Loader2 className="animate-spin mx-auto" /> : `Link Game (${selectedIds.size})`}
        </button>
      </div>
    </div>
  );
};
