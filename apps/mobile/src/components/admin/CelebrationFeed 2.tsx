import React from 'react';
import { CelebrationEvent } from '../../types';
import { format, parseISO } from 'date-fns';
import { Trophy, Gift } from 'lucide-react';

interface CelebrationFeedProps {
  celebrations: CelebrationEvent[];
}

export const CelebrationFeed: React.FC<CelebrationFeedProps> = ({ celebrations }) => {
  if (celebrations.length === 0) {
    return (
      <div className="card-base p-8 text-center">
        <div className="text-6xl mb-4">🤫</div>
        <p className="text-text-secondary font-medium">The celebration feed is empty.</p>
        <p className="text-sm text-text-disabled mt-2">Celebrate some winners for a seasonal game to see events here!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="font-bold text-lg text-electric-blue">Celebration Feed</h2>
      {celebrations.map(event => (
        <div key={event.id} className="card-base p-4 space-y-3">
          <div className="border-b border-disabled pb-3">
            <p className="text-xs text-text-disabled">{format(parseISO(event.createdAt), 'MMM d, yyyy')}</p>
            <h3 className="font-bold text-text-primary">{event.gameName}</h3>
            <p className="text-sm text-text-secondary italic">"{event.message}"</p>
          </div>
          <div className="space-y-2">
            {event.topPlayers.map(player => (
              <div key={player.userId} className="flex items-center justify-between bg-deep-navy p-2 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-text-disabled w-6">{player.rank}.</span>
                  <p className="font-semibold text-text-primary">{player.username}</p>
                </div>
                <div className="flex items-center gap-1 text-xs font-semibold text-lime-glow bg-lime-glow/10 px-2 py-1 rounded-md">
                  <Gift size={14} />
                  <span>
                    {player.reward.type === 'ticket' 
                      ? `${player.reward.tier} Ticket`
                      : `${player.reward.value} ${player.reward.type}`
                    }
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
