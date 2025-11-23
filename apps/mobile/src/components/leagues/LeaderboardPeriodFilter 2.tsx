import React, { useState, useMemo } from 'react';
import { UserLeague, LeagueGame, LeagueMember, LeaderboardPeriod, LeaderboardPeriodStartType, LeaderboardPeriodEndType } from '../../types';
import { Calendar, Check, Loader2, ChevronDown } from 'lucide-react';
import { format, parseISO, isWithinInterval } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';

interface EventWithDate {
  startDate: string;
}

interface LeaderboardPeriodFilterProps {
  league: UserLeague;
  leagueGame: LeagueGame;
  members: LeagueMember[];
  events: EventWithDate[];
  onApply: (period: LeaderboardPeriod) => void;
  loading: boolean;
}

const RadioButton: React.FC<{ id: string; name: string; value: string; label: string; checked: boolean; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; }> = 
({ id, name, value, label, checked, onChange }) => (
  <label htmlFor={id} className={`flex items-center p-2 rounded-lg cursor-pointer transition-colors ${checked ? 'bg-electric-blue/10' : 'hover:bg-white/5'}`}>
    <input type="radio" id={id} name={name} value={value} checked={checked} onChange={onChange} className="hidden" />
    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mr-2 ${checked ? 'border-electric-blue bg-electric-blue' : 'border-text-disabled'}`}>
      {checked && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
    </div>
    <span className={`text-sm font-semibold ${checked ? 'text-electric-blue' : 'text-text-secondary'}`}>{label}</span>
  </label>
);

export const LeaderboardPeriodFilter: React.FC<LeaderboardPeriodFilterProps> = ({ league, leagueGame, members, events, onApply, loading }) => {
  const [isOpen, setIsOpen] = useState(false);
  const initialPeriod = leagueGame.leaderboard_period;

  const [startType, setStartType] = useState<LeaderboardPeriodStartType>(initialPeriod?.start_type || 'season_start');
  const [endType, setEndType] = useState<LeaderboardPeriodEndType>(initialPeriod?.end_type || 'season_end');
  const [customStartDate, setCustomStartDate] = useState(initialPeriod?.start_date || league.season_start_date || '');
  const [customEndDate, setCustomEndDate] = useState(initialPeriod?.end_date || league.season_end_date || '');

  const derivedDates = useMemo(() => {
    let startDateStr: string, endDateStr: string;

    switch (startType) {
      case 'link_date':
        startDateStr = leagueGame.linked_at;
        break;
      case 'last_member_joined':
        const joinDates = members.map(m => parseISO(m.joined_at).getTime());
        startDateStr = new Date(Math.max(...joinDates)).toISOString();
        break;
      case 'custom':
        startDateStr = customStartDate ? new Date(customStartDate).toISOString() : new Date().toISOString();
        break;
      case 'season_start':
      default:
        startDateStr = league.season_start_date || new Date().toISOString();
    }

    switch (endType) {
      case 'custom':
        endDateStr = customEndDate ? new Date(customEndDate).toISOString() : new Date().toISOString();
        break;
      case 'season_end':
      default:
        endDateStr = league.season_end_date || new Date().toISOString();
    }
    
    return { startDate: parseISO(startDateStr), endDate: parseISO(endDateStr) };
  }, [startType, endType, customStartDate, customEndDate, league, leagueGame, members]);

  const coveredEventsCount = useMemo(() => {
    if (!events) return 0;
    return events.filter(event => 
      isWithinInterval(parseISO(event.startDate), { start: derivedDates.startDate, end: derivedDates.endDate })
    ).length;
  }, [derivedDates, events]);

  const handleApply = () => {
    const period: LeaderboardPeriod = {
      start_type: startType,
      end_type: endType,
      start_date: derivedDates.startDate.toISOString(),
      end_date: derivedDates.endDate.toISOString(),
    };
    onApply(period);
  };

  return (
    <div className="bg-navy-accent/50 border border-disabled rounded-xl">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center p-4 text-left">
        <h4 className="text-sm font-bold text-text-secondary uppercase flex items-center gap-2">
          <Calendar size={16} /> Leaderboard Period
        </h4>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-lime-glow bg-lime-glow/10 px-2 py-1 rounded">
            Events: {coveredEventsCount}
          </span>
          <ChevronDown className={`transition-transform text-text-secondary ${isOpen ? 'rotate-180' : ''}`} />
        </div>
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
            <div className="px-4 pb-4 pt-2 border-t border-disabled/50 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Start Date Options */}
                <div className="bg-deep-navy/50 p-3 rounded-lg space-y-2">
                  <p className="font-semibold text-text-primary text-sm">Start From</p>
                  <RadioButton id="start_season" name="start" value="season_start" label="Season Start" checked={startType === 'season_start'} onChange={(e) => setStartType(e.target.value as LeaderboardPeriodStartType)} />
                  <RadioButton id="start_link" name="start" value="link_date" label="Link Date" checked={startType === 'link_date'} onChange={(e) => setStartType(e.target.value as LeaderboardPeriodStartType)} />
                  <RadioButton id="start_member" name="start" value="last_member_joined" label="Last Member Joined" checked={startType === 'last_member_joined'} onChange={(e) => setStartType(e.target.value as LeaderboardPeriodStartType)} />
                  <RadioButton id="start_custom" name="start" value="custom" label="Custom Date" checked={startType === 'custom'} onChange={(e) => setStartType(e.target.value as LeaderboardPeriodStartType)} />
                  {startType === 'custom' && (
                    <input type="date" value={customStartDate.split('T')[0]} onChange={e => setCustomStartDate(e.target.value)} className="input-base text-sm p-2 ml-6 w-auto" />
                  )}
                </div>

                {/* End Date Options */}
                <div className="bg-deep-navy/50 p-3 rounded-lg space-y-2">
                  <p className="font-semibold text-text-primary text-sm">End At</p>
                  <RadioButton id="end_season" name="end" value="season_end" label="Season End" checked={endType === 'season_end'} onChange={(e) => setEndType(e.target.value as LeaderboardPeriodEndType)} />
                  <RadioButton id="end_custom" name="end" value="custom" label="Custom Date" checked={endType === 'custom'} onChange={(e) => setEndType(e.target.value as LeaderboardPeriodEndType)} />
                  {endType === 'custom' && (
                    <input type="date" value={customEndDate.split('T')[0]} onChange={e => setCustomEndDate(e.target.value)} className="input-base text-sm p-2 ml-6 w-auto" />
                  )}
                </div>
              </div>

              <div className="bg-deep-navy/50 p-3 rounded-lg text-center space-y-2">
                <p className="text-xs text-text-disabled">The leaderboard will be calculated from <b className="text-text-secondary">{format(derivedDates.startDate, 'MMM d, yyyy')}</b> to <b className="text-text-secondary">{format(derivedDates.endDate, 'MMM d, yyyy')}</b>.</p>
              </div>

              <button onClick={handleApply} disabled={loading} className="w-full primary-button flex items-center justify-center gap-2">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Apply Changes
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
