import React from 'react';

export interface FinishedMatchesFilters {
  myBetsOnly: boolean;
}

interface FinishedMatchesFilterPanelProps {
  filters: FinishedMatchesFilters;
  onFilterChange: (newFilters: FinishedMatchesFilters) => void;
}

export const FinishedMatchesFilterPanel: React.FC<FinishedMatchesFilterPanelProps> = ({
  filters,
  onFilterChange,
}) => {
  const handleMyBetsToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filters, myBetsOnly: e.target.checked });
  };

  return (
    <div className="card-base p-4">
      <label className="flex items-center gap-3 text-sm font-semibold text-text-primary cursor-pointer">
        <input
          type="checkbox"
          checked={filters.myBetsOnly}
          onChange={handleMyBetsToggle}
          className="w-5 h-5 accent-electric-blue cursor-pointer"
        />
        <span>Only show matches I bet on</span>
      </label>
    </div>
  );
};
