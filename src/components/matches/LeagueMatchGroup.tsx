import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface LeagueMatchGroupProps {
  leagueName: string;
  leagueLogo: string;
  matchesCount: number;
  children: React.ReactNode;
  initialOpen?: boolean;
}

export const LeagueMatchGroup: React.FC<LeagueMatchGroupProps> = ({ leagueName, leagueLogo, matchesCount, children, initialOpen = false }) => {
  const [isOpen, setIsOpen] = useState(initialOpen);

  return (
    <div className="bg-navy-accent/50 rounded-2xl overflow-hidden border border-disabled/50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <img src={leagueLogo} alt={leagueName} className="w-6 h-6" />
          <h3 className="font-bold text-text-primary">{leagueName}</h3>
          <span className="text-xs font-semibold bg-disabled text-text-disabled px-2 py-0.5 rounded-full">{matchesCount}</span>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-text-secondary transition-transform duration-300 ${
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
            <div className="p-4 pt-0 space-y-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
