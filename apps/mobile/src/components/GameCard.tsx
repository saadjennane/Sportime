import React, { useMemo, useState, useEffect } from 'react';
import { SportimeGame, TournamentType, Profile, UserTicket, GameType } from '../types';
import { format, parseISO, isBefore, formatDistanceToNowStrict } from 'date-fns';
import { Calendar, Coins, Gift, ArrowRight, Check, Clock, Users, Ticket, Ban, Star, Trophy, Award, ScrollText, Bell, Flame, Lock } from 'lucide-react';
import { CtaState, calculateEntryDeadline } from '../pages/GamesListPage';
import { normalizeTournamentTier } from '../config/constants';

// =============================================================================
// ENTRY DEADLINE COUNTDOWN COMPONENT
// =============================================================================

interface EntryDeadlineProps {
  deadline: Date;
}

const EntryDeadlineCountdown: React.FC<EntryDeadlineProps> = ({ deadline }) => {
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
        setTimeLeft(`${hours}h ${minutes}min left`)
      } else {
        // < 1h: Show minutes only
        setTimeLeft(`${minutes}min left`)
      }
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 60000) // Update every minute
    return () => clearInterval(interval)
  }, [deadline])

  if (isPast) {
    return null // Will show "Registration closed" on the button instead
  }

  return (
    <div className={`text-xs flex items-center gap-1 ${isUrgent ? 'text-hot-red font-semibold' : 'text-text-secondary'}`}>
      {isCountdownMode && <Clock size={12} />}
      {isCountdownMode ? timeLeft : `Registration until ${timeLeft}`}
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
}

const gameTypeDetails: Record<GameType, { tag: string; color: string }> = {
  betting: { tag: 'Betting', color: 'bg-electric-blue/20 text-electric-blue' },
  prediction: { tag: 'Prediction', color: 'bg-neon-cyan/20 text-neon-cyan' },
  fantasy: { tag: 'Fantasy', color: 'bg-lime-glow/20 text-lime-glow' },
  'fantasy-live': { tag: 'Fantasy Live', color: 'bg-purple-600/20 text-purple-400' },
};

const tournamentTierDetails: Record<TournamentType, { label: string; color: string }> = {
  amateur: { label: 'Amateur', color: 'bg-lime-glow/20 text-lime-glow' },
  master: { label: 'Master', color: 'bg-warm-yellow/20 text-warm-yellow' },
  apex: { label: 'Apex', color: 'bg-hot-red/20 text-hot-red' },
};

export const GameCard: React.FC<GameCardProps> = ({ game, ctaState, onJoinClick, onPlay, onShowRewards, onShowRules, onViewLeaderboard, profile, userTickets }) => {
  const details = gameTypeDetails[game.game_type as keyof typeof gameTypeDetails];
  const normalizedTier = normalizeTournamentTier(game.tier);
  const tierDetails = normalizedTier ? tournamentTierDetails[normalizedTier] : null;

  // Calculate real game status based on dates, not stored status
  // Uses first_kickoff_time (actual match start) instead of start_date (often midnight)
  const realGameStatus = useMemo(() => {
    if (game.status === 'Cancelled') return 'Cancelled';

    const now = new Date();
    const endDate = parseISO(game.end_date);
    // Use first_kickoff_time if available, otherwise fall back to start_date
    const effectiveStart = game.first_kickoff_time
      ? new Date(game.first_kickoff_time)
      : parseISO(game.start_date);

    if (endDate < now) return 'Finished';
    if (effectiveStart <= now && endDate >= now) return 'Ongoing';
    return 'Upcoming';
  }, [game.start_date, game.end_date, game.status, game.first_kickoff_time]);

  // Check if game is live (ongoing status)
  const isLiveGame = realGameStatus === 'Ongoing';

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

  const isCancelled = realGameStatus === 'Cancelled';
  const isJoinDisabled = ctaState === 'JOIN' && !hasTicket && !hasEnoughCoins;
  const isInProgress = ctaState === 'IN_PROGRESS';
  const isLocked = ctaState === 'LOCKED';

  // Calculate entry deadline for countdown display
  const entryDeadline = useMemo(() => calculateEntryDeadline(game), [game]);

  const ctaConfig = {
    JOIN: { onClick: onJoinClick, disabled: isJoinDisabled, style: 'primary', content: joinButtonContent() },
    PLACE_BETS: { text: 'Place your bets', onClick: onPlay, disabled: false, style: 'primary', icon: <ArrowRight size={16} /> },
    MAKE_PREDICTIONS: { text: 'Make your predictions', onClick: onPlay, disabled: false, style: 'primary', icon: <ArrowRight size={16} /> },
    SELECT_TEAM: { text: 'Select your team', onClick: onPlay, disabled: false, style: 'primary', icon: <ArrowRight size={16} /> },
    COMPLETE_TEAM: { text: 'Complete your team', onClick: onPlay, disabled: false, style: 'primary', icon: <ArrowRight size={16} /> },
    AWAITING: { text: 'Awaiting results', onClick: () => {}, disabled: true, style: 'disabled', icon: <Clock size={16} /> },
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

  const startsIn = useMemo(() => {
    if (realGameStatus !== 'Upcoming') return null;
    return formatDistanceToNowStrict(parseISO(game.start_date), { addSuffix: true, unit: 'day' });
  }, [game.start_date, realGameStatus]);

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
            {accessConditionIcons.length > 0 && (
              <div className="flex items-center gap-1 text-warm-yellow" title="Access conditions apply">
                {accessConditionIcons}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {/* Status Badge */}
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${
            isCancelled ? 'bg-hot-red/20 text-hot-red' :
            realGameStatus === 'Upcoming' ? 'bg-electric-blue/20 text-electric-blue' :
            realGameStatus === 'Ongoing' ? 'bg-lime-glow/20 text-lime-glow' : 'bg-disabled text-text-disabled'
          }`}>
            {realGameStatus}
          </span>
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
          {/* Entry Deadline Countdown - only for JOIN state */}
          {ctaState === 'JOIN' && (
            <EntryDeadlineCountdown deadline={entryDeadline} />
          )}

          {/* Registration closed message for LOCKED state */}
          {isLocked && (
            <span className="text-xs text-text-disabled">Registration closed</span>
          )}

          <div className="flex items-center gap-2">
            {startsIn && ctaState === 'NOTIFY' && <span className="text-xs text-text-disabled font-semibold">{startsIn}</span>}

            {/* View Leaderboard button for live games not joined */}
            {isLiveGame && (ctaState === 'IN_PROGRESS' || isLocked) && onViewLeaderboard && (
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
