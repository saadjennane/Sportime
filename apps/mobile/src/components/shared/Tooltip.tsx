import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Info } from 'lucide-react';

interface TooltipProps {
  text: string;
  children: React.ReactElement;
}

export const Tooltip: React.FC<TooltipProps> = ({ text, children }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className="relative flex items-center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs p-2 bg-deep-navy border border-disabled rounded-lg shadow-xl z-10"
          >
            <p className="text-xs text-text-secondary">{text}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const InfoTooltip: React.FC<{ text: string }> = ({ text }) => (
  <Tooltip text={text}>
    <Info size={14} className="text-text-disabled cursor-help" />
  </Tooltip>
);
