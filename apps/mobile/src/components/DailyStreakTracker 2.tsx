import React from 'react';
import { UserStreak } from '../types';
import { Flame, CheckCircle, Gift } from 'lucide-react';
import { DAILY_STREAK_REWARDS } from '../config/constants';

interface DailyStreakTrackerProps {
  streak?: UserStreak;
}

export const DailyStreakTracker: React.FC<DailyStreakTrackerProps> = ({ streak }) => {
  const currentDay = streak?.current_day || 0;
  const days = Array.from({ length: 7 }, (_, i) => i + 1);

  return (
    <div className="card-base p-5">
      <h3 className="text-lg font-bold text-text-secondary flex items-center gap-2 mb-4">
        <Flame className="text-warm-yellow" /> Daily Streak
      </h3>
      <div className="flex justify-between items-center mb-3">
        {days.map(day => {
          const isCompleted = day <= currentDay;
          const isCurrent = day === currentDay + 1;
          const reward = DAILY_STREAK_REWARDS[day];

          return (
            <div key={day} className="flex flex-col items-center gap-1 text-center flex-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                  isCompleted ? 'bg-lime-glow/20 border-lime-glow' :
                  isCurrent ? 'bg-electric-blue/20 border-electric-blue animate-pulse' :
                  'bg-deep-navy border-disabled'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle size={20} className="text-lime-glow" />
                ) : (
                  reward.coins ? (
                    <span className={`font-bold text-xs ${isCurrent ? 'text-electric-blue' : 'text-text-disabled'}`}>
                      +{reward.coins}
                    </span>
                  ) : (
                    <Gift size={16} className={isCurrent ? 'text-electric-blue' : 'text-text-disabled'} />
                  )
                )}
              </div>
              <p className={`text-xs font-semibold ${isCompleted ? 'text-lime-glow' : isCurrent ? 'text-electric-blue' : 'text-text-disabled'}`}>
                Day {day}
              </p>
            </div>
          );
        })}
      </div>
      <div className="text-center text-sm text-text-secondary mt-4">
        {currentDay > 0 ? (
          <p>You're on a <span className="font-bold text-warm-yellow">{currentDay}-day streak!</span> Keep it up!</p>
        ) : (
          <p>Log in tomorrow to start a new streak.</p>
        )}
      </div>
    </div>
  );
};
