import React, { useMemo, useState } from 'react';
import { SwipePredictionOutcome, Profile, UserLeague, LeagueMember, LeagueGame, Game } from '../types';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Trophy,
  Clock,
  ChevronDown,
  ScrollText,
  Layers,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { MatchDaySwitcher } from '../components/fantasy/MatchDaySwitcher';
import { SwipeRulesModal } from '../components/SwipeRulesModal';
import { LinkGameButton } from '../components/leagues/LinkGameButton';
import { useSwipeGame } from '../features/swipe/useSwipeGame';
import { useSwipePredictions } from '../features/swipe/useSwipePredictions';
import { mapPredictionToOutcome, mapOutcomeToPrediction } from '../features/swipe/swipeMappers';

interface SwipeRecapPageProps {
  challengeId: string;
  selectedMatchdayId?: string;
  userId: string | null;
  onBack: () => void;
  onViewLeaderboard: (challengeId: string) => void;
  onSelectMatchday: (matchdayId: string) => void;
  onEditPicks?: () => void;
  onLinkGame: (game: Game) => void;
  profile: Profile;
  userLeagues: UserLeague[];
  leagueMembers: LeagueMember[];
  leagueGames: LeagueGame[];
}

export const SwipeRecapPage: React.FC<SwipeRecapPageProps> = (props) => {
  const {
    challengeId,
    selectedMatchdayId,
    userId,
    onBack,
    onViewLeaderboard,
    onSelectMatchday,
    onEditPicks,
    onLinkGame,
    profile,
    userLeagues,
    leagueMembers,
    leagueGames,
  } = props;

  const [isPicksVisible, setIsPicksVisible] = useState(true);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);

  // Load game data
  const { challenge, matchdays, currentMatchday, matches, isLoading: isLoadingGame } = useSwipeGame(
    challengeId,
    userId,
    selectedMatchdayId
  );

  // Load predictions
  const {
    predictions,
    predictionRecords,
    savePrediction,
    isLoading: isLoadingPredictions,
    isSaving,
  } = useSwipePredictions(challengeId, currentMatchday?.id || null, userId);

  if (isLoadingGame || isLoadingPredictions) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="animate-spin text-electric-blue" size={48} />
      </div>
    );
  }

  if (!challenge || !currentMatchday) {
    return (
      <div className="space-y-4 text-center p-8">
        <p className="font-semibold text-text-secondary">Game not found.</p>
        <button onClick={onBack} className="text-electric-blue font-semibold hover:underline">
          Return to Games
        </button>
      </div>
    );
  }

  const isEditable = currentMatchday.status === 'upcoming';

  const { totalPoints, potentialPoints } = useMemo(() => {
    let calculatedPotentialPoints = 0;
    let calculatedFinalPoints = 0;

    predictionRecords.forEach(pred => {
      const match = matches.find(m => m.id === pred.fixture_id);
      if (!match) return;

      const selectedOdds = pred.odds_at_prediction[pred.prediction];
      calculatedPotentialPoints += selectedOdds * 100;

      if (pred.is_correct === true) {
        calculatedFinalPoints += pred.points_earned;
      }
    });

    return {
      totalPoints: Math.round(calculatedFinalPoints),
      potentialPoints: Math.round(calculatedPotentialPoints),
    };
  }, [predictionRecords, matches]);

  const deadline = useMemo(() => {
    if (!currentMatchday.deadline) return null;
    return format(new Date(currentMatchday.deadline), "MMM d, yyyy 'at' h:mm a");
  }, [currentMatchday]);

  const matchDaysForSwitcher = useMemo(() => {
    return matchdays.map(md => ({
      id: md.id,
      name: format(new Date(md.date), 'MMM d, yyyy'),
      startDate: md.date,
      endDate: md.date,
      leagues: [],
      status: md.status === 'upcoming' ? 'Upcoming' : md.status === 'active' ? 'Ongoing' : 'Finished',
    }));
  }, [matchdays]);

  const formatNumberShort = (num: number) => {
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toString();
  };

  const handleUpdatePrediction = async (
    matchId: string,
    prediction: SwipePredictionOutcome
  ) => {
    if (!isEditable) return;

    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    try {
      await savePrediction(matchId, prediction, match.odds);
    } catch (err) {
      console.error('Error updating prediction:', err);
    }
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-text-secondary font-semibold hover:text-electric-blue"
        >
          <ArrowLeft size={20} /> Back
        </button>
        <div className="flex items-center gap-2">
          <LinkGameButton
            game={challenge as any}
            userId={profile.id}
            userLeagues={userLeagues}
            leagueMembers={leagueMembers}
            leagueGames={leagueGames}
            onLink={onLinkGame}
            loading={false}
          />
          <button
            onClick={() => setIsRulesModalOpen(true)}
            className="p-2 bg-navy-accent rounded-lg shadow-sm text-text-secondary hover:text-electric-blue"
          >
            <ScrollText size={20} />
          </button>
          <button
            onClick={() => onViewLeaderboard(challengeId)}
            className="flex items-center gap-1.5 p-2 bg-navy-accent rounded-lg shadow-sm text-text-secondary hover:text-electric-blue"
          >
            <Trophy size={20} />
          </button>
        </div>
      </header>

      <div className="-mx-4">
        <MatchDaySwitcher
          gameWeeks={matchDaysForSwitcher}
          selectedGameWeekId={currentMatchday.id}
          onSelect={onSelectMatchday}
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
            <button
              onClick={() => setIsPicksVisible(!isPicksVisible)}
              className="flex items-center gap-2"
            >
              <h3 className="text-lg font-bold text-text-primary">{challenge.name}</h3>
              <ChevronDown
                className={`w-5 h-5 text-text-secondary transition-transform duration-300 ${
                  isPicksVisible ? 'rotate-180' : ''
                }`}
              />
            </button>
            {onEditPicks && isEditable && (
              <button
                onClick={onEditPicks}
                className="flex items-center gap-1.5 text-xs font-bold text-electric-blue bg-electric-blue/20 px-3 py-1.5 rounded-lg hover:bg-electric-blue/30 transition-colors"
              >
                <Layers size={14} />
                <span>Swipe</span>
              </button>
            )}
          </div>
          {isEditable ? (
            <div className="text-center mt-3">
              <p className="text-xs font-semibold text-text-secondary flex items-center justify-center gap-1">
                Potential Points
              </p>
              <p className="text-2xl font-bold text-electric-blue">{potentialPoints.toFixed(0)}</p>
            </div>
          ) : (
            <div className="text-center mt-3">
              <p className="text-xs font-semibold text-text-secondary flex items-center justify-center gap-1">
                Final Points
              </p>
              <p className="text-2xl font-bold text-lime-glow">{totalPoints.toFixed(0)}</p>
            </div>
          )}
        </div>

        {isPicksVisible && (
          <div className="space-y-3 border-t border-white/10 pt-4 animate-scale-in">
            {isSaving && (
              <div className="flex items-center justify-center py-2">
                <Loader2 className="animate-spin text-electric-blue" size={24} />
              </div>
            )}

            {matches.map(match => {
              const predictionRecord = predictionRecords.find(p => p.fixture_id === match.id);
              const prediction = predictionRecord
                ? mapPredictionToOutcome(predictionRecord.prediction)
                : undefined;

              const isCorrect = predictionRecord?.is_correct === true;
              const points = predictionRecord?.points_earned || 0;

              const getButtonClass = (outcome: SwipePredictionOutcome) => {
                const isSelected = prediction === outcome;
                if (!isEditable) {
                  // Results view
                  if (isSelected) {
                    return isCorrect ? 'bg-lime-glow text-deep-navy' : 'bg-hot-red text-white';
                  }
                  if (match.result === outcome) {
                    return 'bg-lime-glow/20 text-lime-glow';
                  }
                  return 'bg-disabled text-text-disabled';
                }
                // Editable view
                return isSelected
                  ? 'bg-gradient-to-r from-electric-blue to-neon-cyan text-white'
                  : 'bg-deep-navy text-text-secondary hover:bg-navy-accent';
              };

              const PredictionButton: React.FC<{
                outcome: SwipePredictionOutcome;
                label: string;
                odds: number;
              }> = ({ outcome, label, odds }) => (
                <button
                  disabled={!isEditable || isSaving}
                  onClick={() => handleUpdatePrediction(match.id, outcome)}
                  className={`p-2 rounded-lg text-sm font-semibold transition-colors flex flex-col items-center justify-center ${getButtonClass(
                    outcome
                  )}`}
                >
                  <span>{label}</span>
                  {isEditable && <span className="text-xs opacity-70">@{odds.toFixed(2)}</span>}
                </button>
              );

              return (
                <div key={match.id} className="bg-deep-navy rounded-xl p-3 space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <p className="font-bold text-text-primary">
                      {match.teamA.name} vs {match.teamB.name}
                    </p>
                    {!isEditable && predictionRecord && (
                      <div
                        className={`flex items-center gap-1 font-bold ${
                          isCorrect ? 'text-lime-glow' : 'text-hot-red'
                        }`}
                      >
                        {isCorrect ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                        <span>{isCorrect ? `+${points.toFixed(0)} pts` : '0 pts'}</span>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <PredictionButton
                      outcome="teamA"
                      label={match.teamA.name.split(' ')[0]}
                      odds={match.odds.teamA}
                    />
                    <PredictionButton outcome="draw" label="Draw" odds={match.odds.draw} />
                    <PredictionButton
                      outcome="teamB"
                      label={match.teamB.name.split(' ')[0]}
                      odds={match.odds.teamB}
                    />
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
