import React from 'react';
import { BonusQuestion } from '../../../types';

interface BonusQuestionSetProps {
  questions: BonusQuestion[];
  answers: Record<string, string>;
  onAnswerChange: (newAnswers: Record<string, string>) => void;
  disabled: boolean;
}

export const BonusQuestionSet: React.FC<BonusQuestionSetProps> = ({ questions, answers, onAnswerChange, disabled }) => {
  const handleSelect = (questionId: string, choice: string) => {
    onAnswerChange({ ...answers, [questionId]: choice });
  };

  return (
    <div className="card-base p-4 space-y-4">
      <h3 className="text-lg font-bold text-text-primary text-center">Bonus Questions (40 pts)</h3>
      {questions.map(q => (
        <div key={q.id} className="bg-deep-navy/50 p-3 rounded-lg">
          <p className="text-sm font-semibold text-text-secondary mb-2">{q.question}</p>
          <div className="grid grid-cols-2 gap-2">
            {q.options?.map(opt => (
              <button
                key={opt}
                onClick={() => handleSelect(q.id, opt)}
                disabled={disabled}
                className={`p-2 rounded-lg text-sm font-semibold transition-colors ${
                  answers[q.id] === opt
                    ? 'bg-gradient-to-r from-electric-blue to-neon-cyan text-white'
                    : 'bg-deep-navy text-text-secondary hover:bg-navy-accent'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
