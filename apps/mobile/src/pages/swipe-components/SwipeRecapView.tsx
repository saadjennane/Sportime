/**
 * SwipeRecapView - Presentational Component for Prediction Recap
 *
 * IMPORTANT: This component is wrapped in memo() to prevent re-renders.
 * NO useMemo with Map/Set - uses Record<string, T> from parent.
 */

import React, { useState, memo } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Trophy,
  Clock,
  ChevronDown,
  ScrollText,
  Layers,
} from 'lucide-react';
import { format } from 'date-fns';
import type { SwipeMatch, SwipePredictionOutcome, Profile, UserLeague, LeagueMember, LeagueGame, Game } from '../../types';
import type { ChallengeMatchday, SwipePredictionRecord } from '../../services/swipeGameService';
import { MatchDaySwitcher } from '../../components/fantasy/MatchDaySwitcher';
import { SwipeRulesModal } from '../../components/SwipeRulesModal';
import { LinkGameButton } from '../../components/leagues/LinkGameButton';
import { mapPredictionToOutcome } from '../../features/swipe/swipeMappers';

interface Challenge {
  id: string;
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  status: string;
}

interface SwipeRecapViewProps {
  challenge: Challenge | null;
  matchdays: ChallengeMatchday[];
  currentMatchday: ChallengeMatchday | null;
  matches: SwipeMatch[];
  predictions: Record<string, SwipePredictionRecord>;
  onBack: () => void;
  onEditPicks: () => void;
  onViewLeaderboard: () => void;
  onSelectMatchday: (matchdayId: string) => void;
  onUpdatePrediction: (matchId: string, prediction: SwipePredictionOutcome) => void;
  onLinkGame: (game: Game) => void;
  profile: Profile;
  userLeagues: UserLeague[];
  leagueMembers: LeagueMember[];
  leagueGames: LeagueGame[];
}

// Stable empty array to prevent re-renders
const EMPTY_LEAGUES: never[] = [];

// ============================================================================
// TEAM NAME ABBREVIATION
// ============================================================================

// Mapping pour les cas spéciaux (noms à 3+ mots ou abréviations connues)
const KNOWN_ABBREVIATIONS: Record<string, string> = {
  'Paris Saint-Germain': 'PSG',
  'Paris Saint Germain': 'PSG',
  'Borussia Monchengladbach': 'Gladbach',
  'RB Leipzig': 'Leipzig',
  'Tottenham Hotspur': 'Tottenham',
  'West Ham United': 'West Ham',
  'Wolverhampton Wanderers': 'Wolves',
  'Sheffield United': 'Sheffield U.',
  'Brighton & Hove Albion': 'Brighton',
  'Nottingham Forest': 'N. Forest',
  'Newcastle United': 'Newcastle',
  'Leicester City': 'Leicester',
  'Crystal Palace': 'C. Palace',
  'Aston Villa': 'Aston Villa',
};

function abbreviateTeamName(name: string, maxLength: number = 12): string {
  // 1. Vérifier les abréviations connues
  if (KNOWN_ABBREVIATIONS[name]) {
    return KNOWN_ABBREVIATIONS[name];
  }

  // 2. Supprimer les préfixes courants
  const prefixes = ['FC ', 'CF ', 'AC ', 'AS ', 'SC ', 'RC ', 'SL ', 'SS '];
  let cleanName = name;
  for (const prefix of prefixes) {
    if (name.startsWith(prefix)) {
      cleanName = name.slice(prefix.length);
      break;
    }
  }

  // 3. Si ça rentre, on garde le nom nettoyé
  if (cleanName.length <= maxLength) return cleanName;

  // 4. Sinon on abrège: première lettre + "." + 2ème mot
  const words = cleanName.split(' ');
  if (words.length === 1) return cleanName;
  return `${words[0][0]}. ${words[1]}`;
}

export const SwipeRecapView = memo<SwipeRecapViewProps>(function SwipeRecapView({
  challenge,
  matchdays,
  currentMatchday,
  matches,
  predictions,
  onBack,
  onEditPicks,
  onViewLeaderboard,
  onSelectMatchday,
  onUpdatePrediction,
  onLinkGame,
  profile,
  userLeagues,
  leagueMembers,
  leagueGames,
}) {
  const [isPicksVisible, setIsPicksVisible] = useState(true);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);

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

  // Calculate points - simple iteration, no useMemo needed for small arrays
  let totalPoints = 0;
  let potentialPoints = 0;
  const predictionValues = Object.values(predictions);

  for (const pred of predictionValues) {
    const match = matches.find(m => m.id === pred.fixture_id);
    if (!match) continue;

    const selectedOdds = pred.odds_at_prediction[pred.prediction];
    potentialPoints += selectedOdds * 100;

    if (pred.is_correct === true) {
      totalPoints += pred.points_earned;
    }
  }

  totalPoints = Math.round(totalPoints);
  potentialPoints = Math.round(potentialPoints);

  // Format deadline
  const deadline = currentMatchday.deadline
    ? format(new Date(currentMatchday.deadline), "MMM d, yyyy 'at' h:mm a")
    : null;

  // Convert matchdays to switcher format
  const matchDaysForSwitcher = matchdays.map(md => ({
    id: md.id,
    name: format(new Date(md.date), 'MMM d, yyyy'),
    startDate: md.date,
    endDate: md.date,
    leagues: EMPTY_LEAGUES,
    status: md.status === 'upcoming' ? 'Upcoming' : md.status === 'active' ? 'Ongoing' : 'Finished',
  }));

  // Get button class for prediction buttons
  function getButtonClass(
    match: SwipeMatch,
    outcome: SwipePredictionOutcome,
    prediction?: SwipePredictionOutcome,
    isCorrect?: boolean
  ): string {
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
  }

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
            onClick={onViewLeaderboard}
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
            {isEditable && (
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
              <p className="text-2xl font-bold text-electric-blue">{potentialPoints}</p>
            </div>
          ) : (
            <div className="text-center mt-3">
              <p className="text-xs font-semibold text-text-secondary flex items-center justify-center gap-1">
                Final Points
              </p>
              <p className="text-2xl font-bold text-lime-glow">{totalPoints}</p>
            </div>
          )}
        </div>

        {isPicksVisible && (
          <div className="space-y-3 border-t border-white/10 pt-4 animate-scale-in">
            {matches.map(match => {
              const predictionRecord = predictions[match.id];
              const prediction = predictionRecord
                ? mapPredictionToOutcome(predictionRecord.prediction)
                : undefined;

              const isCorrect = predictionRecord?.is_correct === true;
              const points = predictionRecord?.points_earned || 0;

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
                        <span>{isCorrect ? `+${points} pts` : '0 pts'}</span>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      disabled={!isEditable}
                      onClick={() => isEditable && onUpdatePrediction(match.id, 'teamA')}
                      className={`p-2 rounded-lg text-sm font-semibold transition-colors flex flex-col items-center justify-center gap-1 ${getButtonClass(
                        match,
                        'teamA',
                        prediction,
                        isCorrect
                      )}`}
                    >
                      {match.teamA.logo ? (
                        <img
                          src={match.teamA.logo}
                          alt={match.teamA.name}
                          className="w-6 h-6 object-contain"
                          onError={(e) => { e.currentTarget.style.display = 'none' }}
                        />
                      ) : (
                        <span className="text-lg">{match.teamA.emoji}</span>
                      )}
                      <span className="text-xs truncate max-w-[70px]">{abbreviateTeamName(match.teamA.name)}</span>
                      {isEditable && (
                        <span className="text-xs opacity-70">@{match.odds.teamA.toFixed(2)}</span>
                      )}
                    </button>
                    <button
                      disabled={!isEditable}
                      onClick={() => isEditable && onUpdatePrediction(match.id, 'draw')}
                      className={`p-2 rounded-lg text-sm font-semibold transition-colors flex flex-col items-center justify-center gap-1 ${getButtonClass(
                        match,
                        'draw',
                        prediction,
                        isCorrect
                      )}`}
                    >
                      <span className="text-lg">🤝</span>
                      <span className="text-xs">Draw</span>
                      {isEditable && (
                        <span className="text-xs opacity-70">@{match.odds.draw.toFixed(2)}</span>
                      )}
                    </button>
                    <button
                      disabled={!isEditable}
                      onClick={() => isEditable && onUpdatePrediction(match.id, 'teamB')}
                      className={`p-2 rounded-lg text-sm font-semibold transition-colors flex flex-col items-center justify-center gap-1 ${getButtonClass(
                        match,
                        'teamB',
                        prediction,
                        isCorrect
                      )}`}
                    >
                      {match.teamB.logo ? (
                        <img
                          src={match.teamB.logo}
                          alt={match.teamB.name}
                          className="w-6 h-6 object-contain"
                          onError={(e) => { e.currentTarget.style.display = 'none' }}
                        />
                      ) : (
                        <span className="text-lg">{match.teamB.emoji}</span>
                      )}
                      <span className="text-xs truncate max-w-[70px]">{abbreviateTeamName(match.teamB.name)}</span>
                      {isEditable && (
                        <span className="text-xs opacity-70">@{match.odds.teamB.toFixed(2)}</span>
                      )}
                    </button>
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
});

SwipeRecapView.displayName = 'SwipeRecapView';

export default SwipeRecapView;
