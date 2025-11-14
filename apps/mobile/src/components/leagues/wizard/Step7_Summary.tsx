import React, { useMemo } from 'react';
import { WizardState } from './CreatePrivateLeagueWizard';
import { validatePrivateLeagueConfig } from '../../../lib/validation';
import { mockLeagues } from '../../../data/mockLeagues';
import { Loader2 } from 'lucide-react';

interface StepProps {
  state: WizardState;
  prev: () => void;
  create: () => void;
  loading: boolean;
}

const SummaryItem: React.FC<{ label: string; value: string | number | null | undefined }> = ({ label, value }) => (
  <div className="flex justify-between items-center py-2 border-b border-disabled/50">
    <p className="text-sm text-text-secondary">{label}</p>
    <p className="text-sm font-bold text-text-primary">{value}</p>
  </div>
);

export const Step7_Summary: React.FC<StepProps> = ({ state, prev, create, loading }) => {
  const competitionName = useMemo(() => mockLeagues.find(l => l.id === state.competition_id)?.name, [state.competition_id]);
  const validation = validatePrivateLeagueConfig(state.format_type!, state.player_count!, state.selected_matchdays!, state.knockout_type || null);
  
  const championshipDays = state.format_type === 'championship_knockout' ? state.selected_matchdays! - (validation.playoffDays || 0) : state.selected_matchdays;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-text-primary">✅ Summary</h3>
        <p className="text-text-secondary">Your Private League Game is ready!</p>
      </div>

      <div className="bg-deep-navy/50 p-4 rounded-xl space-y-2">
        <SummaryItem label="Competition" value={competitionName} />
        <SummaryItem label="Format" value={state.format_type?.replace('_', ' + ').replace(/\b\w/g, l => l.toUpperCase())} />
        <SummaryItem label="Players" value={state.player_count} />
        <SummaryItem label="Total Matchdays" value={state.selected_matchdays} />
        {state.format_type === 'championship_knockout' && (
          <p className="text-xs text-text-disabled text-right">({championshipDays} for league + {validation.playoffDays} for playoffs)</p>
        )}
        {state.format_type !== 'championship' && (
          <>
            <SummaryItem label="Knockout Type" value={`${state.knockout_type}-leg`} />
            <SummaryItem label="3rd Place Match" value={state.include_third_place ? 'Yes' : 'No'} />
            <SummaryItem label="Tie Advantage" value="Higher Seed" />
            <SummaryItem label="Honorary Title" value="Season Champion" />
          </>
        )}
      </div>

      {!validation.valid && (
        <p className="text-center text-hot-red font-semibold">
          ⚠️ {validation.error || "There's an issue with your configuration. Please go back and adjust."}
        </p>
      )}

      <div className="flex gap-4 pt-4">
        <button onClick={prev} className="secondary-button flex-1 bg-navy-accent border-disabled text-text-secondary hover:border-electric-blue hover:text-electric-blue">
          Back
        </button>
        <button onClick={create} disabled={loading || !validation.valid} className="primary-button flex-1">
          {loading ? <Loader2 className="animate-spin mx-auto" /> : 'Create My League'}
        </button>
      </div>
    </div>
  );
};
