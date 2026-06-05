import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface GameSectionProps {
  title: string;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon: React.ReactNode;
  colorClass: string;
}

export const GameSection: React.FC<GameSectionProps> = ({ title, count, children, defaultOpen = true, icon, colorClass }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (count === 0) {
    return null; // Don't render empty sections
  }

  return (
    <div className="card-base overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center p-4 text-left"
      >
        <div className={`flex items-center gap-3 ${colorClass}`}>
          {icon}
          <h3 className="text-lg font-bold">{title}</h3>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-current/10`}>
            {count}
          </span>
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
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
