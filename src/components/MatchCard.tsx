import React from 'react';
import { Match, Bet } from '../types';
import { Clock, TrendingUp, CheckCircle2, XCircle, BarChart2 } from 'lucide-react';

interface MatchCardProps {
  match: Match;
  onBet?: (prediction: 'teamA' | 'draw' | 'teamB', odds: number) => void;
  onViewStats?: () => void;
  userBet?: Bet;
}

export const MatchCard: React.FC<MatchCardProps> = ({ match, onBet, onViewStats, userBet }) => {
  const isUpcoming = match.status === 'upcoming';
  const betPlaced = !!userBet;

  const getResultStyling = (prediction: 'teamA' | 'draw' | 'teamB') => {
    if (isUpcoming) {
      return betPlaced && userBet.prediction === prediction
        ? 'border-electric-blue bg-electric-blue/10'
        : 'border-disabled bg-deep-navy hover:border-electric-blue hover:shadow-lg hover:scale-105';
    } else {
      // Played match styling
      const isCorrectPrediction = match.result === prediction;
      if (betPlaced && userBet.prediction === prediction) {
        return isCorrectPrediction ? 'border-lime-glow bg-lime-glow/10' : 'border-hot-red bg-hot-red/10';
      }
      if (isCorrectPrediction) {
        return 'border-lime-glow/50 bg-lime-glow/5'; // Highlight the winning outcome
      }
      return 'border-disabled bg-navy-accent cursor-not-allowed';
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
          <div className="text-xs text-text-secondary mb-1 font-medium">{label}</div>
          <div className={`text-xl font-bold ${
            won ? 'text-lime-glow' : lost ? 'text-hot-red' : 'text-text-primary'
          }`}>
            {odds.toFixed(2)}x
          </div>
          {won && (
            <div className="text-xs text-lime-glow font-semibold mt-1 flex items-center justify-center gap-1">
              <CheckCircle2 size={14} /> +{userBet.winAmount?.toFixed(0)}
            </div>
          )}
          {lost && (
            <div className="text-xs text-hot-red font-semibold mt-1 flex items-center justify-center gap-1">
              <XCircle size={14} /> -{userBet.amount}
            </div>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className={`card-base p-5 transition-all duration-300 ${isUpcoming ? 'hover:border-neon-cyan/50' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-text-secondary">
          <Clock className="w-4 h-4" />
          <span className="text-sm font-medium">{match.kickoffTime}</span>
        </div>
        {isUpcoming ? (
          <span className={`text-white text-xs px-3 py-1 rounded-full font-semibold ${betPlaced ? 'bg-gradient-to-r from-electric-blue to-neon-cyan' : 'bg-gradient-to-r from-lime-glow/80 to-lime-glow/50'}`}>
            {betPlaced ? 'Bet Placed' : 'Live'}
          </span>
        ) : (
          <span className="bg-disabled text-text-disabled text-xs px-3 py-1 rounded-full font-semibold">
            Finished
          </span>
        )}
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex-1 text-center">
          <div className="text-4xl mb-2">{match.teamA.emoji}</div>
          <div className="text-sm font-semibold text-text-primary">{match.teamA.name}</div>
        </div>
        
        <div className="px-4 text-center">
          {isUpcoming ? (
            <div className="text-2xl font-bold text-disabled">VS</div>
          ) : (
            <div className="text-2xl font-bold text-text-primary">
              {match.score?.teamA} - {match.score?.teamB}
            </div>
          )}
        </div>

        <div className="flex-1 text-center">
          <div className="text-4xl mb-2">{match.teamB.emoji}</div>
          <div className="text-sm font-semibold text-text-primary">{match.teamB.name}</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-electric-blue" />
            <span className="text-xs font-semibold text-text-secondary uppercase">
              {isUpcoming ? 'Place Your Bet' : 'Final Odds'}
            </span>
          </div>
          {onViewStats && (
            <button onClick={onViewStats} className="relative flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-electric-blue">
              <BarChart2 size={16} />
              Stats
              {match.hasLineup && (
                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime-glow opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-lime-glow"></span>
                </span>
              )}
            </button>
          )}
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
