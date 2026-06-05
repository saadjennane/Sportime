import React, { useState, useMemo, useRef, useEffect } from 'react';
import { UserLeague, LeagueGame, LeagueMember } from '../../types';
import { ChevronDown, Globe } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface LeaderboardLeagueSwitcherProps {
  gameId: string;
  userLeagues: UserLeague[];
  leagueGames: LeagueGame[];
  leagueMembers: LeagueMember[];
  activeLeagueId: string | null;
  onSelectLeague: (leagueId: string | null) => void;
}

export const LeaderboardLeagueSwitcher: React.FC<LeaderboardLeagueSwitcherProps> = ({
  gameId,
  userLeagues,
  leagueGames,
  leagueMembers,
  activeLeagueId,
  onSelectLeague,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const relevantLeagues = useMemo(() => {
    const linkedGameLeagueIds = new Set(leagueGames.filter(lg => lg.game_id === gameId).map(lg => lg.league_id));
    return userLeagues.filter(ul => linkedGameLeagueIds.has(ul.id));
  }, [gameId, userLeagues, leagueGames]);

  const getMemberCount = (leagueId: string) => leagueMembers.filter(m => m.league_id === leagueId).length;

  const activeSelection = useMemo(() => {
    if (activeLeagueId === null) {
      return { id: 'global', name: 'Global', icon: <Globe size={20} /> };
    }
    const league = relevantLeagues.find(l => l.id === activeLeagueId);
    return league
      ? { id: league.id, name: league.name, icon: <img src={league.image_url} alt={league.name} className="w-5 h-5 rounded-full" /> }
      : { id: 'global', name: 'Global', icon: <Globe size={20} /> };
  }, [activeLeagueId, relevantLeagues]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (leagueId: string | null) => {
    onSelectLeague(leagueId);
    setIsOpen(false);
  };

  if (relevantLeagues.length === 0) {
    return null; // Don't show switcher if user is in no relevant leagues
  }

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 bg-navy-accent border-2 border-disabled rounded-xl text-left"
      >
        <div className="flex items-center gap-2">
          {activeSelection.icon}
          <span className="font-semibold text-text-primary">{activeSelection.name}</span>
        </div>
        <ChevronDown className={`transition-transform text-text-secondary ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full mt-2 w-full bg-navy-accent rounded-xl shadow-lg border border-disabled z-10 p-2"
          >
            <div className="space-y-1">
              <button
                onClick={() => handleSelect(null)}
                className="w-full flex items-center justify-between gap-3 p-3 text-left hover:bg-electric-blue/10 rounded-lg"
              >
                <div className="flex items-center gap-2 font-semibold text-text-primary"><Globe size={20} /> Global</div>
              </button>
              {relevantLeagues.map(league => (
                <button
                  key={league.id}
                  type="button"
                  onClick={() => handleSelect(league.id)}
                  className="w-full flex items-center justify-between gap-3 p-3 text-left hover:bg-electric-blue/10 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <img src={league.image_url} alt={league.name} className="w-5 h-5 rounded-full" />
                    <span className="text-text-primary font-semibold">{league.name}</span>
                  </div>
                  <span className="text-xs text-text-disabled">{getMemberCount(league.id)} members</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
