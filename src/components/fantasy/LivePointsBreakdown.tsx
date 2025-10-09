import React, { useState, useMemo } from 'react';
import { ChevronDown, BarChart2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GameWeekSimulationResult } from '../../services/fantasyService';
import { FantasyPlayer } from '../../types';

interface LivePointsBreakdownProps {
  playerResults: GameWeekSimulationResult['playerResults'];
  teamResult: GameWeekSimulationResult['teamResult'];
  teamPlayers: FantasyPlayer[];
  captainId: string | null;
  isFinished: boolean;
}

export const LivePointsBreakdown: React.FC<LivePointsBreakdownProps> = ({ playerResults, teamResult, teamPlayers, captainId, isFinished }) => {
  const [isOpen, setIsOpen] = useState(true);

  const sumOfPlayerPoints = useMemo(() => {
    return teamPlayers.reduce((sum, player) => {
      return sum + (playerResults[player.id]?.points || 0);
    }, 0);
  }, [playerResults, teamPlayers]);

  return (
    <div className="bg-white rounded-2xl shadow-lg">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center p-4 text-left">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <BarChart2 size={18} />
          {isFinished ? 'Final' : 'Live'} Points Breakdown
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-purple-700">
            {teamResult.totalPoints.toFixed(1)} pts
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
              {isFinished && (
                <div className="flex items-center justify-center gap-2 text-sm font-semibold text-green-600 bg-green-50 p-2 rounded-lg mt-2">
                  <Check size={16} /> Finalized
                </div>
              )}
              {/* Player Scores Section */}
              <div className="space-y-2 pt-3">
                <h4 className="font-semibold text-sm text-gray-500 uppercase">Player Scores</h4>
                {teamPlayers.map(player => {
                  const result = playerResults[player.id];
                  if (!result) return null;
                  const fatigueMultiplier = result.initialFatigue;
                  const isCaptain = player.id === captainId;

                  return (
                    <div key={player.id} className="flex items-center justify-between text-sm py-1">
                      <div className="flex items-center gap-2">
                        <img src={player.photo} alt={player.name} className="w-6 h-6 rounded-full" />
                        <span className="font-medium text-gray-800">{player.name} {isCaptain && '(C)'}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-purple-700">{result.points.toFixed(1)} pts</span>
                        <div className="text-xs text-gray-500 flex items-center justify-end gap-1">
                          <span>{result.basePoints.toFixed(1)}</span>
                          <span className="text-gray-400">×</span>
                          <span title={`Fatigue: ${Math.round(fatigueMultiplier * 100)}%`}>{fatigueMultiplier.toFixed(2)}</span>
                          {result.breakdown['Captain Bonus'] && <span className="text-blue-500 font-bold" title="Captain Bonus">×C</span>}
                          {result.breakdown['Double Impact'] && <span className="text-red-500 font-bold" title="Double Impact">×DI</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Team Total Section */}
              <div className="space-y-2 pt-3 border-t border-gray-100">
                <h4 className="font-semibold text-sm text-gray-500 uppercase">Team Total</h4>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Sum of Player Points</span>
                  <span className="font-semibold text-gray-800">{sumOfPlayerPoints.toFixed(1)}</span>
                </div>
                {teamResult.bonusApplied && teamResult.bonusApplied.split(' & ').map(bonusStr => {
                  const parts = bonusStr.match(/(.+) \((.+)\)/);
                  if (!parts) return null;
                  const bonusName = parts[1].trim();
                  const bonusValue = parts[2];
                  return (
                    <div key={bonusName} className="flex justify-between text-sm">
                      <span className="text-gray-600">{bonusName}</span>
                      <span className="font-semibold text-green-600">{bonusValue}</span>
                    </div>
                  );
                })}
                <div className="flex justify-between text-md font-bold mt-2 pt-2 border-t">
                  <span>Final Score</span>
                  <span>{teamResult.totalPoints.toFixed(1)}</span>
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
