import React from 'react';
import { X, Calendar, Users, Coins, Target, Hourglass, ScrollText, CalendarDays, Trophy } from 'lucide-react';
import { SportimeGame, GameType } from '../types';
import { format, parseISO, differenceInDays } from 'date-fns';

interface GameInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  game: SportimeGame | null;
}

const gameTypeLabels: Record<GameType, string> = {
  betting: 'Betting',
  prediction: 'Prediction',
  fantasy: 'Fantasy',
  'fantasy-live': 'Fantasy Live',
};

const gameTypeColors: Record<GameType, string> = {
  betting: 'bg-electric-blue/20 text-electric-blue',
  prediction: 'bg-neon-cyan/20 text-neon-cyan',
  fantasy: 'bg-lime-glow/20 text-lime-glow',
  'fantasy-live': 'bg-purple-600/20 text-purple-400',
};

const tierColors: Record<string, string> = {
  amateur: 'bg-lime-glow/20 text-lime-glow',
  master: 'bg-warm-yellow/20 text-warm-yellow',
  apex: 'bg-hot-red/20 text-hot-red',
};

// Rules par game_type
const rulesByGameType: Record<GameType, string[]> = {
  betting: [
    'Join the Challenge by paying the entry fee',
    'Place your bets on match outcomes using your challenge balance',
    'Bets are locked once the match starts',
    'Winnings = bet amount × odds (if correct)',
    'Player with highest final balance wins!',
  ],
  prediction: [
    'Join the game by paying the entry fee',
    'Swipe left (Home), right (Away), or up (Draw) to predict',
    'Edit your picks anytime before the first match starts',
    'Points = odds × 100 for each correct prediction',
    'Player with most points at end of MatchDay wins!',
  ],
  fantasy: [
    'Build your team within the budget',
    'Choose a Captain - their points are doubled',
    'Use boosters strategically for bonus points',
    'Players earn points based on real performance',
    'Watch live as your team scores points',
    'Submit before the deadline',
    'Highest total points wins!',
  ],
  'fantasy-live': [
    'Build your team within the budget',
    'Choose a Captain - their points are doubled',
    'Use boosters strategically for bonus points',
    'Players earn points based on real performance',
    'Watch live as your team scores points',
    'Submit before the deadline',
    'Highest total points wins!',
  ],
};

export const GameInfoModal: React.FC<GameInfoModalProps> = ({ isOpen, onClose, game }) => {
  if (!isOpen || !game) return null;

  const rules = rulesByGameType[game.game_type] || rulesByGameType.betting;

  // Calculate stats from new fields
  const totalFixtures = game.total_fixtures ?? 0;
  const fixturesPlayed = game.fixtures_played ?? 0;
  const totalMatchdays = game.total_matchdays ?? 0;
  const matchdaysFinished = game.matchdays_finished ?? 0;
  const daysRemaining = game.end_date
    ? Math.max(0, differenceInDays(parseISO(game.end_date), new Date()))
    : null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="relative bg-navy-accent border border-white/10 rounded-3xl w-full max-w-md max-h-[85vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-text-secondary hover:bg-white/20 z-10"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="p-6 pb-4 text-center border-b border-white/10">
          <h2 className="text-xl font-bold text-text-primary mb-2 pr-8">{game.name}</h2>
          {game.league_name && (
            <div className="flex items-center justify-center gap-2 mb-3">
              <Trophy size={14} className="text-warm-yellow" />
              <span className="text-sm text-text-secondary">{game.league_name}</span>
            </div>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${gameTypeColors[game.game_type]}`}>
              {gameTypeLabels[game.game_type]}
            </span>
            {game.period_type && (
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-orange-500/20 text-orange-400">
                {game.period_type === 'matchdays' ? 'Matchdays' : 'Calendar'}
              </span>
            )}
            {game.tier && (
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${tierColors[game.tier] || tierColors.amateur}`}>
                {game.tier.charAt(0).toUpperCase() + game.tier.slice(1)}
              </span>
            )}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="max-h-[60vh] overflow-y-auto">
          {/* Stats */}
          <div className="p-4 border-b border-white/10 space-y-3">
            <div className="flex items-center gap-3 text-text-secondary">
              <Calendar size={18} className="flex-shrink-0" />
              <span>
                {game.start_date ? format(parseISO(game.start_date), 'MMM d') : 'TBD'} - {game.end_date ? format(parseISO(game.end_date), 'MMM d, yyyy') : 'TBD'}
              </span>
            </div>

            {/* Total fixtures progress */}
            {totalFixtures > 0 && (
              <div className="flex items-center gap-3 text-text-secondary">
                <Target size={18} className="flex-shrink-0" />
                <span>{fixturesPlayed}/{totalFixtures} matches</span>
              </div>
            )}

            {/* Matchdays/Days progress */}
            {totalMatchdays > 0 && (
              <div className="flex items-center gap-3 text-text-secondary">
                <CalendarDays size={18} className="flex-shrink-0" />
                <span>
                  {matchdaysFinished}/{totalMatchdays} {game.period_type === 'matchdays' ? 'matchdays' : 'days'}
                </span>
              </div>
            )}

            {daysRemaining !== null && (
              <div className="flex items-center gap-3 text-text-secondary">
                <Hourglass size={18} className="flex-shrink-0" />
                <span>{daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining</span>
              </div>
            )}

            <div className="flex items-center gap-3 text-text-secondary">
              <Users size={18} className="flex-shrink-0" />
              <span>{game.totalPlayers.toLocaleString()} {game.totalPlayers === 1 ? 'player' : 'players'}</span>
            </div>

            <div className="flex items-center gap-3 text-text-secondary">
              <Coins size={18} className="flex-shrink-0" />
              <span>Entry: {game.entry_cost.toLocaleString()} coins</span>
            </div>
          </div>

          {/* Rules */}
          <div className="p-4">
            <h3 className="text-sm font-bold text-text-primary mb-3 flex items-center gap-2">
              <ScrollText size={16} />
              Rules
            </h3>
            <ol className="space-y-2">
              {rules.map((rule, index) => (
                <li key={index} className="flex gap-3 text-sm text-text-secondary">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-electric-blue/20 text-electric-blue flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </span>
                  <span>{rule}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Action */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl font-bold text-white bg-electric-blue hover:bg-electric-blue/90 transition-all"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
};
