import React from 'react';

interface WizardStepperProps {
  steps: { id: number; name: string }[];
  currentStep: number;
}

export const WizardStepper: React.FC<WizardStepperProps> = ({ steps, currentStep }) => {
  return (
    <div className="flex items-center justify-between">
      {steps.map((step, index) => {
        const isActive = step.id === currentStep;
        const isCompleted = step.id < currentStep;
        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center text-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold border-2 transition-all duration-300 ${
                  isActive ? 'bg-electric-blue border-electric-blue text-white' : 
                  isCompleted ? 'bg-lime-glow/20 border-lime-glow text-lime-glow' : 
                  'bg-deep-navy border-disabled text-text-disabled'
                }`}
              >
                {isCompleted ? '✓' : step.id}
              </div>
              <p className={`text-xs mt-1 font-semibold transition-colors ${isActive ? 'text-electric-blue' : 'text-text-disabled'}`}>
                {step.name}
              </p>
            </div>
            {index < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 transition-colors duration-500 ${isCompleted ? 'bg-lime-glow' : 'bg-disabled'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
