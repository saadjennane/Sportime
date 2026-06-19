import React, { useState, useEffect } from 'react';
import { X, Check, ArrowLeft } from 'lucide-react';
import { Booster, FantasyPlayer } from '../types';
import { FatigueBar } from './fantasy/FatigueBar';

interface BoosterSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  boosters: Booster[];
  onSelect: (booster: Booster, targetId?: string) => void;
  teamPlayers: FantasyPlayer[];
}

export const BoosterSelectionModal: React.FC<BoosterSelectionModalProps> = ({ isOpen, onClose, boosters, onSelect, teamPlayers }) => {
  const [view, setView] = useState<'list' | 'target_selection'>('list');
  const [selectedBooster, setSelectedBooster] = useState<Booster | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setView('list');
      setSelectedBooster(null);
      setSelectedTargetId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBoosterClick = (booster: Booster) => {
    if (booster.used) return;
    if (booster.id === 3) { // Recovery Boost
      setSelectedBooster(booster);
      setView('target_selection');
    } else {
      onSelect(booster);
      onClose();
    }
  };

  const handleTargetSelect = (playerId: string) => {
    setSelectedTargetId(current => (current === playerId ? null : playerId));
  };

  const handleConfirmTarget = () => {
    if (selectedBooster && selectedTargetId) {
      onSelect(selectedBooster, selectedTargetId);
      onClose();
    }
  };
  
  const fieldPlayers = teamPlayers.filter(p => p.position !== 'Goalkeeper');

  const renderListView = () => (
    <>
      <div className="flex flex-col items-center gap-2 text-center">
        <h2 className="text-2xl font-bold text-text-primary">Select a Booster</h2>
        <p className="text-sm text-text-secondary">You can use one booster per GameWeek.</p>
      </div>
      <div className="space-y-3">
        {boosters.map(booster => (
          <div 
            key={booster.id} 
            className={`p-4 rounded-xl border-2 transition-all ${booster.used ? 'bg-deep-navy border-white/10 opacity-60' : 'bg-deep-navy border-white/10'}`}
          >
            <div className="flex items-center gap-4">
              <div className={`p-2 rounded-lg ${booster.used ? 'bg-navy-accent' : 'bg-neon-cyan/15'}`}>
                {booster.icon}
              </div>
              <div className="flex-1">
                <h3 className={`font-bold ${booster.used ? 'text-text-secondary' : 'text-text-primary'}`}>{booster.name}</h3>
                <p className="text-xs text-text-secondary">{booster.description}</p>
              </div>
              {booster.used ? (
                <span className="text-xs font-bold text-text-disabled bg-navy-accent px-3 py-1 rounded-full">Used</span>
              ) : (
                <button 
                  onClick={() => handleBoosterClick(booster)}
                  className="font-semibold text-sm text-neon-cyan bg-neon-cyan/15 hover:bg-neon-cyan/25 px-4 py-2 rounded-lg"
                >
                  Select
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );

  const renderTargetSelectionView = () => (
    <>
      <div className="flex items-center gap-2 text-center relative">
        <button onClick={() => setView('list')} className="absolute left-0 p-2 text-text-secondary hover:bg-white/10 rounded-full">
            <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
            <h2 className="text-2xl font-bold text-text-primary">Select Target Player</h2>
            <p className="text-sm text-text-secondary">Choose a field player to apply the Recovery Boost.</p>
        </div>
      </div>
      <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
        {fieldPlayers.map(player => (
          <button 
            key={player.id}
            onClick={() => handleTargetSelect(player.id)}
            className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors border-2 ${selectedTargetId === player.id ? 'bg-lime-glow/15 border-lime-glow' : 'hover:bg-white/5 border-transparent'}`}
          >
            <img src={player.photo} alt={player.name} className="w-10 h-10 rounded-full object-cover" />
            <div className="flex-1">
              <p className="font-semibold text-sm text-text-primary">{player.name}</p>
              <div className="w-20">
                <FatigueBar fatigue={Math.round(player.fatigue * 100)} />
              </div>
            </div>
            {selectedTargetId === player.id && <Check className="text-lime-glow" />}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={handleConfirmTarget} disabled={!selectedTargetId} className="flex-1 py-3 bg-electric-blue text-white rounded-xl font-semibold disabled:bg-disabled disabled:opacity-60">
          Apply Booster
        </button>
      </div>
    </>
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
      <div className="modal-base max-w-sm w-full p-6 space-y-5 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-text-secondary hover:bg-white/10 rounded-full transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
        {view === 'list' ? renderListView() : renderTargetSelectionView()}
      </div>
    </div>
  );
};
