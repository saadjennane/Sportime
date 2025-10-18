import React from 'react';
import { Match, Bet } from '../types';
import { MatchCard } from '../components/MatchCard';
import { LeagueMatchGroup } from '../components/matches/LeagueMatchGroup';

interface PlayedPageProps {
  groupedMatches: Record<string, Match[]>;
  orderedLeagues: string[];
  bets: Bet[];
}

const PlayedPage: React.FC<PlayedPageProps> = ({ groupedMatches, orderedLeagues, bets }) => {
  const hasMatches = Object.keys(groupedMatches).length > 0;

  return (
    <div className="space-y-4">
      {!hasMatches ? (
        <div className="card-base p-8 text-center">
          <div className="text-6xl mb-4">🏆</div>
          <p className="text-text-secondary font-medium">No played matches yet.</p>
          <p className="text-sm text-text-disabled mt-2">Resolve a match in the Admin page to see it here.</p>
        </div>
      ) : (
        orderedLeagues.map((leagueName, index) => {
          const matchesForLeague = groupedMatches[leagueName] || [];
          if (matchesForLeague.length === 0) return null;

          return (
            <LeagueMatchGroup
              key={leagueName}
              leagueName={leagueName}
              leagueLogo={matchesForLeague[0].leagueLogo}
              matchesCount={matchesForLeague.length}
              initialOpen={index < 5}
            >
              {[...matchesForLeague].reverse().map(match => (
                <MatchCard
                  key={match.id}
                  match={match}
                  userBet={bets.find(bet => bet.matchId === match.id)}
                />
              ))}
            </LeagueMatchGroup>
          );
        })
      )}
    </div>
  );
};

export default PlayedPage;
