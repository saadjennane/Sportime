import React from 'react';
import { WizardState } from './CreatePrivateLeagueWizard';

interface StepProps {
  state: WizardState;
  updateState: (update: Partial<WizardState>) => void;
  next: () => void;
  prev: () => void;
}

export const Step3_Matchdays: React.FC<StepProps> = ({ state, updateState, next, prev }) => {
  const maxMatchdays = state.remaining_matchdays || 1;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateState({ selected_matchdays: parseInt(e.target.value, 10) });
  };

  return (
    <div className="space-y-6 text-center">
      <div>
        <h3 className="text-2xl font-bold text-text-primary">Select Matchdays</h3>
        <p className="text-text-secondary">How many matchdays do you want to play?</p>
      </div>

      <div className="bg-deep-navy/50 p-4 rounded-xl">
        <label htmlFor="matchdays-slider" className="block text-sm font-semibold text-text-secondary mb-2">
          Matchdays: <span className="text-electric-blue font-bold text-lg">{state.selected_matchdays}</span>
        </label>
        <input
          id="matchdays-slider"
          type="range"
          min="1"
          max={maxMatchdays}
          value={state.selected_matchdays || 1}
          onChange={handleChange}
          className="w-full h-2 bg-disabled rounded-lg appearance-none cursor-pointer accent-electric-blue"
        />
        <div className="flex justify-between text-xs font-medium text-text-disabled mt-1">
          <span>1</span>
          <span>{maxMatchdays}</span>
        </div>
      </div>

      <p className="text-lime-glow font-semibold">
        Your game will run over {state.selected_matchdays} matchdays.
      </p>

      <div className="flex gap-4 pt-4">
        <button onClick={prev} className="secondary-button flex-1 bg-navy-accent border-disabled text-text-secondary hover:border-electric-blue hover:text-electric-blue">
          Back
        </button>
        <button onClick={next} disabled={!state.selected_matchdays} className="primary-button flex-1">
          Continue
        </button>
      </div>
    </div>
  );
};
