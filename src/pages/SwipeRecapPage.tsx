import React, { useMemo, useState } from 'react';
import { SwipeMatchDay, UserSwipeEntry, SwipePredictionOutcome } from '../types';
import { ArrowLeft, CheckCircle2, XCircle, Trophy, Clock, ChevronDown, List, ScrollText } from 'lucide-react';
import { format } from 'date-fns';
import { MatchDaySwitcher } from '../components/fantasy/MatchDaySwitcher';
import { SwipeRulesModal } from '../components/SwipeRulesModal';

interface SwipeRecapPageProps {
  allMatchDays: SwipeMatchDay[];
  selectedMatchDayId: string;
  userEntry: UserSwipeEntry;
  onBack: () => void;
  onUpdatePrediction?: (matchId: string, prediction: SwipePredictionOutcome) => void;
  onViewLeaderboard: (matchDayId: string) => void;
  onSelectMatchDay: (matchDayId: string) => void;
}

export const SwipeRecapPage: React.FC<SwipeRecapPageProps> = ({ allMatchDays, selectedMatchDayId, userEntry, onBack, onUpdatePrediction, onViewLeaderboard, onSelectMatchDay }) => {
  const [isPicksVisible, setIsPicksVisible] = useState(true);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);

  const selectedMatchDay = useMemo(() => allMatchDays.find(md => md.id === selectedMatchDayId), [allMatchDays, selectedMatchDayId]);
  
  if (!selectedMatchDay) {
    return (
      <div className="space-y-4 text-center p-8">
        <p className="font-semibold text-gray-700">Match day not found.</p>
        <button onClick={onBack} className="text-purple-600 font-semibold hover:underline">
          Return to Games
        </button>
      </div>
    );
  }
  
  const isEditable = selectedMatchDay.status === 'Upcoming';
  
  const { totalPoints, potentialPoints, rank, totalPlayers } = useMemo(() => {
    let calculatedPotentialPoints = 0;
    let calculatedFinalPoints = 0;

    userEntry.predictions.forEach(p => {
      const match = selectedMatchDay.matches.find(m => m.id === p.matchId);
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
      totalPlayers: selectedMatchDay.totalPlayers 
    };
  }, [selectedMatchDay, userEntry]);

  const deadline = useMemo(() => {
    if (!selectedMatchDay || selectedMatchDay.matches.length === 0) return null;
    const sortedMatches = [...selectedMatchDay.matches].sort((a, b) => a.kickoffTime.localeCompare(b.kickoffTime));
    const firstMatch = sortedMatches[0];
    const deadlineDate = new Date(`${selectedMatchDay.startDate}T${firstMatch.kickoffTime}:00`);
    return format(deadlineDate, "MMM d, yyyy 'at' h:mm a");
  }, [selectedMatchDay]);

  const matchDaysForSwitcher = useMemo(() => {
    return allMatchDays.map(md => ({
      id: md.id,
      name: md.name,
      startDate: md.startDate,
      endDate: md.endDate,
      leagues: [],
      status: md.status,
    }));
  }, [allMatchDays]);

  const formatNumberShort = (num: number) => {
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toString();
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-600 font-semibold hover:text-purple-600">
          <ArrowLeft size={20} /> Back
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsRulesModalOpen(true)} className="p-2 bg-white rounded-lg shadow-sm text-gray-600 hover:text-purple-600">
            <ScrollText size={20} />
          </button>
          <button onClick={() => onViewLeaderboard(selectedMatchDay.id)} className="flex items-center gap-1.5 p-2 bg-white rounded-lg shadow-sm text-gray-600 hover:text-purple-600">
            <Trophy size={20} />
            <span className="text-xs font-bold">{formatNumberShort(rank)}/{formatNumberShort(totalPlayers)}</span>
          </button>
        </div>
      </header>
      
      <div className="-mx-4">
        <MatchDaySwitcher
          gameWeeks={matchDaysForSwitcher}
          selectedGameWeekId={selectedMatchDayId}
          onSelect={onSelectMatchDay}
        />
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
                    <h3 className="text-lg font-bold text-gray-700">{selectedMatchDay.name}</h3>
                    <ChevronDown
                        className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${
                        isPicksVisible ? 'rotate-180' : ''
                        }`}
                    />
                </button>
            </div>
            {isEditable ? (
              <div className="text-center mt-3">
                <p className="text-xs font-semibold text-gray-500 flex items-center justify-center gap-1">Potential Points</p>
                <p className="text-2xl font-bold text-purple-600">{potentialPoints.toFixed(0)}</p>
              </div>
            ) : (
              <div className="text-center mt-3">
                <p className="text-xs font-semibold text-gray-500 flex items-center justify-center gap-1">Final Points</p>
                <p className="text-2xl font-bold text-purple-600">{totalPoints.toFixed(0)}</p>
              </div>
            )}
        </div>

        {isPicksVisible && (
          <div className="space-y-3 border-t pt-4 animate-scale-in">
            {selectedMatchDay.matches.map(match => {
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
      
      <SwipeRulesModal isOpen={isRulesModalOpen} onClose={() => setIsRulesModalOpen(false)} />
    </div>
  );
};
