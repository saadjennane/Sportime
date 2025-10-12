import React, { useMemo, useState } from 'react';
import { SwipeMatchDay, UserSwipeEntry, SwipePredictionOutcome, Profile, UserLeague, LeagueMember, LeagueGame, Game } from '../types';
import { ArrowLeft, CheckCircle2, XCircle, Trophy, Clock, ChevronDown, List, ScrollText, Layers } from 'lucide-react';
import { format } from 'date-fns';
import { MatchDaySwitcher } from '../components/fantasy/MatchDaySwitcher';
import { SwipeRulesModal } from '../components/SwipeRulesModal';
import { LinkGameButton } from '../components/leagues/LinkGameButton';

interface SwipeRecapPageProps {
  allMatchDays: SwipeMatchDay[];
  selectedMatchDayId: string;
  userEntry: UserSwipeEntry;
  onBack: () => void;
  onUpdatePrediction?: (matchDayId: string, matchId: string, prediction: SwipePredictionOutcome) => void;
  onViewLeaderboard: (matchDayId: string) => void;
  onSelectMatchDay: (matchDayId: string) => void;
  onEditPicks?: () => void;
  onLinkGame: (game: Game) => void;
  profile: Profile;
  userLeagues: UserLeague[];
  leagueMembers: LeagueMember[];
  leagueGames: LeagueGame[];
}

export const SwipeRecapPage: React.FC<SwipeRecapPageProps> = (props) => {
  const { allMatchDays, selectedMatchDayId, userEntry, onBack, onUpdatePrediction, onViewLeaderboard, onSelectMatchDay, onEditPicks, onLinkGame, profile, userLeagues, leagueMembers, leagueGames } = props;
  const [isPicksVisible, setIsPicksVisible] = useState(true);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);

  const selectedMatchDay = useMemo(() => allMatchDays.find(md => md.id === selectedMatchDayId), [allMatchDays, selectedMatchDayId]);
  
  if (!selectedMatchDay) {
    return (
      <div className="space-y-4 text-center p-8">
        <p className="font-semibold text-text-secondary">Match day not found.</p>
        <button onClick={onBack} className="text-electric-blue font-semibold hover:underline">
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
        <button onClick={onBack} className="flex items-center gap-2 text-text-secondary font-semibold hover:text-electric-blue">
          <ArrowLeft size={20} /> Back
        </button>
        <div className="flex items-center gap-2">
          <LinkGameButton
            game={selectedMatchDay}
            userId={profile.id}
            userLeagues={userLeagues}
            leagueMembers={leagueMembers}
            leagueGames={leagueGames}
            onLink={onLinkGame}
            loading={false}
          />
          <button onClick={() => setIsRulesModalOpen(true)} className="p-2 bg-navy-accent rounded-lg shadow-sm text-text-secondary hover:text-electric-blue">
            <ScrollText size={20} />
          </button>
          <button onClick={() => onViewLeaderboard(selectedMatchDay.id)} className="flex items-center gap-1.5 p-2 bg-navy-accent rounded-lg shadow-sm text-text-secondary hover:text-electric-blue">
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
        <div className="bg-warm-yellow/10 border border-warm-yellow/20 text-warm-yellow p-3 rounded-xl flex items-center justify-center gap-3">
          <Clock size={20} />
          <p className="text-sm font-semibold text-center">
            You can edit your picks until <span className="font-bold">{deadline}</span>
          </p>
        </div>
      )}
      
      <div className="card-base p-4">
        <div className="mb-4">
            <div className="flex justify-between items-center text-left">
                <button onClick={() => setIsPicksVisible(!isPicksVisible)} className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-text-primary">{selectedMatchDay.name}</h3>
                    <ChevronDown
                        className={`w-5 h-5 text-text-secondary transition-transform duration-300 ${
                        isPicksVisible ? 'rotate-180' : ''
                        }`}
                    />
                </button>
                {onEditPicks && isEditable && (
                  <button onClick={onEditPicks} className="flex items-center gap-1.5 text-xs font-bold text-electric-blue bg-electric-blue/20 px-3 py-1.5 rounded-lg hover:bg-electric-blue/30 transition-colors">
                    <Layers size={14} />
                    <span>Swipe</span>
                  </button>
                )}
            </div>
            {isEditable ? (
              <div className="text-center mt-3">
                <p className="text-xs font-semibold text-text-secondary flex items-center justify-center gap-1">Potential Points</p>
                <p className="text-2xl font-bold text-electric-blue">{potentialPoints.toFixed(0)}</p>
              </div>
            ) : (
              <div className="text-center mt-3">
                <p className="text-xs font-semibold text-text-secondary flex items-center justify-center gap-1">Final Points</p>
                <p className="text-2xl font-bold text-lime-glow">{totalPoints.toFixed(0)}</p>
              </div>
            )}
        </div>

        {isPicksVisible && (
          <div className="space-y-3 border-t border-white/10 pt-4 animate-scale-in">
            {selectedMatchDay.matches.map(match => {
              const prediction = userEntry.predictions.find(p => p.matchId === match.id);
              
              const isCorrect = match.result && prediction && match.result === prediction.prediction;
              const points = isCorrect && prediction ? match.odds[prediction.prediction] * 100 : 0;

              const getButtonClass = (outcome: SwipePredictionOutcome) => {
                const isSelected = prediction?.prediction === outcome;
                if (!isEditable) { // Results view
                  if (isSelected) {
                    return isCorrect ? 'bg-lime-glow text-deep-navy' : 'bg-hot-red text-white';
                  }
                  if (match.result === outcome) {
                    return 'bg-lime-glow/20 text-lime-glow';
                  }
                  return 'bg-disabled text-text-disabled';
                }
                // Editable view
                return isSelected ? 'bg-gradient-to-r from-electric-blue to-neon-cyan text-white' : 'bg-deep-navy text-text-secondary hover:bg-navy-accent';
              };

              const PredictionButton: React.FC<{outcome: SwipePredictionOutcome, label: string, odds: number}> = ({outcome, label, odds}) => (
                 <button 
                    disabled={!isEditable} 
                    onClick={() => onUpdatePrediction?.(selectedMatchDay.id, match.id, outcome)} 
                    className={`p-2 rounded-lg text-sm font-semibold transition-colors flex flex-col items-center justify-center ${getButtonClass(outcome)}`}
                  >
                    <span>{label}</span>
                    {isEditable && <span className="text-xs opacity-70">@{odds.toFixed(2)}</span>}
                  </button>
              );

              return (
                <div key={match.id} className="bg-deep-navy rounded-xl p-3 space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <p className="font-bold text-text-primary">{match.teamA.name} vs {match.teamB.name}</p>
                    {!isEditable && prediction && (
                      <div className={`flex items-center gap-1 font-bold ${isCorrect ? 'text-lime-glow' : 'text-hot-red'}`}>
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
