import React from 'react';
import { LiveGame } from '../../types';
import { ArrowLeft } from 'lucide-react';

interface FantasyLiveTeamSelectionPageProps {
  game: LiveGame;
  onBack: () => void;
}

const FantasyLiveTeamSelectionPage: React.FC<FantasyLiveTeamSelectionPageProps> = ({ game, onBack }) => {
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-text-secondary font-semibold hover:text-electric-blue">
        <ArrowLeft size={20} /> Back to League
      </button>
      <div className="card-base p-8 text-center">
        <h2 className="text-xl font-bold text-text-primary">Team Selection for {game.match_details.teamA.name} vs {game.match_details.teamB.name}</h2>
        <p className="text-text-secondary mt-4">Fantasy Live Team Selection Page - Coming Soon!</p>
      </div>
    </div>
  );
};

export default FantasyLiveTeamSelectionPage;
