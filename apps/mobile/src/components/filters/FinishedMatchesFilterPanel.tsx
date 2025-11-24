import React, { useState, useEffect } from 'react';
import { X, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export interface FinishedMatchesFilters {
  leagueIds: string[];
  statuses: string[];
  myBetsOnly: boolean;
}

interface FinishedMatchesFilterPanelProps {
  filters: FinishedMatchesFilters;
  onFilterChange: (newFilters: FinishedMatchesFilters) => void;
  availableLeagues: Array<{ id: string; name: string }>;
}

const FilterChip: React.FC<{ label: string; onRemove: () => void }> = ({ label, onRemove }) => (
  <div className="flex items-center gap-1 bg-electric-blue/20 text-electric-blue text-xs font-semibold px-2 py-1 rounded-full">
    <span>{label}</span>
    <button onClick={onRemove} className="hover:bg-electric-blue/20 rounded-full">
      <X size={14} />
    </button>
  </div>
);

export const FinishedMatchesFilterPanel: React.FC<FinishedMatchesFilterPanelProps> = ({
  filters,
  onFilterChange,
  availableLeagues,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsOpen(window.innerWidth >= 768);
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === 'all') {
      onFilterChange({ ...filters, statuses: [] });
    } else {
      onFilterChange({ ...filters, statuses: [value] });
    }
  };

  const handleLeagueToggle = (leagueId: string) => {
    const newLeagueIds = filters.leagueIds.includes(leagueId)
      ? filters.leagueIds.filter(id => id !== leagueId)
      : [...filters.leagueIds, leagueId];
    onFilterChange({ ...filters, leagueIds: newLeagueIds });
  };

  const handleMyBetsToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filters, myBetsOnly: e.target.checked });
  };

  const clearAll = () => {
    onFilterChange({
      leagueIds: [],
      statuses: [],
      myBetsOnly: false,
    });
  };

  const activeFiltersCount =
    (filters.leagueIds.length > 0 ? 1 : 0) +
    (filters.statuses.length > 0 ? 1 : 0) +
    (filters.myBetsOnly ? 1 : 0);

  const removeLeagueFilter = () => {
    onFilterChange({ ...filters, leagueIds: [] });
  };

  const removeStatusFilter = () => {
    onFilterChange({ ...filters, statuses: [] });
  };

  const removeMyBetsFilter = () => {
    onFilterChange({ ...filters, myBetsOnly: false });
  };

  const currentStatus = filters.statuses.length > 0 ? filters.statuses[0] : 'all';
  const statusLabels: Record<string, string> = {
    FT: 'Full Time',
    AET: 'Extra Time',
    PEN: 'Penalties',
  };

  return (
    <div className="card-base p-0 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <SlidersHorizontal size={18} className="text-electric-blue" />
          <h3 className="text-lg font-bold text-text-primary">Filters</h3>
          {activeFiltersCount > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-electric-blue/20 text-electric-blue">
              {activeFiltersCount}
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-6 h-6 text-text-disabled transition-transform duration-300 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-4 border-t border-white/10">
              {/* Status Filter */}
              <div>
                <label className="block text-sm font-semibold text-text-secondary mb-2">
                  Match Status
                </label>
                <select
                  value={currentStatus}
                  onChange={handleStatusChange}
                  className="input-base text-sm w-full"
                >
                  <option value="all">All Statuses</option>
                  <option value="FT">Full Time</option>
                  <option value="AET">After Extra Time</option>
                  <option value="PEN">Penalties</option>
                </select>
              </div>

              {/* League Filter */}
              {availableLeagues.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-text-secondary mb-2">
                    Leagues ({filters.leagueIds.length} selected)
                  </label>
                  <div className="max-h-40 overflow-y-auto space-y-2 p-2 bg-deep-navy/50 rounded-lg">
                    {availableLeagues.map((league) => (
                      <label
                        key={league.id}
                        className="flex items-center gap-2 text-sm text-text-primary cursor-pointer hover:bg-white/5 p-1 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={filters.leagueIds.includes(league.id)}
                          onChange={() => handleLeagueToggle(league.id)}
                          className="w-4 h-4 accent-electric-blue"
                        />
                        {league.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* My Bets Only Toggle */}
              <div className="pt-2 border-t border-white/10">
                <label className="flex items-center gap-2 text-sm font-semibold text-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.myBetsOnly}
                    onChange={handleMyBetsToggle}
                    className="w-4 h-4 accent-electric-blue"
                  />
                  Only show matches I bet on
                </label>
              </div>

              {/* Active Filters & Clear */}
              {activeFiltersCount > 0 && (
                <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-white/10">
                  {filters.statuses.length > 0 && (
                    <FilterChip
                      label={`Status: ${statusLabels[filters.statuses[0]] || filters.statuses[0]}`}
                      onRemove={removeStatusFilter}
                    />
                  )}
                  {filters.leagueIds.length > 0 && (
                    <FilterChip
                      label={`${filters.leagueIds.length} League${filters.leagueIds.length > 1 ? 's' : ''}`}
                      onRemove={removeLeagueFilter}
                    />
                  )}
                  {filters.myBetsOnly && (
                    <FilterChip label="My Bets Only" onRemove={removeMyBetsFilter} />
                  )}
                  <button
                    onClick={clearAll}
                    className="text-xs font-semibold text-hot-red hover:underline ml-auto"
                  >
                    Clear All
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
