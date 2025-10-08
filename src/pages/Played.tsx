import React from 'react';
import { Match, Bet } from '../types';
import { MatchCard } from '../components/MatchCard';

interface PlayedPageProps {
  matches: Match[];
  bets: Bet[];
}

const PlayedPage: React.FC<PlayedPageProps> = ({ matches, bets }) => {
  return (
    <div className="space-y-4">
      {matches.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="text-6xl mb-4">🏆</div>
          <p className="text-gray-600 font-medium">No played matches yet.</p>
          <p className="text-sm text-gray-500 mt-2">Resolve a match in the Admin page to see it here.</p>
        </div>
      ) : (
        [...matches].reverse().map(match => (
          <MatchCard
            key={match.id}
            match={match}
            userBet={bets.find(bet => bet.matchId === match.id)}
          />
        ))
      )}
    </div>
  );
};

export default PlayedPage;
