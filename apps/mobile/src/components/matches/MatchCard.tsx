import React from 'react';
import { Match, Bet } from '../../types';
import { Clock, TrendingUp, CheckCircle2, XCircle, BarChart2, Zap } from 'lucide-react';

interface BetButtonProps {
  prediction: 'teamA' | 'draw' | 'teamB';
  odds?: number;
  label: string;
  isSelected: boolean;
  won: boolean;
  lost: boolean;
  isDisabled: boolean;
  styling: string;
  onBet?: (prediction: 'teamA' | 'draw' | 'teamB', odds?: number) => void;
  winAmount?: number;
  lostAmount?: number;
}

const BetButton: React.FC<BetButtonProps> = ({
  prediction,
  odds,
  label,
  isSelected,
  won,
  lost,
  isDisabled,
  styling,
  onBet,
  winAmount,
  lostAmount,
}) => {
  const displayOdds = odds !== undefined ? `${odds.toFixed(2)}x` : '--';

  return (
    <button
      onClick={() => !isDisabled && onBet && onBet(prediction, odds)}
      disabled={isDisabled}
      className={`flex-1 p-3 rounded-xl border-2 transition-all duration-300 ${styling} ${isDisabled ? 'cursor-not-allowed opacity-60' : ''}`}
    >
      <div className="text-center">
        <div className="text-xs text-text-secondary mb-1 font-medium">{label}</div>
        <div className={`text-xl font-bold ${
          won ? 'text-lime-glow' : lost ? 'text-hot-red' : 'text-text-primary'
        }`}>
          {displayOdds}
        </div>
        {won && winAmount !== undefined && (
          <div className="text-xs text-lime-glow font-semibold mt-1 flex items-center justify-center gap-1">
            <CheckCircle2 size={14} /> +{winAmount.toFixed(0)}
          </div>
        )}
        {lost && lostAmount !== undefined && (
          <div className="text-xs text-hot-red font-semibold mt-1 flex items-center justify-center gap-1">
            <XCircle size={14} /> -{lostAmount}
          </div>
        )}
      </div>
    </button>
  );
};

interface MatchCardProps {
  match: Match;
  onBet?: (prediction: 'teamA' | 'draw' | 'teamB', odds: number) => void;
  onViewStats?: () => void;
  onPlayGame?: (matchId: string, matchName: string) => void;
  userBet?: Bet;
}

// Statuses that should be treated as postponed/cancelled (no Live Game button)
const POSTPONED_STATUSES = ['PST', 'POST', 'CANC', 'ABD', 'AWD', 'WO', 'TBD', 'SUSP'];

export const MatchCard: React.FC<MatchCardProps> = ({ match, onBet, onViewStats, onPlayGame, userBet }) => {
  const rawStatusUpper = match.rawStatus?.toUpperCase() || '';
  const isPostponed = POSTPONED_STATUSES.includes(rawStatusUpper);
  const isLive = !!match.isLive && !isPostponed;
  const isUpcoming = match.status === 'upcoming' && !isLive && !isPostponed;
  const betPlaced = !!userBet;

  const getResultStyling = (prediction: 'teamA' | 'draw' | 'teamB') => {
    if (isUpcoming) {
      return betPlaced && userBet?.prediction === prediction
        ? 'border-electric-blue bg-electric-blue/10'
        : 'border-disabled bg-deep-navy hover:border-electric-blue hover:shadow-lg hover:scale-105';
    }
    if (isLive) {
      return 'border-hot-red/40 bg-hot-red/5 cursor-not-allowed';
    }
    // Played match styling
    const isCorrectPrediction = match.result === prediction;
    if (betPlaced && userBet?.prediction === prediction) {
      return isCorrectPrediction ? 'border-lime-glow bg-lime-glow/10' : 'border-hot-red bg-hot-red/10';
    }
    if (isCorrectPrediction) {
      return 'border-lime-glow/50 bg-lime-glow/5';
    }
    return 'border-disabled bg-navy-accent cursor-not-allowed';
  };

  const renderTeamAvatar = (team: Match['teamA']) => {
    if (team.logo) {
      return (
        <div className="mx-auto w-14 h-14 mb-2 rounded-full bg-white/10 flex items-center justify-center">
          <img
            src={team.logo}
            alt={team.name}
            className="w-12 h-12 object-contain"
          />
        </div>
      );
    }
    return (
      <div className="mx-auto w-14 h-14 mb-2 flex items-center justify-center rounded-full bg-white/10 text-2xl font-bold text-electric-blue">
        {(team.emoji && team.emoji.length === 1) ? team.emoji : (team.name?.charAt(0).toUpperCase() || '?')}
      </div>
    );
  };

  // Get display label for finished match status
  const getFinishedStatusLabel = () => {
    const raw = match.rawStatus?.toUpperCase();
    if (raw === 'FT') return 'FT';
    if (raw === 'AET') return 'AET'; // After Extra Time
    if (raw === 'PEN') return 'PEN'; // Penalties
    if (raw === 'AWD' || raw === 'AWARDED') return 'AWD';
    if (raw === 'WO' || raw === 'W.O') return 'W/O'; // Walkover
    if (raw === 'ABD') return 'ABD'; // Abandoned
    if (raw === 'CANC') return 'CANC'; // Cancelled
    if (raw === 'POST' || raw === 'PST') return 'POST'; // Postponed
    return 'FT'; // Default to FT for finished matches
  };

  // Get display label for live match status (1H, HT, 2H, ET, PEN)
  const getLiveStatusLabel = () => {
    const raw = match.rawStatus?.toUpperCase();
    if (!raw) return 'Live';
    if (raw === '1H') return '1H';
    if (raw === 'HT') return 'HT';
    if (raw === '2H') return '2H';
    if (raw === 'ET') return 'ET';
    if (raw === 'P' || raw === 'PEN') return 'PEN';
    if (raw === 'BT') return 'BT'; // Break Time
    return 'Live'; // Fallback
  };

  const badgeContent = (() => {
    if (isLive) {
      return (
        <span className="text-white text-xs px-3 py-1 rounded-full font-semibold bg-gradient-to-r from-hot-red to-electric-blue animate-pulse">
          {getLiveStatusLabel()}
        </span>
      );
    }
    if (isPostponed) {
      return (
        <span className="bg-warm-yellow/20 text-warm-yellow text-xs px-3 py-1 rounded-full font-semibold">
          Postponed
        </span>
      );
    }
    if (!isUpcoming) {
      return (
        <span className="bg-disabled text-text-disabled text-xs px-3 py-1 rounded-full font-semibold">
          {getFinishedStatusLabel()}
        </span>
      );
    }
    if (betPlaced) {
      return (
        <span className="text-white text-xs px-3 py-1 rounded-full font-semibold bg-gradient-to-r from-electric-blue to-neon-cyan">
          Bet Placed
        </span>
      );
    }
    return (
      <span className="bg-disabled text-text-secondary text-xs px-3 py-1 rounded-full font-semibold">
        Upcoming
      </span>
    );
  })();

  const teamAOdds = match.odds?.teamA && match.odds.teamA > 0 ? match.odds.teamA : undefined;
  const drawOdds = match.odds?.draw && match.odds.draw > 0 ? match.odds.draw : undefined;
  const teamBOdds = match.odds?.teamB && match.odds.teamB > 0 ? match.odds.teamB : undefined;
  const showScore = isLive || match.status === 'played';
  const cardHoverClass = isUpcoming ? 'hover:border-neon-cyan/50' : isLive ? 'border-hot-red/40' : '';

  // Pre-calculate bet button props
  const isDisabled = !isUpcoming || isLive;
  const isSelectedTeamA = userBet?.prediction === 'teamA';
  const isSelectedDraw = userBet?.prediction === 'draw';
  const isSelectedTeamB = userBet?.prediction === 'teamB';
  const wonTeamA = userBet?.status === 'won' && isSelectedTeamA;
  const wonDraw = userBet?.status === 'won' && isSelectedDraw;
  const wonTeamB = userBet?.status === 'won' && isSelectedTeamB;
  const lostTeamA = userBet?.status === 'lost' && isSelectedTeamA;
  const lostDraw = userBet?.status === 'lost' && isSelectedDraw;
  const lostTeamB = userBet?.status === 'lost' && isSelectedTeamB;

  return (
    <div className={`card-base p-5 transition-all duration-300 ${cardHoverClass}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-text-secondary">
          <Clock className="w-4 h-4" />
          <span className="text-sm font-medium">{match.kickoffTime}</span>
        </div>
        {badgeContent}
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex-1 text-center">
          {renderTeamAvatar(match.teamA)}
          <div className="text-sm font-semibold text-text-primary">{match.teamA.name}</div>
        </div>

        <div className="px-4 text-center">
          {showScore ? (
            <div className="flex flex-col items-center">
              <div className={`text-2xl font-bold ${isLive ? 'text-hot-red' : 'text-text-primary'}`}>
                {match.score?.teamA ?? 0} - {match.score?.teamB ?? 0}
              </div>
              {isLive && match.elapsedMinutes && (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-hot-red/80">
                  {match.elapsedMinutes}'
                </span>
              )}
            </div>
          ) : (
            <div className="text-2xl font-bold text-disabled">VS</div>
          )}
        </div>

        <div className="flex-1 text-center">
          {renderTeamAvatar(match.teamB)}
          <div className="text-sm font-semibold text-text-primary">{match.teamB.name}</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-electric-blue" />
            <span className="text-xs font-semibold text-text-secondary uppercase">
              {isPostponed ? 'Match Postponed' : isUpcoming ? 'Place Your Bet' : isLive ? 'Match In Progress' : 'Final Odds'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {onViewStats && (
              <button onClick={onViewStats} className="relative flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-electric-blue">
                <BarChart2 size={16} />
                Stats
                {match.hasLineup && (
                  <span className="absolute -top-1 -right-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime-glow opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-lime-glow"></span>
                  </span>
                )}
              </button>
            )}
             {onPlayGame && (isUpcoming || isLive) && (
              <button onClick={() => onPlayGame(match.id, `${match.teamA.name} vs ${match.teamB.name}`)} className={`flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-md ${isLive ? 'text-hot-red bg-hot-red/10 hover:bg-hot-red/20 animate-pulse' : 'text-warm-yellow bg-warm-yellow/10 hover:bg-warm-yellow/20'}`}>
                <Zap size={16} />
                Live Game
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <BetButton
            prediction="teamA"
            odds={teamAOdds}
            label={match.teamA.name.split(' ')[0]}
            isSelected={isSelectedTeamA}
            won={wonTeamA}
            lost={lostTeamA}
            isDisabled={isDisabled || teamAOdds === undefined}
            styling={getResultStyling('teamA')}
            onBet={onBet}
            winAmount={userBet?.winAmount}
            lostAmount={userBet?.amount}
          />
          <BetButton
            prediction="draw"
            odds={drawOdds}
            label="Draw"
            isSelected={isSelectedDraw}
            won={wonDraw}
            lost={lostDraw}
            isDisabled={isDisabled || drawOdds === undefined}
            styling={getResultStyling('draw')}
            onBet={onBet}
            winAmount={userBet?.winAmount}
            lostAmount={userBet?.amount}
          />
          <BetButton
            prediction="teamB"
            odds={teamBOdds}
            label={match.teamB.name.split(' ')[0]}
            isSelected={isSelectedTeamB}
            won={wonTeamB}
            lost={lostTeamB}
            isDisabled={isDisabled || teamBOdds === undefined}
            styling={getResultStyling('teamB')}
            onBet={onBet}
            winAmount={userBet?.winAmount}
            lostAmount={userBet?.amount}
          />
        </div>
      </div>
    </div>
  );
};
