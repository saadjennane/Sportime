import React, { useMemo } from 'react';
import { useMockStore } from '../../store/useMockStore';
import { formatDistanceToNow } from 'date-fns';
import { Gamepad2, Users } from 'lucide-react';

interface FrequentPlayersListProps {
  currentUserId: string;
  onInvite: (username: string) => void;
}

export const FrequentPlayersList: React.FC<FrequentPlayersListProps> = ({ currentUserId, onInvite }) => {
  const { playerGraph } = useMockStore();

  const frequentPlayers = useMemo(() => {
    const userInteractions = playerGraph[currentUserId] || {};
    return Object.values(userInteractions)
      .sort((a, b) => b.interactions - a.interactions)
      .slice(0, 5);
  }, [playerGraph, currentUserId]);

  if (Object.keys(playerGraph).length === 0 || frequentPlayers.length === 0) {
    return (
      <div className="card-base p-8 text-center">
        <div className="text-6xl mb-4">🤝</div>
        <p className="text-text-secondary font-medium">Your squad is forming.</p>
        <p className="text-sm text-text-disabled mt-2">Play games with others to see your frequent teammates here!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-text-secondary flex items-center gap-2">
        <Users size={20} className="text-warm-yellow" /> Your Squad
      </h3>
      <div className="space-y-3">
        {frequentPlayers.map(player => (
          <div key={player.playerId} className="card-base p-3 flex items-center gap-3">
            <img 
              src={`https://api.dicebear.com/8.x/bottts/svg?seed=${player.playerId}`} 
              alt={player.username}
              className="w-12 h-12 rounded-full bg-deep-navy"
            />
            <div className="flex-1">
              <p className="font-bold text-text-primary">{player.username}</p>
              <p className="text-xs text-text-disabled">
                Played {player.interactions} games together
              </p>
              <p className="text-xs text-text-disabled">
                Last played: {formatDistanceToNow(new Date(player.lastInteraction), { addSuffix: true })}
              </p>
            </div>
            <button 
              onClick={() => onInvite(player.username)}
              className="flex items-center gap-2 text-sm font-semibold bg-lime-glow/20 text-lime-glow px-3 py-2 rounded-lg hover:bg-lime-glow/30"
            >
              <Gamepad2 size={16} /> Invite
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
