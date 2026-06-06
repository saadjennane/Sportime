import React from 'react';
import { Match, Bet } from '../../types';
import { TrendingUp, BarChart2, Zap, Lock } from 'lucide-react';
import { MatchHeaderRow } from './MatchHeaderRow';

interface BetButtonProps {
  prediction: 'teamA' | 'draw' | 'teamB';
  odds?: number;
  label: string;
  isDisabled: boolean;
  styling: string;
  onBet?: (prediction: 'teamA' | 'draw' | 'teamB', odds?: number) => void;
}

const BetButton: React.FC<BetButtonProps> = ({ prediction, odds, label, isDisabled, styling, onBet }) => {
  const displayOdds = odds !== undefined ? `${odds.toFixed(2)}x` : '--';
  return (
    <button
      onClick={() => !isDisabled && onBet && onBet(prediction, odds)}
      disabled={isDisabled}
      className={`flex-1 p-2 rounded-lg border-2 transition-all duration-200 ${styling} ${isDisabled ? 'cursor-not-allowed opacity-60' : ''}`}
    >
      <div className="text-center">
        <div className="text-[11px] text-text-secondary mb-0.5 font-medium truncate">{label}</div>
        <div className="text-base font-bold text-text-primary">{displayOdds}</div>
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

export const MatchCard: React.FC<MatchCardProps> = ({ match, onBet, onViewStats, onPlayGame, userBet }) => {
  const isLive = !!match.isLive;
  const isUpcoming = match.status === 'upcoming' && !isLive;
  const betPlaced = !!userBet;

  const getOddsStyling = (prediction: 'teamA' | 'draw' | 'teamB') => {
    if (isLive) return 'border-hot-red/40 bg-hot-red/5 cursor-not-allowed';
    return betPlaced && userBet?.prediction === prediction
      ? 'border-electric-blue bg-electric-blue/10'
      : 'border-disabled bg-deep-navy hover:border-electric-blue';
  };

  const liveLabel = () => {
    const raw = match.rawStatus?.toUpperCase();
    if (raw === '1H') return '1H';
    if (raw === 'HT') return 'HT';
    if (raw === '2H') return '2H';
    if (raw === 'ET') return 'ET';
    if (raw === 'P' || raw === 'PEN') return 'PEN';
    if (raw === 'BT') return 'BT';
    return 'LIVE';
  };

  const teamAOdds = match.odds?.teamA && match.odds.teamA > 0 ? match.odds.teamA : undefined;
  const drawOdds = match.odds?.draw && match.odds.draw > 0 ? match.odds.draw : undefined;
  const teamBOdds = match.odds?.teamB && match.odds.teamB > 0 ? match.odds.teamB : undefined;
  const isDisabled = !isUpcoming || isLive;
  const hasAnyOdds = teamAOdds !== undefined || drawOdds !== undefined || teamBOdds !== undefined;

  // "Bet" opens the modal on the first available outcome; the user switches inside.
  const handleBetClick = () => {
    if (teamAOdds !== undefined) onBet?.('teamA', teamAOdds);
    else if (drawOdds !== undefined) onBet?.('draw', drawOdds);
    else if (teamBOdds !== undefined) onBet?.('teamB', teamBOdds);
  };

  const center = isLive ? `${match.score?.teamA ?? 0} - ${match.score?.teamB ?? 0}` : match.kickoffTime;
  const badge = isLive ? ({ text: liveLabel(), variant: 'live' } as const) : undefined;

  return (
    <div className="card-base p-4 space-y-3">
      <MatchHeaderRow match={match} center={center} badge={badge} />

      {/* Odds */}
      <div className="flex gap-2">
        <BetButton
          prediction="teamA"
          odds={teamAOdds}
          label={match.teamA.name.split(' ')[0]}
          isDisabled={isDisabled || teamAOdds === undefined}
          styling={getOddsStyling('teamA')}
          onBet={onBet}
        />
        <BetButton
          prediction="draw"
          odds={drawOdds}
          label="Draw"
          isDisabled={isDisabled || drawOdds === undefined}
          styling={getOddsStyling('draw')}
          onBet={onBet}
        />
        <BetButton
          prediction="teamB"
          odds={teamBOdds}
          label={match.teamB.name.split(' ')[0]}
          isDisabled={isDisabled || teamBOdds === undefined}
          styling={getOddsStyling('teamB')}
          onBet={onBet}
        />
      </div>

      {/* Actions: Bet/Locked · Play · Stats */}
      <div className="flex gap-2">
        {isUpcoming ? (
          <button
            onClick={handleBetClick}
            disabled={!hasAnyOdds}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-electric-blue rounded-lg text-sm font-bold text-white hover:bg-electric-blue/90 transition-colors disabled:opacity-50"
          >
            <TrendingUp size={14} /> Bet
          </button>
        ) : isLive ? (
          <div className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-navy-accent/50 rounded-lg text-sm font-semibold text-text-disabled">
            <Lock size={14} /> Locked
          </div>
        ) : null}
        {onPlayGame && (isUpcoming || isLive) && (
          <button
            onClick={() => onPlayGame(match.id, `${match.teamA.name} vs ${match.teamB.name}`)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-navy-accent rounded-lg text-sm font-semibold text-warm-yellow hover:text-warm-yellow/80 transition-colors"
          >
            <Zap size={14} /> Play
          </button>
        )}
        {onViewStats && (
          <button
            onClick={onViewStats}
            className="relative flex-1 flex items-center justify-center gap-1.5 py-2 bg-navy-accent rounded-lg text-sm font-semibold text-text-secondary hover:text-electric-blue transition-colors"
          >
            <BarChart2 size={14} /> Stats
            {match.hasLineup && (
              <span className="absolute top-1 right-2 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime-glow opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-lime-glow"></span>
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
