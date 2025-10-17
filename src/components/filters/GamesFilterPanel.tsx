import React, { useState, useEffect } from 'react';
import { GameFilters } from '../../types';
import { X, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface GamesFilterPanelProps {
  filters: GameFilters;
  onFilterChange: (newFilters: GameFilters) => void;
}

const FilterChip: React.FC<{ label: string; onRemove: () => void }> = ({ label, onRemove }) => (
  <div className="flex items-center gap-1 bg-electric-blue/20 text-electric-blue text-xs font-semibold px-2 py-1 rounded-full">
    <span>{label}</span>
    <button onClick={onRemove} className="hover:bg-electric-blue/20 rounded-full"><X size={14} /></button>
  </div>
);

export const GamesFilterPanel: React.FC<GamesFilterPanelProps> = ({ filters, onFilterChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsOpen(window.innerWidth >= 768);
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    onFilterChange({ ...filters, [name]: value });
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    onFilterChange({ ...filters, [name]: checked });
  };

  const removeFilter = (key: keyof GameFilters) => {
    const defaultValue = key === 'eligibleOnly' ? false : 'all';
    onFilterChange({ ...filters, [key]: defaultValue as any });
  };

  const clearAll = () => {
    onFilterChange({
      type: 'all',
      format: 'all',
      tier: 'all',
      duration: 'all',
      eligibleOnly: false,
    });
  };

  const activeFilters = Object.entries(filters).filter(([key, value]) => 
    (key === 'eligibleOnly' && value === true) || (key !== 'eligibleOnly' && value !== 'all')
  );

  return (
    <div className="card-base p-0 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <SlidersHorizontal size={18} className="text-electric-blue" />
          <h3 className="text-lg font-bold text-text-primary">Filters</h3>
          {activeFilters.length > 0 && (
             <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-electric-blue/20 text-electric-blue">
              {activeFilters.length}
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <select name="type" value={filters.type} onChange={handleSelectChange} className="input-base text-sm">
                  <option value="all">All Types</option>
                  <option value="betting">Betting</option>
                  <option value="prediction">Prediction</option>
                  <option value="fantasy">Fantasy</option>
                </select>
                <select name="format" value={filters.format} onChange={handleSelectChange} className="input-base text-sm">
                  <option value="all">All Formats</option>
                  <option value="leaderboard">Leaderboard</option>
                  <option value="championship">Championship</option>
                  <option value="knockout">Knockout</option>
                </select>
                <select name="tier" value={filters.tier} onChange={handleSelectChange} className="input-base text-sm">
                  <option value="all">All Tiers</option>
                  <option value="rookie">Rookie</option>
                  <option value="pro">Pro</option>
                  <option value="elite">Elite</option>
                </select>
                <select name="duration" value={filters.duration} onChange={handleSelectChange} className="input-base text-sm">
                  <option value="all">All Durations</option>
                  <option value="daily">Daily</option>
                  <option value="mini-series">Mini-Series</option>
                  <option value="seasonal">Seasonal</option>
                </select>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    name="eligibleOnly"
                    checked={filters.eligibleOnly}
                    onChange={handleCheckboxChange}
                    className="w-4 h-4 accent-electric-blue"
                  />
                  Only show games I can play
                </label>
                {activeFilters.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {activeFilters.map(([key, value]) => {
                      const label = key === 'eligibleOnly' ? 'Eligible Only' : `${key}: ${value}`;
                      return <FilterChip key={key} label={label} onRemove={() => removeFilter(key as keyof GameFilters)} />;
                    })}
                    <button onClick={clearAll} className="text-xs font-semibold text-hot-red hover:underline">Clear All</button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
