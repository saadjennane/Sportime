import React from 'react';
import { Match, Bet } from '../types';
import { Clock, TrendingUp, CheckCircle2, XCircle } from 'lucide-react';

interface MatchCardProps {
  match: Match;
  onBet?: (prediction: 'teamA' | 'draw' | 'teamB', odds: number) => void;
  userBet?: Bet;
}

export const MatchCard: React.FC<MatchCardProps> = ({ match, onBet, userBet }) => {
  const isUpcoming = match.status === 'upcoming';
  const betPlaced = !!userBet;

  const getResultStyling = (prediction: 'teamA' | 'draw' | 'teamB') => {
    if (isUpcoming) {
      return betPlaced && userBet.prediction === prediction
        ? 'border-purple-500 bg-purple-50'
        : 'border-gray-200 bg-white hover:border-purple-500 hover:shadow-lg hover:scale-105';
    } else {
      // Played match styling
      const isCorrectPrediction = match.result === prediction;
      if (betPlaced && userBet.prediction === prediction) {
        return isCorrectPrediction ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50';
      }
      if (isCorrectPrediction) {
        return 'border-green-400 bg-green-50'; // Highlight the winning outcome
      }
      return 'border-gray-200 bg-gray-50 cursor-not-allowed';
    }
  };

  const BetButton: React.FC<{ 
    prediction: 'teamA' | 'draw' | 'teamB'; 
    odds: number; 
    label: string;
  }> = ({ prediction, odds, label }) => {
    const isSelected = userBet?.prediction === prediction;
    const won = userBet?.status === 'won' && isSelected;
    const lost = userBet?.status === 'lost' && isSelected;

    return (
      <button
        onClick={() => isUpcoming && onBet && onBet(prediction, odds)}
        disabled={!isUpcoming}
        className={`flex-1 p-3 rounded-xl border-2 transition-all duration-300 ${getResultStyling(prediction)} ${!isUpcoming ? 'cursor-not-allowed' : ''}`}
      >
        <div className="text-center">
          <div className="text-xs text-gray-500 mb-1 font-medium">{label}</div>
          <div className={`text-xl font-bold ${
            won ? 'text-green-600' : lost ? 'text-red-600' : 'text-gray-800'
          }`}>
            {odds.toFixed(2)}x
          </div>
          {won && (
            <div className="text-xs text-green-600 font-semibold mt-1 flex items-center justify-center gap-1">
              <CheckCircle2 size={14} /> +{userBet.winAmount?.toFixed(0)}
            </div>
          )}
          {lost && (
            <div className="text-xs text-red-600 font-semibold mt-1 flex items-center justify-center gap-1">
              <XCircle size={14} /> -{userBet.amount}
            </div>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className={`bg-white rounded-2xl shadow-lg p-5 transition-all duration-300 ${isUpcoming ? 'hover:shadow-xl' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-gray-600">
          <Clock className="w-4 h-4" />
          <span className="text-sm font-medium">{match.kickoffTime}</span>
        </div>
        {isUpcoming ? (
          <span className={`text-white text-xs px-3 py-1 rounded-full font-semibold ${betPlaced ? 'bg-gradient-to-r from-purple-500 to-indigo-500' : 'bg-gradient-to-r from-green-400 to-emerald-500'}`}>
            {betPlaced ? 'Bet Placed' : 'Live'}
          </span>
        ) : (
          <span className="bg-gradient-to-r from-gray-400 to-gray-500 text-white text-xs px-3 py-1 rounded-full font-semibold">
            Finished
          </span>
        )}
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex-1 text-center">
          <div className="text-4xl mb-2">{match.teamA.emoji}</div>
          <div className="text-sm font-semibold text-gray-800">{match.teamA.name}</div>
        </div>
        
        <div className="px-4 text-center">
          {isUpcoming ? (
            <div className="text-2xl font-bold text-gray-400">VS</div>
          ) : (
            <div className="text-2xl font-bold text-gray-800">
              {match.score?.teamA} - {match.score?.teamB}
            </div>
          )}
        </div>

        <div className="flex-1 text-center">
          <div className="text-4xl mb-2">{match.teamB.emoji}</div>
          <div className="text-sm font-semibold text-gray-800">{match.teamB.name}</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-4 h-4 text-purple-600" />
          <span className="text-xs font-semibold text-gray-600 uppercase">
            {isUpcoming ? 'Place Your Bet' : 'Final Odds'}
          </span>
        </div>
        <div className="flex gap-2">
          <BetButton prediction="teamA" odds={match.odds.teamA} label={match.teamA.name.split(' ')[0]} />
          <BetButton prediction="draw" odds={match.odds.draw} label="Draw" />
          <BetButton prediction="teamB" odds={match.odds.teamB} label={match.teamB.name.split(' ')[0]} />
        </div>
      </div>
    </div>
  );
};
