import React, { useState, useMemo } from 'react';
import { FantasyGameWeek, FantasyPlayer } from '../../types';
import { ChevronDown, CheckCircle } from 'lucide-react';
import { differenceInYears, parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

interface GameWeekConditionsProps {
  gameWeek: FantasyGameWeek;
  team: FantasyPlayer[];
}

export const GameWeekConditions: React.FC<GameWeekConditionsProps> = ({ gameWeek, team }) => {
  const [isOpen, setIsOpen] = useState(false);

  const validationResults = useMemo(() => {
    const results: Record<string, boolean> = {};
    if (!gameWeek.conditions) return { results, metCount: 0, totalCount: 0 };

    let metCount = 0;
    gameWeek.conditions.forEach(condition => {
      let isMet = false;
      switch (condition.key) {
        case 'max_club_players': {
          const clubCounts = team.reduce((acc, player) => {
            acc[player.teamName] = (acc[player.teamName] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          isMet = Object.values(clubCounts).every(count => count <= (condition.value as number));
          break;
        }
        case 'max_star_players': {
          const starCount = team.filter(p => p.status === 'Star').length;
          isMet = starCount <= (condition.value as number);
          break;
        }
        case 'min_nationality': {
          isMet = team.some(p => p.nationality === condition.value);
          break;
        }
        default:
          isMet = true; // Assume unknown conditions are met
      }
      results[condition.key] = isMet;
      if (isMet) metCount++;
    });
    return { results, metCount, totalCount: gameWeek.conditions.length };
  }, [gameWeek.conditions, team]);

  const activeBonus = useMemo(() => {
    if (team.length < 11) return null; // Only apply bonus for a full team
    
    const hasNoStar = team.every(p => p.status !== 'Star');
    if (hasNoStar) return 'no_star';

    const isCrazy = team.every(p => p.status === 'Wild');
    if (isCrazy) return 'crazy';

    const avgAge = team.reduce((sum, p) => sum + differenceInYears(new Date(), parseISO(p.birthdate)), 0) / team.length;
    if (avgAge >= 30) return 'vintage';
    
    return null;
  }, [team]);

  return (
    <div className="bg-white rounded-2xl shadow-lg">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center p-4 text-left">
        <h3 className="font-bold text-gray-800">Game Week Conditions</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-500">
            ✅ {validationResults.metCount} / {validationResults.totalCount} met
          </span>
          <ChevronDown className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t border-gray-100">
              {/* Conditions List */}
              <div className="space-y-1.5 pt-3">
                {gameWeek.conditions?.map(c => {
                  const isMet = validationResults.results[c.key];
                  return (
                    <div key={c.key} className="flex items-center gap-2 text-sm">
                      {isMet ? (
                        <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                      ) : (
                        <div className="w-4 h-4 flex-shrink-0" /> // Placeholder for alignment
                      )}
                      <span className={isMet ? 'text-gray-800' : 'text-gray-500'}>{c.text}</span>
                    </div>
                  );
                }) || <p className="text-sm text-gray-500">No special conditions this week.</p>}
              </div>

              {/* Bonuses List */}
              <div className="space-y-1.5 pt-2">
                 <h4 className="font-semibold text-sm text-gray-600">Optional Team Bonuses</h4>
                 <p className={`flex items-center gap-2 text-sm ${activeBonus === 'no_star' ? 'font-bold text-purple-700' : 'text-gray-500'}`}>
                    💪 No Star Bonus — +25% if no Star Players
                 </p>
                 <p className={`flex items-center gap-2 text-sm ${activeBonus === 'crazy' ? 'font-bold text-purple-700' : 'text-gray-500'}`}>
                    🎢 Crazy Boost — +40% if 100% Wild Cards
                 </p>
                 <p className={`flex items-center gap-2 text-sm ${activeBonus === 'vintage' ? 'font-bold text-purple-700' : 'text-gray-500'}`}>
                    🧓 Vintage Boost — +20% if average age ≥ 30
                 </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
