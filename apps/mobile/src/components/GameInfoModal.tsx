import React from 'react';
import { X, Calendar, Users, Coins, Target, Hourglass, ScrollText, CalendarDays, Trophy, ShieldCheck, Star, Award, Crown, Ticket } from 'lucide-react';
import { SportimeGame, GameType, Challenge } from '../types';
import { format, parseISO, differenceInDays } from 'date-fns';

// Minimal challenge interface for SwipeRecapView (uses snake_case)
interface SwipeChallenge {
  id: string;
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  status: string;
  period_type?: 'matchdays' | 'calendar';
}

// Union type for SportimeGame (catalog), Challenge (betting room), and SwipeChallenge (swipe room)
type GameInfo = SportimeGame | Challenge | SwipeChallenge;

interface GameInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  game: GameInfo | null;
}

// Helper to normalize game data (Challenge uses camelCase, SportimeGame uses snake_case)
// SwipeRecapView passes a minimal challenge object with snake_case dates
function normalizeGame(game: GameInfo): {
  name: string;
  start_date: string;
  end_date: string;
  entry_cost: number;
  totalPlayers: number;
  game_type: GameType;
  period_type?: 'matchdays' | 'calendar';
  tier?: string;
  league_name?: string;
  total_fixtures?: number;
  fixtures_played?: number;
  total_matchdays?: number;
  matchdays_finished?: number;
  minimum_level?: string;
  required_badges?: string[];
  requires_subscription?: boolean;
} {
  // Check if it's a Challenge from ChallengeRoomPage (has startDate in camelCase)
  if ('startDate' in game) {
    // It's a Challenge (betting game)
    return {
      name: game.name,
      start_date: game.startDate,
      end_date: game.endDate,
      entry_cost: game.entryCost,
      totalPlayers: game.totalPlayers,
      game_type: 'betting', // Challenges in ChallengeRoomPage are always betting
      period_type: game.period_type,
      tier: undefined,
      league_name: undefined,
      total_fixtures: undefined,
      fixtures_played: undefined,
      total_matchdays: undefined,
      matchdays_finished: undefined,
    };
  }

  // It's a SportimeGame or SwipeRecapView challenge (both use snake_case)
  // SwipeRecapView challenge doesn't have game_type, entry_cost, or totalPlayers
  const g = game as SportimeGame;
  return {
    name: g.name,
    start_date: g.start_date,
    end_date: g.end_date,
    entry_cost: g.entry_cost ?? 0,
    totalPlayers: g.totalPlayers ?? 0,
    game_type: g.game_type ?? 'prediction', // SwipeRecapView is always prediction
    period_type: g.period_type,
    tier: g.tier,
    league_name: g.league_name,
    total_fixtures: g.total_fixtures,
    fixtures_played: g.fixtures_played,
    total_matchdays: g.total_matchdays,
    matchdays_finished: g.matchdays_finished,
    minimum_level: g.minimum_level,
    required_badges: g.required_badges,
    requires_subscription: g.requires_subscription,
  };
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

  // Normalize game data to handle both SportimeGame and Challenge
  const normalizedGame = normalizeGame(game);

  const rules = rulesByGameType[normalizedGame.game_type] || rulesByGameType.betting;

  // Calculate stats from normalized fields
  const totalFixtures = normalizedGame.total_fixtures ?? 0;
  const fixturesPlayed = normalizedGame.fixtures_played ?? 0;
  const totalMatchdays = normalizedGame.total_matchdays ?? 0;
  const matchdaysFinished = normalizedGame.matchdays_finished ?? 0;
  const daysRemaining = normalizedGame.end_date
    ? Math.max(0, differenceInDays(parseISO(normalizedGame.end_date), new Date()))
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
          <h2 className="text-xl font-bold text-text-primary mb-2 pr-8">{normalizedGame.name}</h2>
          {normalizedGame.league_name && (
            <div className="flex items-center justify-center gap-2 mb-3">
              <Trophy size={14} className="text-warm-yellow" />
              <span className="text-sm text-text-secondary">{normalizedGame.league_name}</span>
            </div>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${gameTypeColors[normalizedGame.game_type]}`}>
              {gameTypeLabels[normalizedGame.game_type]}
            </span>
            {normalizedGame.period_type && (
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-orange-500/20 text-orange-400">
                {normalizedGame.period_type === 'matchdays' ? 'Matchdays' : 'Calendar'}
              </span>
            )}
            {normalizedGame.tier && (
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${tierColors[normalizedGame.tier] || tierColors.amateur}`}>
                {normalizedGame.tier.charAt(0).toUpperCase() + normalizedGame.tier.slice(1)}
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
                {normalizedGame.start_date ? format(parseISO(normalizedGame.start_date), 'MMM d') : 'TBD'} - {normalizedGame.end_date ? format(parseISO(normalizedGame.end_date), 'MMM d, yyyy') : 'TBD'}
              </span>
            </div>

            {/* Total fixtures progress */}
            {totalFixtures > 0 && (
              <div className="flex items-center gap-3 text-text-secondary">
                <Target size={18} className="flex-shrink-0" />
                <span>{fixturesPlayed}/{totalFixtures} matches</span>
              </div>
            )}

            {/* Matchdays progress - for matchdays period type */}
            {normalizedGame.period_type === 'matchdays' && totalMatchdays > 0 && (
              <div className="flex items-center gap-3 text-text-secondary">
                <CalendarDays size={18} className="flex-shrink-0" />
                <span>{matchdaysFinished}/{totalMatchdays} matchdays</span>
              </div>
            )}

            {/* Days remaining - for calendar period type or when no matchday info */}
            {normalizedGame.period_type !== 'matchdays' && daysRemaining !== null && (
              <div className="flex items-center gap-3 text-text-secondary">
                <Hourglass size={18} className="flex-shrink-0" />
                <span>{daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining</span>
              </div>
            )}

            <div className="flex items-center gap-3 text-text-secondary">
              <Users size={18} className="flex-shrink-0" />
              <span>{normalizedGame.totalPlayers.toLocaleString()} {normalizedGame.totalPlayers === 1 ? 'player' : 'players'}</span>
            </div>

            <div className="flex items-center gap-3 text-text-secondary">
              <Coins size={18} className="flex-shrink-0" />
              <span>Entry: {normalizedGame.entry_cost.toLocaleString()} coins</span>
            </div>
          </div>

          {/* Requirements / eligibility */}
          <div className="p-4 border-t border-white/10">
            <h3 className="text-sm font-bold text-text-primary mb-3 flex items-center gap-2">
              <ShieldCheck size={16} /> Requirements
            </h3>
            <ul className="space-y-2 text-sm text-text-secondary">
              <li className="flex items-center gap-2">
                <Coins size={14} className="text-warm-yellow flex-shrink-0" />
                <span>{normalizedGame.entry_cost.toLocaleString()} coins{normalizedGame.tier ? <> <span className="text-text-disabled">or</span> a <span className="capitalize text-text-primary font-semibold">{normalizedGame.tier}</span> <Ticket size={13} className="inline -mt-0.5" /> ticket</> : ''}</span>
              </li>
              <li className="flex items-center gap-2">
                <Star size={14} className="text-electric-blue flex-shrink-0" />
                <span>Min. level: <span className="font-semibold text-text-primary">{normalizedGame.minimum_level || 'Rookie'}</span></span>
              </li>
              {(normalizedGame.required_badges?.length ?? 0) > 0 && (
                <li className="flex items-center gap-2">
                  <Award size={14} className="text-lime-glow flex-shrink-0" />
                  <span>{normalizedGame.required_badges!.length} badge{normalizedGame.required_badges!.length > 1 ? 's' : ''} required</span>
                </li>
              )}
              {normalizedGame.requires_subscription && (
                <li className="flex items-center gap-2">
                  <Crown size={14} className="text-warm-yellow flex-shrink-0" />
                  <span>Subscribers only</span>
                </li>
              )}
            </ul>
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
