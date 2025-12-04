import React from 'react';
import { X, ScrollText } from 'lucide-react';

interface FantasyRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FantasyRulesModal: React.FC<FantasyRulesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 space-y-5 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
        
        <div className="flex items-center gap-3">
          <div className="bg-purple-100 p-2 rounded-full">
            <ScrollText className="w-6 h-6 text-purple-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Fantasy Game Rules</h2>
        </div>

        <div className="space-y-3 text-gray-600 text-sm max-h-[50vh] overflow-y-auto pr-2">
          <p>
            <strong>1. Build Your Team:</strong> Select a squad of players for each GameWeek, respecting formation and budget constraints if applicable.
          </p>
          <p>
            <strong>2. Choose a Captain:</strong> Pick one player from your starting lineup to be your Captain. Their points for the GameWeek will be doubled!
          </p>
          <p>
            <strong>3. Use Boosters:</strong> You have powerful boosters like 'Double Impact' or 'Golden Game'. Use one per GameWeek to gain an edge. Used boosters cannot be used again.
          </p>
          <p>
            <strong>4. Scoring:</strong> Players earn points for actions like goals, assists, clean sheets, and saves. They lose points for yellow/red cards and goals conceded.
          </p>
           <p>
            <strong>5. Live Points:</strong> Watch your points update in real-time as matches are played.
          </p>
          <p>
            <strong>6. Deadlines:</strong> Your team is locked once the first match of the GameWeek kicks off. No changes can be made after the deadline.
          </p>
          <p>
            <strong>7. The Winner:</strong> The manager with the most points at the end of the GameWeek wins!
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 mt-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition-colors"
        >
          Got it!
        </button>
      </div>
    </div>
  );
};
