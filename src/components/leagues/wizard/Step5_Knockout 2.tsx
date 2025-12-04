import React from 'react';
import { WizardState } from './CreatePrivateLeagueWizard';
import { KnockoutType } from '../../../../types';

interface StepProps {
  state: WizardState;
  updateState: (update: Partial<WizardState>) => void;
  next: () => void;
  prev: () => void;
}

const Checkbox: React.FC<{ id: string; label: string; checked: boolean; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; }> = 
({ id, label, checked, onChange }) => (
  <label htmlFor={id} className="flex items-center p-3 rounded-lg cursor-pointer transition-colors bg-deep-navy/50 hover:bg-navy-accent">
    <input type="checkbox" id={id} checked={checked} onChange={onChange} className="hidden" />
    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center mr-3 ${checked ? 'bg-electric-blue border-electric-blue' : 'border-text-disabled'}`}>
      {checked && <div className="w-2 h-2 bg-white rounded-sm" />}
    </div>
    <span className="text-sm font-semibold text-text-secondary">{label}</span>
  </label>
);

const RadioButton: React.FC<{ id: string; name: string; value: string; label: string; checked: boolean; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; }> = 
({ id, name, value, label, checked, onChange }) => (
  <label htmlFor={id} className={`flex items-center p-3 rounded-lg cursor-pointer transition-colors ${checked ? 'bg-electric-blue/10' : 'bg-deep-navy/50 hover:bg-navy-accent'}`}>
    <input type="radio" id={id} name={name} value={value} checked={checked} onChange={onChange} className="hidden" />
    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-3 ${checked ? 'border-electric-blue bg-electric-blue' : 'border-text-disabled'}`}>
      {checked && <div className="w-2 h-2 bg-white rounded-full" />}
    </div>
    <span className={`text-sm font-semibold ${checked ? 'text-electric-blue' : 'text-text-secondary'}`}>{label}</span>
  </label>
);

export const Step5_Knockout: React.FC<StepProps> = ({ state, updateState, next, prev }) => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-text-primary">Knockout Details</h3>
        <p className="text-text-secondary">Choose your knockout style.</p>
      </div>

      <div className="space-y-4">
        <div>
          <p className="font-semibold text-text-primary mb-2">Match Type</p>
          <div className="space-y-2">
            <RadioButton id="single-leg" name="knockout_type" value="single" label="Single match per round" checked={state.knockout_type === 'single'} onChange={(e) => updateState({ knockout_type: e.target.value as KnockoutType })} />
            <RadioButton id="double-leg" name="knockout_type" value="double" label="Home & Away (double leg)" checked={state.knockout_type === 'double'} onChange={(e) => updateState({ knockout_type: e.target.value as KnockoutType })} />
          </div>
        </div>
        
        <div>
          <p className="font-semibold text-text-primary mb-2">Options</p>
          <Checkbox id="third-place" label="Include 3rd place match" checked={state.include_third_place || false} onChange={(e) => updateState({ include_third_place: e.target.checked })} />
        </div>
      </div>

      <div className="text-center text-xs text-warm-yellow bg-warm-yellow/10 p-3 rounded-lg">
        🏆 The regular season winner will be granted a ‘Champion of the Season’ title and will advance in case of a tie during playoffs.
      </div>

      <div className="flex gap-4 pt-4">
        <button onClick={prev} className="secondary-button flex-1 bg-navy-accent border-disabled text-text-secondary hover:border-electric-blue hover:text-electric-blue">
          Back
        </button>
        <button onClick={next} disabled={!state.knockout_type} className="primary-button flex-1">
          Continue
        </button>
      </div>
    </div>
  );
};
