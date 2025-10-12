import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import { PrivateLeagueGameConfig, UserLeague } from '../../../../types';
import { Step1_Competition } from './Step1_Competition';
import { Step2_Format } from './Step2_Format';
import { Step3_Matchdays } from './Step3_Matchdays';
import { Step4_Players } from './Step4_Players';
import { Step5_Knockout } from './Step5_Knockout';
import { Step6_Summary } from './Step6_Summary';
import { WizardStepper } from './WizardStepper';

interface CreatePrivateLeagueWizardProps {
  isOpen: boolean;
  onClose: () => void;
  league: UserLeague;
  onCreate: (leagueId: string, config: PrivateLeagueGameConfig) => void;
}

export type WizardState = Partial<PrivateLeagueGameConfig> & {
  remaining_matchdays?: number;
};

const steps = [
  { id: 1, name: 'Competition' },
  { id: 2, name: 'Format' },
  { id: 3, name: 'Matchdays' },
  { id: 4, name: 'Players' },
  { id: 5, name: 'Knockout' },
  { id: 6, name: 'Summary' },
];

export const CreatePrivateLeagueWizard: React.FC<CreatePrivateLeagueWizardProps> = ({ isOpen, onClose, league, onCreate }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [wizardState, setWizardState] = useState<WizardState>({
    player_count: 8,
    selected_matchdays: 10,
    include_third_place: false,
    tie_advantage: 'higher_seed',
    honorary_title: true,
    auto_rest_week: false,
    pairing_rule: '1vs4_2vs3',
  });

  if (!isOpen) return null;

  const updateState = (update: Partial<WizardState>) => {
    setWizardState(prev => ({ ...prev, ...update }));
  };

  const nextStep = () => setStep(s => Math.min(s + 1, steps.length));
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  const handleCreate = () => {
    if (wizardState.competition_id && wizardState.format_type && wizardState.player_count && wizardState.selected_matchdays) {
      setLoading(true);
      const finalConfig: PrivateLeagueGameConfig = {
        competition_id: wizardState.competition_id,
        format_type: wizardState.format_type,
        player_count: wizardState.player_count,
        selected_matchdays: wizardState.selected_matchdays,
        knockout_type: wizardState.knockout_type || null,
        include_third_place: wizardState.include_third_place || false,
        tie_advantage: 'higher_seed',
        honorary_title: true,
        auto_rest_week: wizardState.auto_rest_week || false,
        pairing_rule: '1vs4_2vs3',
      };
      onCreate(league.id, finalConfig);
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1: return <Step1_Competition state={wizardState} updateState={updateState} next={nextStep} />;
      case 2: return <Step2_Format state={wizardState} updateState={updateState} next={nextStep} prev={prevStep} />;
      case 3: return <Step3_Matchdays state={wizardState} updateState={updateState} next={nextStep} prev={prevStep} />;
      case 4: return <Step4_Players state={wizardState} updateState={updateState} next={nextStep} prev={prevStep} />;
      case 5:
        if (wizardState.format_type === 'championship') {
          setStep(6); // Skip this step
          return null;
        }
        return <Step5_Knockout state={wizardState} updateState={updateState} next={nextStep} prev={prevStep} />;
      case 6: return <Step6_Summary state={wizardState} prev={prevStep} create={handleCreate} loading={loading} />;
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-deep-navy/80 backdrop-blur-lg flex items-center justify-center p-4 z-50 animate-scale-in">
      <div className="modal-base w-full max-w-md h-auto max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-disabled">
          <h2 className="text-lg font-bold text-text-primary">Create Private Game</h2>
          <button onClick={onClose} className="p-2 text-text-secondary hover:bg-white/10 rounded-full">
            <X size={20} />
          </button>
        </div>
        <div className="p-4">
          <WizardStepper steps={steps} currentStep={step} />
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.2 }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
