import React from 'react';
import { WizardState } from './CreatePrivateLeagueWizard';
import { validatePrivateLeagueConfig } from '../../../lib/validation';

interface StepProps {
  state: WizardState;
  updateState: (update: Partial<WizardState>) => void;
  next: () => void;
  prev: () => void;
}

const PLAYER_OPTIONS = [4, 6, 8, 10, 12, 16];

export const Step4_Players: React.FC<StepProps> = ({ state, updateState, next, prev }) => {
  const validation = validatePrivateLeagueConfig(state.format_type!, state.player_count!, state.selected_matchdays!, state.knockout_type || null);

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateState({ player_count: parseInt(e.target.value, 10) });
  };

  return (
    <div className="space-y-6 text-center">
      <div>
        <h3 className="text-2xl font-bold text-text-primary">Number of Players</h3>
        <p className="text-text-secondary">How many players will join your private league?</p>
      </div>

      <select
        value={state.player_count}
        onChange={handleSelect}
        className="input-base text-center"
      >
        {PLAYER_OPTIONS.map(num => (
          <option key={num} value={num}>{num} Players</option>
        ))}
      </select>

      {validation.error && (
        <p className="text-hot-red font-semibold animate-scale-in">
          ⚠️ {validation.error}
        </p>
      )}
      {validation.restWeek && (
        <p className="text-warm-yellow font-semibold animate-scale-in">
          ⚠️ With an odd number of players, one will rest each matchday.
        </p>
      )}

      <div className="flex gap-4 pt-4">
        <button onClick={prev} className="secondary-button flex-1 bg-navy-accent border-disabled text-text-secondary hover:border-electric-blue hover:text-electric-blue">
          Back
        </button>
        <button onClick={next} disabled={!state.player_count || !validation.valid} className="primary-button flex-1">
          Continue
        </button>
      </div>
    </div>
  );
};
