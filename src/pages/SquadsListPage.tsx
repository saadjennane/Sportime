import React from 'react';
import { Squad } from '../types';
import { Plus, Users } from 'lucide-react';

interface SquadsListPageProps {
  squads: Squad[];
  onCreate: () => void;
  onViewSquad: (id: string) => void;
}

const SquadsListPage: React.FC<SquadsListPageProps> = ({ squads, onCreate, onViewSquad }) => {

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-text-primary">Your Squads</h1>
          <button
            onClick={onCreate}
            className="flex items-center gap-2 text-sm font-semibold bg-lime-glow/20 text-lime-glow px-4 py-3 rounded-lg hover:bg-lime-glow/30"
          >
            <Plus size={16} /> Create Squad
          </button>
        </div>

        {squads.length === 0 ? (
          <div className="card-base p-8 text-center animate-scale-in">
            <div className="text-6xl mb-4">🤷‍♀️</div>
            <p className="text-text-secondary font-medium">You haven't joined any squads yet.</p>
            <p className="text-sm text-text-disabled mt-2">Create a new squad or join one with an invite link!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {squads.map(squad => (
              <button
                key={squad.id}
                onClick={() => onViewSquad(squad.id)}
                className="w-full card-base p-4 text-left transition-all hover:shadow-xl hover:border-neon-cyan/50"
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-deep-navy rounded-lg flex items-center justify-center border-2 border-neon-cyan/20">
                    {squad.image_url ? (
                      <img src={squad.image_url} alt={squad.name} className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <Users className="w-8 h-8 text-neon-cyan/50" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-text-primary">{squad.name}</h3>
                    {squad.description && <p className="text-sm text-text-secondary truncate">{squad.description}</p>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default SquadsListPage;
