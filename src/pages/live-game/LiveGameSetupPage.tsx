import React, { useState, useMemo } from 'react';
import { LiveGame, LiveGamePlayerEntry, BonusQuestion } from '../../types';
import { ArrowLeft, Check, Clock } from 'lucide-react';
import { BonusQuestionSet } from '../../components/leagues/live-game/BonusQuestionSet';
import { generateBonusQuestions } from '../../store/useMockStore';

interface LiveGameSetupPageProps {
  game: LiveGame;
  playerEntry?: LiveGamePlayerEntry;
  onBack: () => void;
  onSubmit: (gameId: string, userId: string, prediction: Omit<LiveGamePlayerEntry, 'user_id' | 'submitted_at'>) => void;
}

const LiveGameSetupPage: React.FC<LiveGameSetupPageProps> = ({ game, playerEntry, onBack, onSubmit }) => {
  const [homeScore, setHomeScore] = useState<number | ''>(playerEntry?.predicted_score?.home ?? '');
  const [awayScore, setAwayScore] = useState<number | ''>(playerEntry?.predicted_score?.away ?? '');
  const [bonusAnswers, setBonusAnswers] = useState<Record<string, string>>(
    playerEntry?.bonus_answers?.reduce((acc, ans) => ({ ...acc, [ans.question_id]: ans.choice }), {}) || {}
  );
  
  const hasSubmitted = !!playerEntry;

  const bonusQuestions: BonusQuestion[] = useMemo(() => {
    if (hasSubmitted) {
      return game.bonus_questions;
    }
    const predictedScore = { home: Number(homeScore), away: Number(awayScore) };
    return generateBonusQuestions(predictedScore);
  }, [homeScore, awayScore, hasSubmitted, game.bonus_questions]);

  const isSubmitDisabled = homeScore === '' || awayScore === '' || Object.keys(bonusAnswers).length < bonusQuestions.length;

  const handleSubmit = () => {
    if (isSubmitDisabled || hasSubmitted) return;
    const prediction: Omit<LiveGamePlayerEntry, 'user_id' | 'submitted_at'> = {
      predicted_score: { home: Number(homeScore), away: Number(awayScore) },
      bonus_answers: Object.entries(bonusAnswers).map(([question_id, choice]) => ({ question_id, choice })),
      midtime_edit: false,
    };
    onSubmit(game.id, 'user-1', prediction); // Assuming user-1 for mock
  };

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-text-secondary font-semibold hover:text-electric-blue">
        <ArrowLeft size={20} /> Back to League
      </button>

      <div className="card-base p-4 flex items-center gap-4">
        <div className="text-4xl">{game.match_details.teamA.emoji}</div>
        <div className="flex-1 text-center">
          <h2 className="text-lg font-bold text-text-primary">{game.match_details.teamA.name} vs {game.match_details.teamB.name}</h2>
          <p className="text-sm text-text-secondary">{game.match_details.kickoffTime}</p>
        </div>
        <div className="text-4xl">{game.match_details.teamB.emoji}</div>
      </div>

      <div className="card-base p-4 space-y-4">
        <h3 className="text-lg font-bold text-text-primary text-center">Your Final Score Prediction</h3>
        <div className="flex items-center justify-center gap-4">
          <input
            type="number"
            value={homeScore}
            onChange={e => setHomeScore(Number(e.target.value))}
            disabled={hasSubmitted}
            className="input-base text-4xl font-bold w-24 text-center"
            min="0"
          />
          <span className="text-4xl font-bold text-text-disabled">:</span>
          <input
            type="number"
            value={awayScore}
            onChange={e => setAwayScore(Number(e.target.value))}
            disabled={hasSubmitted}
            className="input-base text-4xl font-bold w-24 text-center"
            min="0"
          />
        </div>
      </div>

      <BonusQuestionSet
        questions={bonusQuestions}
        answers={bonusAnswers}
        onAnswerChange={setBonusAnswers}
        disabled={hasSubmitted}
      />

      {hasSubmitted ? (
        <div className="bg-lime-glow/10 border border-lime-glow/20 text-lime-glow p-3 rounded-xl flex items-center justify-center gap-3">
          <Check size={20} />
          <p className="text-sm font-medium">Your predictions have been submitted!</p>
        </div>
      ) : (
        <div className="bg-warm-yellow/10 border border-warm-yellow/20 text-warm-yellow p-3 rounded-xl flex items-center gap-3">
          <Clock size={20} />
          <p className="text-sm font-medium">Predictions lock at kickoff: {game.match_details.kickoffTime}</p>
        </div>
      )}

      {!hasSubmitted && (
        <button onClick={handleSubmit} disabled={isSubmitDisabled} className="w-full primary-button">
          Confirm My Predictions
        </button>
      )}
    </div>
  );
};

export default LiveGameSetupPage;
