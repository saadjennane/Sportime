import React, { useMemo, useState, useEffect } from 'react';
import { SportimeGame, TournamentType, Profile, UserTicket, GameType, UserChallengeEntry, UserSwipeEntry } from '../types';
import { format, parseISO, isBefore } from 'date-fns';
import { Calendar, Coins, Gift, ArrowRight, Clock, Users, Ticket, Star, Trophy, Award, ScrollText, Flame, Lock, CheckCircle2, CircleDot } from 'lucide-react';
import { CtaState, calculateEntryDeadline } from '../pages/GamesListPage';
import { normalizeTournamentTier } from '../config/constants';
import { getGameDeadline } from '../services/gameStateService';

// =============================================================================
// ENTRY DEADLINE COUNTDOWN COMPONENT
// =============================================================================

interface EntryDeadlineProps {
  deadline: Date;
  label?: 'registration' | 'deadline';
}

const EntryDeadlineCountdown: React.FC<EntryDeadlineProps> = ({ deadline, label = 'registration' }) => {
  const [timeLeft, setTimeLeft] = useState<string>('')
  const [isUrgent, setIsUrgent] = useState(false)
  const [isPast, setIsPast] = useState(false)
  const [isCountdownMode, setIsCountdownMode] = useState(false)

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date()
      const diff = deadline.getTime() - now.getTime()

      if (diff <= 0) {
        setIsPast(true)
        setTimeLeft('')
        return
      }

      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

      setIsUrgent(hours < 1)
      setIsCountdownMode(hours < 24)

      if (hours >= 24) {
        // > 24h: Show date
        setTimeLeft(deadline.toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
        }))
      } else if (hours >= 1) {
        // 1-24h: Show countdown
        setTimeLeft(`${hours}h ${minutes}min`)
      } else {
        // < 1h: Show minutes only
        setTimeLeft(`${minutes}min`)
      }
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 60000) // Update every minute
    return () => clearInterval(interval)
  }, [deadline])

  if (isPast) {
    return null // Will show "Registration closed" on the button instead
  }

  const labelText = label === 'registration' ? 'Registration closes' : 'Deadline'

  return (
    <div className={`text-xs flex items-center gap-1 ${isUrgent ? 'text-hot-red font-semibold' : 'text-text-secondary'}`}>
      {isCountdownMode && <Clock size={12} />}
      {isCountdownMode ? `${labelText} in ${timeLeft}` : `${labelText} ${timeLeft}`}
    </div>
  )
}

interface GameCardProps {
  game: SportimeGame;
  ctaState: CtaState;
  onJoinClick: () => void;
  onPlay: () => void;
  onShowRewards: () => void;
  onShowRules: () => void;
  onViewLeaderboard?: () => void;
  profile: Profile | null;
  userTickets: UserTicket[];
  userEntry?: UserChallengeEntry;   // For betting/prediction games
  userSwipeEntry?: UserSwipeEntry;  // For swipe games
}

// =============================================================================
// PROGRESS STATUS CALCULATION
// =============================================================================

type ProgressStatus = 'none' | 'partial' | 'complete';

function getProgressStatus(
  game: SportimeGame,
  userEntry?: UserChallengeEntry,
  userSwipeEntry?: UserSwipeEntry
): ProgressStatus {
  // Betting/Prediction games - check if 1000 coins are bet for current matchday
  if (game.game_type === 'betting' || game.game_type === 'prediction') {
    if (!userEntry || userEntry.dailyEntries.length === 0) return 'none';

    // Check current matchday's bets (last entry = current day)
    const currentDayEntry = userEntry.dailyEntries[userEntry.dailyEntries.length - 1];
    if (!currentDayEntry || currentDayEntry.bets.length === 0) return 'none';

    const totalBet = currentDayEntry.bets.reduce((sum, b) => sum + b.amount, 0);
    if (totalBet >= 1000) return 'complete';
    return 'partial';
  }

  // Swipe games - check if all predictions are made
  if (game.game_type === 'swipe') {
    if (!userSwipeEntry || userSwipeEntry.predictions.length === 0) return 'none';

    const totalMatches = game.matches?.length || 0;
    if (totalMatches === 0) return 'none';

    if (userSwipeEntry.predictions.length >= totalMatches) return 'complete';
    return 'partial';
  }

  return 'none';
}

const gameTypeDetails: Record<GameType, { tag: string; color: string }> = {
  betting: { tag: 'Betting', color: 'bg-electric-blue/20 text-electric-blue' },
  prediction: { tag: 'Prediction', color: 'bg-neon-cyan/20 text-neon-cyan' },
  fantasy: { tag: 'Fantasy', color: 'bg-lime-glow/20 text-lime-glow' },
  'fantasy-live': { tag: 'Fantasy Live', color: 'bg-purple-600/20 text-purple-400' },
};

const periodTypeDetails: Record<'matchdays' | 'calendar', { tag: string; color: string }> = {
  matchdays: { tag: 'Matchdays', color: 'bg-orange-500/20 text-orange-400' },
  calendar: { tag: 'Calendar', color: 'bg-indigo-500/20 text-indigo-400' },
};

const tournamentTierDetails: Record<TournamentType, { label: string; color: string }> = {
  amateur: { label: 'Amateur', color: 'bg-lime-glow/20 text-lime-glow' },
  master: { label: 'Master', color: 'bg-warm-yellow/20 text-warm-yellow' },
  apex: { label: 'Apex', color: 'bg-hot-red/20 text-hot-red' },
};

export const GameCard: React.FC<GameCardProps> = ({ game, ctaState, onJoinClick, onPlay, onShowRewards, onShowRules, onViewLeaderboard, profile, userTickets, userEntry, userSwipeEntry }) => {
  // Calculate progress status for the badge
  const progressStatus = useMemo(() => getProgressStatus(game, userEntry, userSwipeEntry), [game, userEntry, userSwipeEntry]);
  const details = gameTypeDetails[game.game_type as keyof typeof gameTypeDetails];
  const normalizedTier = normalizeTournamentTier(game.tier);
  const tierDetails = normalizedTier ? tournamentTierDetails[normalizedTier] : null;
  const periodDetails = game.period_type ? periodTypeDetails[game.period_type] : null;


  // Check if first match has started (for showing leaderboard to non-participants)
  const hasFirstMatchStarted = useMemo(() => {
    if (game.first_kickoff_time) {
      return new Date(game.first_kickoff_time) <= new Date();
    }
    return false;
  }, [game.first_kickoff_time]);

  const { hasTicket, hasEnoughCoins } = useMemo(() => {
    if (!profile) return { hasTicket: false, hasEnoughCoins: false };
    const validTicket = userTickets.find(t => 
      t.user_id === profile.id &&
      t.type === normalizedTier &&
      !t.is_used &&
      isBefore(new Date(), parseISO(t.expires_at))
    );
    return {
      hasTicket: !!validTicket,
      hasEnoughCoins: profile.coins_balance >= game.entry_cost,
    };
  }, [profile, userTickets, game, normalizedTier]);

  const joinButtonContent = () => {
    if (!hasTicket && !hasEnoughCoins) {
      return <>Not enough funds</>;
    }
    if (hasTicket && !hasEnoughCoins) {
      return <><Ticket size={16} className="text-lime-glow" /> Join with Ticket</>;
    }
    if (!hasTicket && hasEnoughCoins) {
      return <><Coins size={16} className="text-warm-yellow" /> Join ({game.entry_cost.toLocaleString()})</>;
    }
    // Has both
    return <>Choose Entry</>;
  };

  const isCancelled = game.status === 'Cancelled';
  const isJoinDisabled = ctaState === 'JOIN' && !hasTicket && !hasEnoughCoins;
  const isInProgress = ctaState === 'IN_PROGRESS';
  const isLocked = ctaState === 'LOCKED';

  // Calculate entry deadline for countdown display
  const entryDeadline = useMemo(() => calculateEntryDeadline(game), [game]);

  // Get the matchday-specific deadline for all game types (betting, prediction, fantasy)
  const gameDeadline = useMemo(() => {
    return getGameDeadline(game, undefined, undefined, new Date());
  }, [game]);

  const ctaConfig = {
    JOIN: { onClick: onJoinClick, disabled: isJoinDisabled, style: 'primary', content: joinButtonContent() },
    PLACE_BETS: { text: 'Place your bets', onClick: onPlay, disabled: false, style: 'primary', icon: <ArrowRight size={16} /> },
    MAKE_PREDICTIONS: { text: 'Make your predictions', onClick: onPlay, disabled: false, style: 'primary', icon: <ArrowRight size={16} /> },
    SELECT_TEAM: { text: 'Select your team', onClick: onPlay, disabled: false, style: 'primary', icon: <ArrowRight size={16} /> },
    COMPLETE_TEAM: { text: 'Complete your team', onClick: onPlay, disabled: false, style: 'primary', icon: <ArrowRight size={16} /> },
    AWAITING: { text: 'View Game', onClick: onPlay, disabled: false, style: 'secondary', icon: <Clock size={16} /> },
    RESULTS: { text: 'View Results', onClick: onPlay, disabled: false, style: 'primary', icon: <ArrowRight size={16} /> },
    IN_PROGRESS: { text: 'Live Now (Can\'t Join)', onClick: () => {}, disabled: true, style: 'disabled', icon: <Flame size={16} /> },
    LOCKED: { text: 'Locked', onClick: () => {}, disabled: true, style: 'locked', icon: <Lock size={16} /> },
  };

  const currentCta = ctaConfig[ctaState];

  const buttonStyles: Record<string, string> = {
    primary: 'primary-button text-sm py-2 px-4',
    secondary: 'bg-transparent border-2 border-warm-yellow/50 text-warm-yellow hover:bg-warm-yellow/10 text-sm py-2 px-4 rounded-lg',
    disabled: 'bg-disabled text-text-disabled cursor-not-allowed text-sm py-2 px-4 rounded-lg',
    locked: 'bg-gray-600/50 text-gray-400 cursor-not-allowed text-sm py-2 px-4 rounded-lg border border-gray-500/30',
  };

  const accessConditionIcons = [
    game.requires_subscription && <Star key="sub" size={14} title="Subscriber only" />,
    game.minimum_level !== 'Amateur' && <Trophy key="level" size={14} title={`Level ${game.minimum_level}+`} />,
    game.required_badges && game.required_badges.length > 0 && <Award key="badge" size={14} title={`Requires ${game.required_badges.length} badge(s)`} />,
  ].filter(Boolean);


  return (
    <div className={`card-base p-4 space-y-3 transition-all hover:border-neon-cyan/50 ${isCancelled || isInProgress || isLocked ? 'opacity-60' : ''}`}>
      {/* Top Section */}
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="text-md font-bold text-text-primary pr-2">{game.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            {details && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${details.color}`}>
                {details.tag}
              </span>
            )}
            {tierDetails && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tierDetails.color}`}>
                {tierDetails.label}
              </span>
            )}
            {periodDetails && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${periodDetails.color}`}>
                {periodDetails.tag}
              </span>
            )}
            {accessConditionIcons.length > 0 && (
              <div className="flex items-center gap-1 text-warm-yellow" title="Access conditions apply">
                {accessConditionIcons}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {isCancelled && (
        <div className="text-center text-hot-red font-semibold text-sm border-t border-white/10 pt-3">
          Your entry has been refunded.
        </div>
      )}

      {/* Middle Section - Date & Players */}
      <div className="flex items-center justify-between text-sm text-text-secondary border-t border-white/10 pt-3">
        <div className="flex items-center gap-2">
          <Calendar size={14} />
          <span>
            {game.start_date ? format(parseISO(game.start_date), 'MMM d') : 'TBD'} - {game.end_date ? format(parseISO(game.end_date), 'MMM d') : 'TBD'}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs">
          <Users size={14} />
          <span>{game.totalPlayers.toLocaleString()} players</span>
        </div>
      </div>
      
      {/* Bottom Section - Actions */}
      <div className={`flex items-center justify-between border-t border-white/10 pt-3 gap-2 ${isCancelled ? 'hidden' : ''}`}>
        <div className="flex items-center gap-2">
          {game.rewards && game.rewards.length > 0 && (
            <button
              onClick={onShowRewards}
              className="flex items-center justify-center p-2 rounded-lg transition-all bg-navy-accent text-text-secondary hover:bg-white/10"
              title="View Rewards"
            >
              <Gift size={20} />
            </button>
          )}
          <button
            onClick={onShowRules}
            className="flex items-center justify-center p-2 rounded-lg transition-all bg-navy-accent text-text-secondary hover:bg-white/10"
            title="View Rules"
          >
            <ScrollText size={20} />
          </button>
        </div>

        <div className="flex-1 flex flex-col items-end gap-1">
          {/* Entry Deadline Countdown - for JOIN state (Browse) */}
          {ctaState === 'JOIN' && (
            <EntryDeadlineCountdown deadline={entryDeadline} label="registration" />
          )}
          {/* Deadline Countdown - for My Games (all active states) */}
          {['PLACE_BETS', 'MAKE_PREDICTIONS', 'SELECT_TEAM', 'COMPLETE_TEAM'].includes(ctaState) && gameDeadline && (
            <EntryDeadlineCountdown deadline={gameDeadline} label="deadline" />
          )}

          {/* Registration closed message for LOCKED state */}
          {isLocked && (
            <span className="text-xs text-text-disabled">Registration closed</span>
          )}

          <div className="flex items-center gap-2">
            {/* Progress Status Badge - only show for active game states */}
            {['PLACE_BETS', 'MAKE_PREDICTIONS', 'SELECT_TEAM', 'COMPLETE_TEAM'].includes(ctaState) && progressStatus === 'complete' && (
              <span className="flex items-center gap-1 text-xs font-medium text-lime-glow bg-lime-glow/10 px-2 py-1 rounded-lg">
                <CheckCircle2 size={14} />
                Ready
              </span>
            )}
            {['PLACE_BETS', 'MAKE_PREDICTIONS', 'SELECT_TEAM', 'COMPLETE_TEAM'].includes(ctaState) && progressStatus === 'partial' && (
              <span className="flex items-center gap-1 text-xs font-medium text-warm-yellow bg-warm-yellow/10 px-2 py-1 rounded-lg">
                <CircleDot size={14} />
                In progress
              </span>
            )}

            {/* View Leaderboard button for games where first match has started and user hasn't joined */}
            {hasFirstMatchStarted && isLocked && onViewLeaderboard && (
              <button
                onClick={onViewLeaderboard}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all bg-warm-yellow/20 text-warm-yellow hover:bg-warm-yellow/30 border border-warm-yellow/50"
              >
                <Trophy size={16} />
                <span>View Leaderboard</span>
              </button>
            )}

            <button
              onClick={currentCta.onClick}
              disabled={currentCta.disabled}
              className={`flex items-center justify-center gap-2 font-bold rounded-lg transition-all ${buttonStyles[currentCta.style]}`}
            >
              {ctaState === 'JOIN' ? (
                currentCta.content
              ) : (
                <>
                  {currentCta.icon}
                  <span>{currentCta.text}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
