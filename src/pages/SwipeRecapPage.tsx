import React, { useMemo, useState } from 'react';
import { SwipeMatchDay, UserSwipeEntry, SwipePredictionOutcome } from '../types';
import { ArrowLeft, CheckCircle2, XCircle, Trophy, Clock, ChevronDown, List, Layers, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

interface SwipeRecapPageProps {
  matchDay: SwipeMatchDay;
  userEntry: UserSwipeEntry;
  onBack: () => void;
  onUpdatePrediction?: (matchId: string, prediction: SwipePredictionOutcome) => void;
  onViewLeaderboard: (matchDayId: string) => void;
  onToggleView: () => void;
}

export const SwipeRecapPage: React.FC<SwipeRecapPageProps> = ({ matchDay, userEntry, onBack, onUpdatePrediction, onViewLeaderboard, onToggleView }) => {
  const [isPicksVisible, setIsPicksVisible] = useState(true);
  const isEditable = matchDay.status === 'Upcoming';
  
  const { totalPoints, potentialPoints, rank, totalPlayers } = useMemo(() => {
    let calculatedPotentialPoints = 0;
    let calculatedFinalPoints = 0;

    userEntry.predictions.forEach(p => {
      const match = matchDay.matches.find(m => m.id === p.matchId);
      if (match) {
        const selectedOdds = match.odds[p.prediction];
        calculatedPotentialPoints += selectedOdds * 100;
        if (match.result && match.result === p.prediction) {
          calculatedFinalPoints += selectedOdds * 100;
        }
      }
    });

    // Mock rank for display
    return { 
      totalPoints: Math.round(calculatedFinalPoints),
      potentialPoints: Math.round(calculatedPotentialPoints),
      rank: Math.floor(Math.random() * 500) + 1, 
      totalPlayers: matchDay.totalPlayers 
    };
  }, [matchDay, userEntry]);

  const deadline = useMemo(() => {
    if (!matchDay || matchDay.matches.length === 0) return null;
    const sortedMatches = [...matchDay.matches].sort((a, b) => a.kickoffTime.localeCompare(b.kickoffTime));
    const firstMatch = sortedMatches[0];
    const deadlineDate = new Date(`${matchDay.startDate}T${firstMatch.kickoffTime}:00`);
    return format(deadlineDate, "MMM d, yyyy 'at' h:mm a");
  }, [matchDay]);


  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-600 font-semibold hover:text-purple-600">
          <ArrowLeft size={20} /> Back to Games
        </button>
      </header>
      
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800">{matchDay.name}</h2>
        <p className="text-sm font-semibold text-purple-600">{matchDay.status}</p>
      </div>
      
      {isEditable && deadline && (
        <div className="bg-yellow-100 border border-yellow-300 text-yellow-800 p-3 rounded-xl flex items-center justify-center gap-3">
          <Clock size={20} />
          <p className="text-sm font-semibold text-center">
            You can edit your picks until <span className="font-bold">{deadline}</span>
          </p>
        </div>
      )}
      
      <div className="bg-white rounded-2xl shadow-lg p-4">
        <div className="mb-4">
            <div className="flex justify-between items-center text-left">
                <button onClick={() => setIsPicksVisible(!isPicksVisible)} className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-gray-700">Match Day 3</h3>
                    <ChevronDown
                        className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${
                        isPicksVisible ? 'rotate-180' : ''
                        }`}
                    />
                </button>
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-purple-100 text-purple-600 rounded-lg cursor-pointer">
                        <List size={20} />
                    </div>
                    <button onClick={onToggleView} className="p-2 bg-gray-200 text-gray-600 rounded-lg hover:bg-purple-100 hover:text-purple-600">
                        <Layers size={20} />
                    </button>
                </div>
            </div>
            {isEditable && (
              <div className="text-center mt-3">
                <p className="text-xs font-semibold text-gray-500 flex items-center justify-center gap-1"><TrendingUp size={14}/> Potential Points</p>
                <p className="text-2xl font-bold text-purple-600">{potentialPoints.toFixed(0)}</p>
              </div>
            )}
        </div>

        {isPicksVisible && (
          <div className="space-y-3 border-t pt-4 animate-scale-in">
            {matchDay.matches.map(match => {
              const prediction = userEntry.predictions.find(p => p.matchId === match.id);
              
              const isCorrect = match.result && prediction && match.result === prediction.prediction;
              const points = isCorrect && prediction ? match.odds[prediction.prediction] * 100 : 0;

              const getButtonClass = (outcome: SwipePredictionOutcome) => {
                const isSelected = prediction?.prediction === outcome;
                if (!isEditable) { // Results view
                  if (isSelected) {
                    return isCorrect ? 'bg-green-500 text-white' : 'bg-red-500 text-white';
                  }
                  if (match.result === outcome) {
                    return 'bg-green-200 text-green-800';
                  }
                  return 'bg-gray-200 text-gray-500';
                }
                // Editable view
                return isSelected ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-purple-200';
              };

              const PredictionButton: React.FC<{outcome: SwipePredictionOutcome, label: string, odds: number}> = ({outcome, label, odds}) => (
                 <button 
                    disabled={!isEditable} 
                    onClick={() => onUpdatePrediction?.(match.id, outcome)} 
                    className={`p-2 rounded-lg text-sm font-semibold transition-colors flex flex-col items-center justify-center ${getButtonClass(outcome)}`}
                  >
                    <span>{label}</span>
                    {isEditable && <span className="text-xs opacity-70">@{odds.toFixed(2)}</span>}
                  </button>
              );

              return (
                <div key={match.id} className="bg-gray-50 rounded-xl p-3 space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <p className="font-bold text-gray-700">{match.teamA.name} vs {match.teamB.name}</p>
                    {!isEditable && prediction && (
                      <div className={`flex items-center gap-1 font-bold ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                        {isCorrect ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                        <span>{isCorrect ? `+${points.toFixed(0)} pts` : '0 pts'}</span>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <PredictionButton outcome="teamA" label={match.teamA.name.split(' ')[0]} odds={match.odds.teamA} />
                    <PredictionButton outcome="draw" label="Draw" odds={match.odds.draw} />
                    <PredictionButton outcome="teamB" label={match.teamB.name.split(' ')[0]} odds={match.odds.teamB} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

       {!isEditable && matchDay.status === 'Finished' && (
          <div className="bg-purple-600 text-white rounded-xl shadow-lg p-4 text-center">
            <p className="text-sm font-semibold uppercase">Total Points</p>
            <p className="text-4xl font-bold">{totalPoints.toFixed(0)}</p>
          </div>
      )}

      <button
        onClick={() => onViewLeaderboard(matchDay.id)}
        className="fixed bottom-24 right-4 z-40 flex items-center gap-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-5 py-3 rounded-full shadow-2xl hover:scale-105 transition-transform"
      >
        <Trophy size={20} />
        <div className="text-left">
          <div className="text-xs font-semibold uppercase">Your Rank</div>
          <div className="text-lg font-bold leading-tight">
            #{rank.toLocaleString()} / {totalPlayers.toLocaleString()}
          </div>
        </div>
      </button>
    </div>
  );
};
