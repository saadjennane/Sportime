import React, { useState } from 'react';
import { Match, Bet } from '../types';
import UpcomingPage from './Upcoming';
import PlayedPage from './Played';

interface MatchesPageProps {
  matches: Match[];
  bets: Bet[];
  onBet: (match: Match, prediction: 'teamA' | 'draw' | 'teamB', odds: number) => void;
}

type Tab = 'upcoming' | 'played';

const MatchesPage: React.FC<MatchesPageProps> = ({ matches, bets, onBet }) => {
  const [activeTab, setActiveTab] = useState<Tab>('upcoming');

  const upcomingMatches = matches.filter(m => m.status === 'upcoming');
  const playedMatches = matches.filter(m => m.status === 'played');

  return (
    <div className="space-y-4">
      <div className="flex bg-gray-200 rounded-xl p-1">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`flex-1 p-2 rounded-lg font-semibold transition-all ${activeTab === 'upcoming' ? 'bg-white shadow text-purple-700' : 'text-gray-600'}`}
        >
          Upcoming
        </button>
        <button
          onClick={() => setActiveTab('played')}
          className={`flex-1 p-2 rounded-lg font-semibold transition-all ${activeTab === 'played' ? 'bg-white shadow text-purple-700' : 'text-gray-600'}`}
        >
          Played
        </button>
      </div>

      {activeTab === 'upcoming' ? (
        <UpcomingPage matches={upcomingMatches} bets={bets} onBet={onBet} />
      ) : (
        <PlayedPage matches={playedMatches} bets={bets} />
      )}
    </div>
  );
};

export default MatchesPage;
