import React from 'react';
import { FantasyPlayer } from '../../types';
import { X, Replace } from 'lucide-react';

interface SubstitutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  dnpPlayer: FantasyPlayer;
  availableSubs: FantasyPlayer[];
  onConfirm: (dnpPlayerId: string, subPlayerId: string) => void;
}

export const SubstitutionModal: React.FC<SubstitutionModalProps> = ({ isOpen, onClose, dnpPlayer, availableSubs, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 space-y-5 relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-gray-500 hover:bg-gray-100 rounded-full">
          <X size={24} />
        </button>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Make a Substitution</h2>
          <p className="text-sm text-gray-500 mt-1">
            <span className="font-semibold">{dnpPlayer.name}</span> did not play. Choose a substitute from your bench.
          </p>
        </div>

        <div className="space-y-2">
          {availableSubs.length > 0 ? (
            availableSubs.map(sub => (
              <button
                key={sub.id}
                onClick={() => onConfirm(dnpPlayer.id, sub.id)}
                className="w-full flex items-center gap-3 p-3 bg-gray-50 hover:bg-purple-50 rounded-xl transition-colors text-left"
              >
                <img src={sub.photo} alt={sub.name} className="w-10 h-10 rounded-full object-cover" />
                <div className="flex-1">
                  <p className="font-bold text-sm">{sub.name}</p>
                  <p className="text-xs text-gray-500">{sub.position}</p>
                </div>
                <div className="flex items-center gap-1 text-purple-600 font-semibold">
                  <Replace size={16} />
                  <span>Sub In</span>
                </div>
              </button>
            ))
          ) : (
            <p className="text-center text-sm text-gray-500 py-4">No available substitutes for this position.</p>
          )}
        </div>
      </div>
    </div>
  );
};
