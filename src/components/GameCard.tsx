import React from 'react';
import { Game } from '../types';
import { format, parseISO } from 'date-fns';
import { Calendar, Coins, Info, ArrowRight, Check, Clock, Users } from 'lucide-react';
import { CtaState } from '../pages/GamesListPage';

interface GameCardProps {
  game: Game;
  ctaState: CtaState;
  onJoin: () => void;
  onPlay: () => void;
  onShowRules?: () => void;
}

const gameTypeDetails = {
  betting: { tag: 'Betting', color: 'bg-purple-200 text-purple-800' },
  prediction: { tag: 'Prediction', color: 'bg-blue-200 text-blue-800' },
  fantasy: { tag: 'Fantasy', color: 'bg-emerald-200 text-emerald-800' },
};

export const GameCard: React.FC<GameCardProps> = ({ game, ctaState, onJoin, onPlay, onShowRules }) => {
  const details = gameTypeDetails[game.gameType as keyof typeof gameTypeDetails];

  const ctaConfig = {
    JOIN: { onClick: onJoin, disabled: game.status !== 'Upcoming', style: 'primary' },
    PLAY: { text: game.gameType === 'betting' ? 'Place Bets' : 'Make Picks', onClick: onPlay, disabled: false, style: 'primary', icon: <ArrowRight size={16} /> },
    SUBMITTED: { text: game.gameType === 'betting' ? 'Bets Submitted' : 'Picks Submitted', onClick: onPlay, disabled: false, style: 'secondary', icon: <Check size={16} /> },
    AWAITING: { text: 'Matches Awaiting', onClick: () => {}, disabled: true, style: 'disabled', icon: <Clock size={16} /> },
    RESULTS: { text: 'View Results', onClick: onPlay, disabled: false, style: 'primary', icon: <ArrowRight size={16} /> },
    VIEW_TEAM: { text: 'View Team', onClick: onPlay, disabled: false, style: 'primary', icon: <ArrowRight size={16} /> },
  };

  const currentCta = ctaConfig[ctaState];

  const buttonStyles = {
    primary: 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md hover:shadow-lg',
    secondary: 'bg-transparent border-2 border-purple-300 text-purple-700 hover:bg-purple-50',
    disabled: 'bg-gray-200 text-gray-500 cursor-not-allowed',
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-4 space-y-3 transition-all hover:shadow-xl">
      {/* Top Section */}
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="text-md font-bold text-gray-800 pr-2">{game.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${details.color}`}>
              {details.tag}
            </span>
          </div>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${game.status === 'Upcoming' ? 'bg-blue-100 text-blue-800' : game.status === 'Ongoing' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}>
          {game.status}
        </span>
      </div>

      {/* Middle Section - Date & Players */}
      <div className="flex items-center justify-between text-sm text-gray-500 border-t border-gray-100 pt-3">
        <div className="flex items-center gap-2">
          <Calendar size={14} />
          <span>{format(parseISO(game.startDate), 'MMM d')} - {format(parseISO(game.endDate), 'MMM d')}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Users size={14} />
          <span>{game.totalPlayers.toLocaleString()} players</span>
        </div>
      </div>
      
      {/* Bottom Section - Actions */}
      <div className="flex items-center justify-between border-t border-gray-100 pt-3 gap-2">
        {onShowRules && (
          <button
            onClick={onShowRules}
            className="flex items-center justify-center gap-2 font-semibold py-2 px-4 rounded-lg transition-all text-sm bg-gray-100 text-gray-600 hover:bg-gray-200"
          >
            <Info size={16} />
            Rules
          </button>
        )}
        
        <button 
          onClick={currentCta.onClick} 
          disabled={currentCta.disabled} 
          className={`flex-1 flex items-center justify-center gap-2 font-bold py-2 px-4 rounded-lg transition-all text-sm ${buttonStyles[currentCta.style]}`}
        >
          {ctaState === 'JOIN' ? (
            <>
              <span className="font-bold">{game.entryCost}</span>
              <Coins size={16} className="text-amber-300" />
              <span>to Join</span>
            </>
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
