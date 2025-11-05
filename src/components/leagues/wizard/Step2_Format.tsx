import React from 'react';
import { WizardState } from './CreatePrivateLeagueWizard';
import { PrivateGameFormat } from '../../../../types';
import { Trophy, Swords, ShieldAlert } from 'lucide-react';

interface StepProps {
  state: WizardState;
  updateState: (update: Partial<WizardState>) => void;
  next: () => void;
  prev: () => void;
}

const FormatOption: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  value: PrivateGameFormat;
  selected: boolean;
  onClick: () => void;
}> = ({ icon, title, description, value, selected, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full text-left p-4 rounded-xl bg-deep-navy hover:bg-navy-accent border-2 transition-all ${
      selected ? 'border-electric-blue' : 'border-disabled hover:border-electric-blue/50'
    }`}
  >
    <div className="flex items-start gap-4">
      <div className={`p-3 rounded-lg ${selected ? 'bg-electric-blue/10 text-electric-blue' : 'bg-disabled/20 text-text-disabled'}`}>
        {icon}
      </div>
      <div>
        <h4 className="font-bold text-text-primary">{title}</h4>
        <p className="text-sm text-text-secondary">{description}</p>
      </div>
    </div>
  </button>
);

export const Step2_Format: React.FC<StepProps> = ({ state, updateState, next, prev }) => {
  const handleSelect = (format: PrivateGameFormat) => {
    updateState({ format_type: format });
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-text-primary">Choose Game Format</h3>
        <p className="text-text-secondary">Select the competition format for your league.</p>
      </div>

      <div className="space-y-3">
        <FormatOption
          icon={<Trophy size={24} />}
          title="Championship"
          description="Everyone plays each other over a set number of matchdays."
          value="championship"
          selected={state.format_type === 'championship'}
          onClick={() => handleSelect('championship')}
        />
        <FormatOption
          icon={<Swords size={24} />}
          title="Championship + Knockouts"
          description="After a regular season, the top 4 compete in playoffs."
          value="championship_knockout"
          selected={state.format_type === 'championship_knockout'}
          onClick={() => handleSelect('championship_knockout')}
        />
        <FormatOption
          icon={<ShieldAlert size={24} />}
          title="Knockout Only"
          description="Direct elimination tournament. High stakes from the start!"
          value="knockout"
          selected={state.format_type === 'knockout'}
          onClick={() => handleSelect('knockout')}
        />
      </div>

      <div className="flex gap-4 pt-4">
        <button onClick={prev} className="secondary-button flex-1 bg-navy-accent border-disabled text-text-secondary hover:border-electric-blue hover:text-electric-blue">
          Back
        </button>
        <button onClick={next} disabled={!state.format_type} className="primary-button flex-1">
          Continue
        </button>
      </div>
    </div>
  );
};
