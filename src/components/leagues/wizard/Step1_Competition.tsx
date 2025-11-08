import React, { useMemo } from 'react';
import { WizardState } from './CreatePrivateLeagueWizard';
import { mockLeagues } from '../../../data/mockLeagues';

interface StepProps {
  state: WizardState;
  updateState: (update: Partial<WizardState>) => void;
  next: () => void;
}

export const Step1_Competition: React.FC<StepProps> = ({ state, updateState, next }) => {
  const selectedCompetition = useMemo(() => mockLeagues.find(l => l.id === state.competition_id), [state.competition_id]);

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const competitionId = e.target.value;
    const competition = mockLeagues.find(l => l.id === competitionId);
    if (competition) {
      updateState({
        competition_id: competition.id,
        remaining_matchdays: competition.remaining_matchdays,
      });
    }
  };

  return (
    <div className="space-y-6 text-center">
      <div>
        <h3 className="text-2xl font-bold text-text-primary">Select Competition</h3>
        <p className="text-text-secondary">Choose the base competition for your private league.</p>
      </div>
      
      <select
        value={state.competition_id || ''}
        onChange={handleSelect}
        className="input-base text-center"
      >
        <option value="" disabled>-- Choose a competition --</option>
        {mockLeagues.map(league => (
          <option key={league.id} value={league.id}>{league.name}</option>
        ))}
      </select>

      {selectedCompetition && (
        <p className="text-lime-glow font-semibold animate-scale-in">
          {selectedCompetition.remaining_matchdays} matchdays remaining in {selectedCompetition.name}.
        </p>
      )}

      <div className="pt-4">
        <button onClick={next} disabled={!state.competition_id} className="primary-button w-full">
          Continue
        </button>
      </div>
    </div>
  );
};
