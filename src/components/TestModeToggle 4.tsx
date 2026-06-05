import React from 'react';

interface TestModeToggleProps {
  label: string;
  description: string;
  isTestMode: boolean;
  onToggle: (enabled: boolean) => void;
}

export const TestModeToggle: React.FC<TestModeToggleProps> = ({ label, description, isTestMode, onToggle }) => {
  return (
    <div className="bg-gray-50 p-4 rounded-lg flex items-start gap-4">
      <div className="flex-1">
        <h4 className="font-semibold text-gray-800">{label}</h4>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      </div>
      <div
        onClick={() => onToggle(!isTestMode)}
        className={`relative w-12 h-7 rounded-full cursor-pointer transition-colors duration-300 ${
          isTestMode ? 'bg-purple-600' : 'bg-gray-300'
        }`}
      >
        <span
          className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${
            isTestMode ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </div>
    </div>
  );
};
