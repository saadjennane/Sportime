import React, { useState } from 'react';
import { PROGRESSION_MILESTONES } from '../../data/mockFunZone';
import { AnimatePresence, motion } from 'framer-motion';
import { Gift, X } from 'lucide-react';

interface ProgressionBarProps {
  currentWins: number;
}

export const ProgressionBar: React.FC<ProgressionBarProps> = ({ currentWins }) => {
  const totalWins = PROGRESSION_MILESTONES[PROGRESSION_MILESTONES.length - 1].wins;
  const progressPercentage = (currentWins / totalWins) * 100;
  const [activeTooltip, setActiveTooltip] = useState<number | null>(null);

  return (
    <div className="card-base p-5 space-y-3">
      <div className="flex justify-between items-baseline">
        <h3 className="text-lg font-bold text-text-secondary">Win Progression</h3>
        <p className="font-bold text-warm-yellow">{currentWins} / {totalWins} Wins</p>
      </div>
      <div className="w-full bg-disabled rounded-full h-4 relative">
        <div
          className="bg-gradient-to-r from-electric-blue to-neon-cyan h-4 rounded-full"
          style={{ width: `${progressPercentage}%` }}
        ></div>
        {PROGRESSION_MILESTONES.map(milestone => {
          const isAchieved = currentWins >= milestone.wins;
          const position = (milestone.wins / totalWins) * 100;
          return (
            <div
              key={milestone.wins}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${position}%` }}
            >
              <button
                onMouseEnter={() => setActiveTooltip(milestone.wins)}
                onMouseLeave={() => setActiveTooltip(null)}
                className={`w-5 h-5 rounded-full border-2 transition-all ${
                  isAchieved ? 'bg-lime-glow border-white' : 'bg-disabled border-deep-navy'
                }`}
              />
              <AnimatePresence>
                {activeTooltip === milestone.wins && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max p-2 bg-deep-navy border border-disabled rounded-lg shadow-xl z-10"
                  >
                    <p className="text-xs font-bold text-text-primary">{milestone.wins} Wins Reward:</p>
                    <ul className="text-xs text-text-secondary">
                      {milestone.rewards.map((r, i) => (
                        <li key={i}>- {r.type === 'spin' ? `${r.value} spin` : `${r.value} ${r.type}`}</li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
};
