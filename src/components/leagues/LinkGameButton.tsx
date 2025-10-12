import React, { useState, useMemo } from 'react';
import { Game, UserLeague, LeagueMember, LeagueGame, Profile } from '../../types';
import { Link, Check, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface LinkGameButtonProps {
  game: Game;
  userId: string;
  userLeagues: UserLeague[];
  leagueMembers: LeagueMember[];
  leagueGames: LeagueGame[];
  onLink: (game: Game) => void;
  loading: boolean;
}

export const LinkGameButton: React.FC<LinkGameButtonProps> = ({ game, userId, userLeagues, leagueMembers, leagueGames, onLink, loading }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const { isLinked, linkedLeaguesNames } = useMemo(() => {
    const gameLinks = leagueGames.filter(lg => lg.game_id === game.id);
    if (gameLinks.length === 0) {
      return { isLinked: false, linkedLeaguesNames: [] };
    }

    const names = gameLinks.map(lg => {
      const league = userLeagues.find(ul => ul.id === lg.league_id);
      return league?.name || '';
    }).filter(Boolean);

    return { isLinked: true, linkedLeaguesNames: names };
  }, [game.id, leagueGames, userLeagues]);

  if (!game.is_linkable) {
    return null;
  }

  const buttonContent = () => {
    if (loading) {
      return <Loader2 size={16} className="animate-spin" />;
    }
    if (isLinked) {
      return <><Check size={16} /> Linked</>;
    }
    return <><Link size={16} /> Link Game</>;
  };

  const buttonClasses = isLinked
    ? 'bg-lime-glow/20 text-lime-glow'
    : 'bg-navy-accent text-text-secondary hover:bg-white/10';

  return (
    <div className="relative">
      <button
        onClick={() => onLink(game)}
        disabled={loading}
        onMouseEnter={() => isLinked && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`flex-shrink-0 flex items-center justify-center gap-2 font-bold rounded-lg transition-all text-sm py-2 px-4 shadow-lg disabled:opacity-70 ${buttonClasses}`}
      >
        {buttonContent()}
      </button>
      <AnimatePresence>
        {showTooltip && linkedLeaguesNames.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs p-2 bg-deep-navy border border-disabled rounded-lg shadow-xl z-10"
          >
            <p className="text-xs text-text-secondary">
              Linked with: <span className="font-semibold text-text-primary">{linkedLeaguesNames.join(', ')}</span>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
