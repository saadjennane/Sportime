import React, { useState, useMemo } from 'react';
import { Match, Bet, MatchStats } from '../types';
import UpcomingPage from './Upcoming';
import PlayedPage from './Played';
import { DailySummaryHeader } from '../components/matches/DailySummaryHeader';
import { format } from 'date-fns';
import { Settings } from 'lucide-react';
import { useLeagueOrder } from '../hooks/useLeagueOrder';
import { LeagueOrderModal } from '../components/matches/LeagueOrderModal';
import { MatchStatsDrawer } from '../components/matches/stats/MatchStatsDrawer';

type Tab = 'upcoming' | 'played';

interface MatchesPageProps {
  matches: Match[];
  bets: Bet[];
  onBet: (match: Match, prediction: 'teamA' | 'draw' | 'teamB', odds: number) => void;
  onPlayGame: (matchId: string, matchName: string) => void;
}

const MatchesPage: React.FC<MatchesPageProps> = ({ matches, bets, onBet, onPlayGame }) => {
  const [activeTab, setActiveTab] = useState<Tab>('upcoming');
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [selectedMatchForStats, setSelectedMatchForStats] = useState<Match | null>(null);
  
  const { orderedLeagues, allLeagues, setOrderedLeagues } = useLeagueOrder(matches);

  const upcomingMatches = matches.filter(m => m.status === 'upcoming');
  const playedMatches = matches.filter(m => m.status === 'played');

  const groupedUpcoming = useMemo(() => {
    return upcomingMatches.reduce((acc, match) => {
      const league = match.leagueName || 'Other';
      if (!acc[league]) acc[league] = [];
      acc[league].push(match);
      return acc;
    }, {} as Record<string, Match[]>);
  }, [upcomingMatches]);

  const groupedPlayed = useMemo(() => {
    return playedMatches.reduce((acc, match) => {
      const league = match.leagueName || 'Other';
      if (!acc[league]) acc[league] = [];
      acc[league].push(match);
      return acc;
    }, {} as Record<string, Match[]>);
  }, [playedMatches]);
  
  const uniqueLeaguesWithLogos = useMemo(() => {
    const leagueMap = new Map<string, string>();
    matches.forEach(match => {
      if (!leagueMap.has(match.leagueName)) {
        leagueMap.set(match.leagueName, match.leagueLogo);
      }
    });
    return Array.from(leagueMap.entries()).map(([name, logo]) => ({ name, logo }));
  }, [matches]);

  const headerData = useMemo(() => {
    const picksCount = bets.filter(bet => upcomingMatches.some(m => m.id === bet.matchId)).length;
    const potentialWinnings = bets.reduce((total, bet) => {
      const match = upcomingMatches.find(m => m.id === bet.matchId);
      if (match) {
        return total + (bet.amount * bet.odds);
      }
      return total;
    }, 0);

    return {
      picksCount,
      totalMatches: upcomingMatches.length,
      potentialWinnings
    };
  }, [bets, upcomingMatches]);

  return (
    <div className="space-y-4">
      <DailySummaryHeader
        date={format(new Date(), 'EEEE, MMM d, yyyy')}
        picksCount={headerData.picksCount}
        totalMatches={headerData.totalMatches}
        potentialWinnings={headerData.potentialWinnings}
      />
      
      <div className="flex items-center gap-2">
        <div className="flex-1 flex bg-navy-accent rounded-xl p-1">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`flex-1 p-2 rounded-lg font-semibold transition-all text-sm ${activeTab === 'upcoming' ? 'bg-electric-blue text-white shadow' : 'text-text-secondary'}`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setActiveTab('played')}
            className={`flex-1 p-2 rounded-lg font-semibold transition-all text-sm ${activeTab === 'played' ? 'bg-electric-blue text-white shadow' : 'text-text-secondary'}`}
          >
            Played
          </button>
        </div>
        <button onClick={() => setIsOrderModalOpen(true)} className="p-3 bg-navy-accent rounded-xl text-text-secondary hover:text-electric-blue">
          <Settings size={20} />
        </button>
      </div>

      {activeTab === 'upcoming' ? (
        <UpcomingPage
          groupedMatches={groupedUpcoming}
          orderedLeagues={orderedLeagues}
          bets={bets}
          onBet={onBet}
          onViewStats={setSelectedMatchForStats}
          onPlayGame={onPlayGame}
        />
      ) : (
        <PlayedPage 
          groupedMatches={groupedPlayed}
          orderedLeagues={orderedLeagues}
          bets={bets}
          onViewStats={setSelectedMatchForStats}
        />
      )}

      <LeagueOrderModal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        leagues={uniqueLeaguesWithLogos}
        onSave={setOrderedLeagues}
      />

      <MatchStatsDrawer
        match={selectedMatchForStats}
        onClose={() => setSelectedMatchForStats(null)}
      />
    </div>
  );
};

export default MatchesPage;
