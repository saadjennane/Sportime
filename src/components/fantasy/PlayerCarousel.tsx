import React from 'react';
import { FantasyPlayer } from '../../types';
import { PlayerCarouselCard } from './PlayerCarouselCard';

interface PlayerCarouselProps {
  players: FantasyPlayer[];
}

export const PlayerCarousel: React.FC<PlayerCarouselProps> = ({ players }) => {
  return (
    <div className="flex space-x-3 overflow-x-auto pb-4 no-scrollbar scroll-smooth snap-x snap-mandatory">
      {players.map(player => (
        <PlayerCarouselCard key={player.id} player={player} />
      ))}
    </div>
  );
};
