import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Match, Bet } from '../types';
import { MatchCard } from '../components/matches/MatchCard';
import { LeagueMatchGroup } from '../components/matches/LeagueMatchGroup';

interface UpcomingPageProps {
  groupedMatches: Record<string, Match[]>;
  orderedLeagues: string[];
  bets: Bet[];
  onBet: (match: Match, prediction: 'teamA' | 'draw' | 'teamB', odds: number) => void;
  onViewStats: (match: Match) => void;
  onPlayGame: (matchId: string, matchName: string) => void;
}

const UpcomingPage: React.FC<UpcomingPageProps> = ({ groupedMatches, orderedLeagues, bets, onBet, onViewStats, onPlayGame }) => {
  const hasMatches = Object.keys(groupedMatches).length > 0;

  return (
    <div className="space-y-4">
      {!hasMatches ? (
        <div className="card-base p-8 text-center">
          <div className="text-6xl mb-4">📅</div>
          <p className="text-text-secondary font-medium">No upcoming matches at the moment.</p>
          <p className="text-sm text-text-disabled mt-2">Check back soon — new fixtures land here every day.</p>
        </div>
      ) : (
        orderedLeagues.map((leagueName) => {
          const matchesForLeague = groupedMatches[leagueName] || [];
          if (matchesForLeague.length === 0) return null;

          return (
            <LeagueMatchGroup
              key={leagueName}
              leagueName={leagueName}
              leagueLogo={matchesForLeague[0].leagueLogo}
              matchesCount={matchesForLeague.length}
              initialOpen
            >
              <AnimatePresence initial={false}>
                {matchesForLeague.map(match => (
                  <motion.div
                    key={match.id}
                    layout
                    exit={{ opacity: 0, x: 80, height: 0, marginBottom: 0 }}
                    transition={{ duration: 0.28, ease: 'easeInOut' }}
                  >
                    <MatchCard
                      match={match}
                      onBet={(prediction, odds) => onBet(match, prediction, odds)}
                      onViewStats={() => onViewStats(match)}
                      onPlayGame={onPlayGame}
                      userBet={bets.find(bet => bet.matchId === match.id)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </LeagueMatchGroup>
          );
        })
      )}
    </div>
  );
};

export default UpcomingPage;
