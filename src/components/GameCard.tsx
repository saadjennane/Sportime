import React, { useMemo } from 'react';
import { Game, TournamentType, Profile, UserTicket } from '../types';
import { format, parseISO, isBefore } from 'date-fns';
import { Calendar, Coins, Info, ArrowRight, Check, Clock, Users, Ticket, ShieldAlert } from 'lucide-react';
import { CtaState } from '../pages/GamesListPage';

interface GameCardProps {
  game: Game;
  ctaState: CtaState;
  onJoinClick: () => void;
  onPlay: () => void;
  onShowRules?: () => void;
  profile: Profile | null;
  userTickets: UserTicket[];
}

const gameTypeDetails = {
  betting: { tag: 'Betting', color: 'bg-electric-blue/20 text-electric-blue' },
  prediction: { tag: 'Prediction', color: 'bg-neon-cyan/20 text-neon-cyan' },
  fantasy: { tag: 'Fantasy', color: 'bg-lime-glow/20 text-lime-glow' },
};

const tournamentTierDetails: Record<TournamentType, { label: string; color: string }> = {
  rookie: { label: 'Rookie', color: 'bg-lime-glow/20 text-lime-glow' },
  pro: { label: 'Pro', color: 'bg-warm-yellow/20 text-warm-yellow' },
  elite: { label: 'Elite', color: 'bg-hot-red/20 text-hot-red' },
};

export const GameCard: React.FC<GameCardProps> = ({ game, ctaState, onJoinClick, onPlay, onShowRules, profile, userTickets }) => {
  const details = gameTypeDetails[game.gameType as keyof typeof gameTypeDetails];
  const tierDetails = game.tournament_type ? tournamentTierDetails[game.tournament_type] : null;

  const { hasTicket, hasEnoughCoins } = useMemo(() => {
    if (!profile || game.gameType !== 'betting') return { hasTicket: false, hasEnoughCoins: false };
    const validTicket = userTickets.find(t => 
      t.user_id === profile.id &&
      t.type === game.tournament_type &&
      !t.is_used &&
      isBefore(new Date(), parseISO(t.expires_at))
    );
    return {
      hasTicket: !!validTicket,
      hasEnoughCoins: profile.coins_balance >= game.entryCost,
    };
  }, [profile, userTickets, game]);

  const joinButtonContent = () => {
    if (!hasTicket && !hasEnoughCoins) {
      return <><ShieldAlert size={16} /> Not enough funds</>;
    }
    if (hasTicket && !hasEnoughCoins) {
      return <><Ticket size={16} className="text-lime-glow" /> Join with Ticket</>;
    }
    if (!hasTicket && hasEnoughCoins) {
      return <><Coins size={16} className="text-warm-yellow" /> Join ({game.entryCost.toLocaleString()})</>;
    }
    // Has both
    return <>Choose Entry Method</>;
  };

  const isJoinDisabled = ctaState === 'JOIN' && !hasTicket && !hasEnoughCoins;

  const ctaConfig = {
    JOIN: { onClick: onJoinClick, disabled: isJoinDisabled, style: 'primary', content: joinButtonContent() },
    PLAY: { text: game.gameType === 'betting' ? 'Place Bets' : 'Make Picks', onClick: onPlay, disabled: false, style: 'primary', icon: <ArrowRight size={16} /> },
    SUBMITTED: { text: game.gameType === 'betting' ? 'Bets Submitted' : 'Picks Submitted', onClick: onPlay, disabled: false, style: 'secondary', icon: <Check size={16} /> },
    AWAITING: { text: 'Matches Awaiting', onClick: () => {}, disabled: true, style: 'disabled', icon: <Clock size={16} /> },
    RESULTS: { text: 'View Results', onClick: onPlay, disabled: false, style: 'primary', icon: <ArrowRight size={16} /> },
    VIEW_TEAM: { text: 'View Team', onClick: onPlay, disabled: false, style: 'primary', icon: <ArrowRight size={16} /> },
  };

  const currentCta = ctaConfig[ctaState];

  const buttonStyles = {
    primary: 'primary-button text-sm py-2 px-4',
    secondary: 'bg-transparent border-2 border-warm-yellow/50 text-warm-yellow hover:bg-warm-yellow/10 text-sm py-2 px-4 rounded-lg',
    disabled: 'bg-disabled text-text-disabled cursor-not-allowed text-sm py-2 px-4 rounded-lg',
  };

  return (
    <div className="card-base p-4 space-y-3 transition-all hover:border-neon-cyan/50">
      {/* Top Section */}
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="text-md font-bold text-text-primary pr-2">{game.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${details.color}`}>
              {details.tag}
            </span>
            {tierDetails && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tierDetails.color}`}>
                {tierDetails.label}
              </span>
            )}
          </div>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${game.status === 'Upcoming' ? 'bg-electric-blue/20 text-electric-blue' : game.status === 'Ongoing' ? 'bg-lime-glow/20 text-lime-glow' : 'bg-disabled text-text-disabled'}`}>
          {game.status}
        </span>
      </div>

      {/* Middle Section - Date & Players */}
      <div className="flex items-center justify-between text-sm text-text-secondary border-t border-white/10 pt-3">
        <div className="flex items-center gap-2">
          <Calendar size={14} />
          <span>{format(parseISO(game.startDate), 'MMM d')} - {format(parseISO(game.endDate), 'MMM d')}</span>
        </div>
        <div className="flex items-center gap-1 text-xs">
          <Users size={14} />
          <span>{game.totalPlayers.toLocaleString()} players</span>
        </div>
      </div>
      
      {/* Bottom Section - Actions */}
      <div className="flex items-center justify-between border-t border-white/10 pt-3 gap-2">
        {onShowRules && (
          <button
            onClick={onShowRules}
            className="flex items-center justify-center gap-2 font-semibold py-2 px-4 rounded-lg transition-all text-sm bg-navy-accent text-text-secondary hover:bg-white/10"
          >
            <Info size={16} />
            Rules
          </button>
        )}
        
        <button 
          onClick={currentCta.onClick} 
          disabled={currentCta.disabled} 
          className={`flex-1 flex items-center justify-center gap-2 font-bold rounded-lg transition-all ${buttonStyles[currentCta.style]}`}
        >
          {ctaState === 'JOIN' ? (
            currentCta.content
          ) : (
            <>
              <span>{currentCta.text}</span>
              {currentCta.icon}
            </>
          )}
        </button>
      </div>
    </div>
  );
};
