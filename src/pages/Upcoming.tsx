import React from "react";
import { Match, Bet } from "../types";
import { MatchCard } from "../components/MatchCard";

interface UpcomingPageProps {
  matches: Match[];
  bets: Bet[];
  onBet: (
    match: Match,
    prediction: "teamA" | "draw" | "teamB",
    odds: number,
  ) => void;
}

const UpcomingPage: React.FC<UpcomingPageProps> = ({
  matches,
  bets,
  onBet,
}) => {
  return (
    <div className="space-y-4">
      {matches.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="text-6xl mb-4">📅</div>
          <p className="text-gray-600 font-medium">
            No upcoming matches at the moment.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Check the Admin page to add a new match!
          </p>
        </div>
      ) : (
        matches.map((match) => (
          <MatchCard
            key={match.id}
            match={match}
            onBet={(prediction, odds) => onBet(match, prediction, odds)}
            userBet={bets.find((bet) => bet.matchId === match.id)}
          />
        ))
      )}
    </div>
  );
};

export default UpcomingPage;
