import React from 'react';
import { X, Loader2, ChevronRight, Crosshair, Trophy, Star } from 'lucide-react';
import { MatchModes } from '../../services/liveGameService';

interface LiveGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchId?: string | null;
  matchName: string | null;
  onSelectMode: (mode: 'free' | 'ranked', entryCost?: number) => void;
  isLoading?: boolean;
  userBalance?: number;
  userTier?: string;
  matchRoyalePot?: number | null;
  onPlayMatchRoyale?: () => void;        // always available (created on demand)
  liveFantasyReady?: boolean;            // lineup published -> playable
  onPlayLiveFantasy?: () => void;
  onNotifyLineups?: () => void;
  modes?: MatchModes | null;             // per-mode joined/done state for the status pills
}

type Pill = { t: string; c: string } | null;
const SETTLED = ['finished', 'settled', 'closed', 'paid'];
const RESULTS: Pill = { t: 'Results', c: 'bg-warm-yellow/15 text-warm-yellow' };

const predictionPill = (m?: MatchModes | null): Pill => {
  if (!m) return null;
  if (SETTLED.includes(m.prediction.status ?? '')) return RESULTS;
  if (m.prediction.predicted) return { t: `✓ ${m.prediction.predicted.home}-${m.prediction.predicted.away}`, c: 'bg-lime-glow/15 text-lime-glow' };
  if (m.prediction.joined) return { t: 'Joined', c: 'bg-electric-blue/15 text-electric-blue' };
  return null;
};
const mrPill = (m?: MatchModes | null): Pill => {
  if (!m?.matchRoyale) return null;
  if (SETTLED.includes(m.matchRoyale.gameStatus ?? '')) return RESULTS;
  if (m.matchRoyale.joined) return m.matchRoyale.partStatus === 'eliminated'
    ? { t: 'Out', c: 'bg-hot-red/15 text-hot-red' }
    : { t: '✓ In', c: 'bg-lime-glow/15 text-lime-glow' };
  return null;
};
const lfPill = (m?: MatchModes | null): Pill => {
  if (!m?.liveFantasy) return null;
  if (SETTLED.includes(m.liveFantasy.status ?? '')) return RESULTS;
  if (m.liveFantasy.complete) return { t: '✓ XI set', c: 'bg-lime-glow/15 text-lime-glow' };
  if (m.liveFantasy.joined) return { t: 'In progress', c: 'bg-warm-yellow/15 text-warm-yellow' };
  return null;
};

const PillTag: React.FC<{ pill: Pill }> = ({ pill }) =>
  pill ? <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg flex-shrink-0 ${pill.c}`}>{pill.t}</span> : null;

/** Live Games chooser for a match: Live Prediction, Match Royale, Live Fantasy. */
export const LiveGameModal: React.FC<LiveGameModalProps> = ({
  isOpen, onClose, matchName, onSelectMode, isLoading, onPlayMatchRoyale, liveFantasyReady, onPlayLiveFantasy, onNotifyLineups, modes,
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-deep-navy/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-[60] animate-scale-in" onClick={onClose}>
      <div className="modal-base w-full sm:max-w-sm p-5 space-y-4 relative rounded-t-2xl sm:rounded-2xl" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-text-secondary hover:bg-white/10 rounded-full"><X className="w-5 h-5" /></button>
        <div>
          <h2 className="text-xl font-bold text-text-primary">Live Games</h2>
          {matchName && <p className="text-sm text-text-secondary truncate">{matchName}</p>}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-electric-blue" size={26} /></div>
        ) : (
          <div className="space-y-3">
            {/* Live Prediction (free) */}
            <button onClick={() => onSelectMode('free')}
              className="w-full flex items-center gap-3 p-4 bg-deep-navy rounded-xl border-2 border-disabled hover:border-electric-blue transition-all text-left">
              <div className="w-11 h-11 rounded-xl bg-electric-blue/15 flex items-center justify-center flex-shrink-0"><Crosshair size={22} className="text-electric-blue" /></div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-text-primary">Live Prediction</p>
                <p className="text-xs text-text-secondary">Predict the final score + bonus questions</p>
              </div>
              <PillTag pill={predictionPill(modes)} />
              <ChevronRight size={20} className="text-text-disabled flex-shrink-0" />
            </button>

            {/* Match Royale — always available */}
            {onPlayMatchRoyale && (
              <button onClick={onPlayMatchRoyale}
                className="w-full flex items-center gap-3 p-4 bg-deep-navy rounded-xl border-2 border-warm-yellow/40 hover:border-warm-yellow transition-all text-left">
                <div className="w-11 h-11 rounded-xl bg-warm-yellow/15 flex items-center justify-center flex-shrink-0"><Trophy size={22} className="text-warm-yellow" /></div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-text-primary">Match Royale</p>
                  <p className="text-xs text-text-secondary">Survive the match — last picks standing win</p>
                </div>
                <PillTag pill={mrPill(modes)} />
                <ChevronRight size={20} className="text-text-disabled flex-shrink-0" />
              </button>
            )}

            {/* Live Fantasy — always shown; playable once lineups are out, else notify */}
            <button onClick={liveFantasyReady ? onPlayLiveFantasy : onNotifyLineups}
              className="w-full flex items-center gap-3 p-4 bg-deep-navy rounded-xl border-2 border-lime-glow/40 hover:border-lime-glow transition-all text-left">
              <div className="w-11 h-11 rounded-xl bg-lime-glow/15 flex items-center justify-center flex-shrink-0"><Star size={22} className="text-lime-glow" /></div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-text-primary">Live Fantasy</p>
                <p className="text-xs text-text-secondary">{liveFantasyReady ? 'Build a 7-man XI from both teams · follow it live' : '🔔 Notify me when lineups are published'}</p>
              </div>
              <PillTag pill={lfPill(modes)} />
              <ChevronRight size={20} className="text-text-disabled flex-shrink-0" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveGameModal;
