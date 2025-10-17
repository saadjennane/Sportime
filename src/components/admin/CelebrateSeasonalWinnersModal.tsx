import React, { useState, useMemo, useEffect } from 'react';
import { SportimeGame, RewardItem, Profile, TournamentType } from '../../types';
import { X, Trophy, Loader2, Gift } from 'lucide-react';
import { subDays, format } from 'date-fns';
import { useMockStore } from '../../store/useMockStore';

interface CelebrateSeasonalWinnersModalProps {
  isOpen: boolean;
  onClose: () => void;
  game: SportimeGame;
  onConfirm: (gameId: string, period: { start: string; end: string }, topN: number, reward: RewardItem, message: string) => void;
}

type PeriodOption = '7d' | '30d' | 'custom';

export const CelebrateSeasonalWinnersModal: React.FC<CelebrateSeasonalWinnersModalProps> = ({ isOpen, onClose, game, onConfirm }) => {
  const { allUsers, leaderboardScores } = useMockStore();
  const [loading, setLoading] = useState(false);
  
  // Filter state
  const [periodOption, setPeriodOption] = useState<PeriodOption>('30d');
  const [customStart, setCustomStart] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [topN, setTopN] = useState(10);

  // Reward state
  const [rewardType, setRewardType] = useState<RewardItem['type']>('coins');
  const [rewardValue, setRewardValue] = useState<number>(1000);
  const [rewardTicketTier, setRewardTicketTier] = useState<TournamentType>('rookie');
  
  // Message state
  const [message, setMessage] = useState('');

  const period = useMemo(() => {
    const end = new Date();
    let start = new Date();
    if (periodOption === '7d') {
      start = subDays(end, 7);
    } else if (periodOption === '30d') {
      start = subDays(end, 30);
    } else {
      start = new Date(customStart);
      end = new Date(customEnd);
    }
    return { start: start.toISOString(), end: end.toISOString() };
  }, [periodOption, customStart, customEnd]);

  const winnersPreview = useMemo(() => {
    if (!game.gameWeeks) return [];

    const periodStart = new Date(period.start);
    const periodEnd = new Date(period.end);

    const relevantGameWeeks = game.gameWeeks.filter(gw => {
      const gwDate = new Date(gw.startDate);
      return gwDate >= periodStart && gwDate <= periodEnd;
    });
    const relevantGameWeekIds = new Set(relevantGameWeeks.map(gw => gw.id));

    const playerScores = allUsers.map(user => {
      let totalScore = 0;
      const userScores = leaderboardScores[game.id]?.[user.id];
      if (userScores) {
        for (const gwId in userScores) {
          if (relevantGameWeekIds.has(gwId)) {
            totalScore += userScores[gwId];
          }
        }
      }
      return { userId: user.id, username: user.username || `User ${user.id.slice(0,4)}`, score: totalScore };
    });

    return playerScores.sort((a, b) => b.score - a.score).slice(0, topN);
  }, [game, allUsers, leaderboardScores, period, topN]);

  useEffect(() => {
    let periodText = '';
    if (periodOption === '7d') periodText = 'last 7 days';
    if (periodOption === '30d') periodText = 'last 30 days';
    if (periodOption === 'custom') periodText = `period of ${format(new Date(customStart), 'MMM d')} - ${format(new Date(customEnd), 'MMM d')}`;
    
    setMessage(`🎉 Congratulations to the top players for the ${periodText}!`);
  }, [periodOption, customStart, customEnd]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    setLoading(true);
    const reward: RewardItem = {
      id: '', // Will be generated in store
      type: rewardType,
      value: rewardType !== 'ticket' ? rewardValue : undefined,
      tier: rewardType === 'ticket' ? rewardTicketTier : undefined,
    };
    onConfirm(game.id, period, topN, reward, message);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-deep-navy/60 backdrop-blur-sm flex items-center justify-center p-4 z-[80] animate-scale-in">
      <div className="modal-base w-full max-w-lg h-auto max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-disabled">
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2"><Trophy size={20} className="text-warm-yellow"/> Celebrate Seasonal Winners</h2>
          <button onClick={onClose} className="p-2 text-text-secondary hover:bg-white/10 rounded-full"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <p className="text-center text-text-secondary">For game: <b className="text-text-primary">{game.name}</b></p>
          
          {/* Filters */}
          <div className="space-y-3">
            <h4 className="font-semibold text-text-secondary">Filters</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select value={periodOption} onChange={e => setPeriodOption(e.target.value as PeriodOption)} className="input-base text-sm">
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="custom">Custom Range</option>
              </select>
              <input type="number" value={topN} onChange={e => setTopN(Number(e.target.value))} placeholder="Top N" className="input-base text-sm" />
            </div>
            {periodOption === 'custom' && (
              <div className="grid grid-cols-2 gap-3 animate-scale-in">
                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="input-base text-sm" />
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="input-base text-sm" />
              </div>
            )}
          </div>

          {/* Rewards */}
          <div className="space-y-3">
            <h4 className="font-semibold text-text-secondary">Rewards</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select value={rewardType} onChange={e => setRewardType(e.target.value as RewardItem['type'])} className="input-base text-sm">
                <option value="coins">Coins</option>
                <option value="xp">XP</option>
                <option value="ticket">Ticket</option>
              </select>
              {rewardType === 'ticket' ? (
                <select value={rewardTicketTier} onChange={e => setRewardTicketTier(e.target.value as TournamentType)} className="input-base text-sm">
                  <option value="rookie">Rookie</option>
                  <option value="pro">Pro</option>
                  <option value="elite">Elite</option>
                </select>
              ) : (
                <input type="number" value={rewardValue} onChange={e => setRewardValue(Number(e.target.value))} placeholder="Amount" className="input-base text-sm" />
              )}
            </div>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <h4 className="font-semibold text-text-secondary">Announcement Message</h4>
            <textarea value={message} onChange={e => setMessage(e.target.value)} className="input-base h-24 text-sm" />
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <h4 className="font-semibold text-text-secondary">Winners Preview ({winnersPreview.length})</h4>
            <div className="bg-deep-navy/50 p-2 rounded-lg max-h-40 overflow-y-auto space-y-1">
              {winnersPreview.length > 0 ? winnersPreview.map((winner, index) => (
                <div key={winner.userId} className="flex justify-between items-center text-sm p-1">
                  <p><span className="font-bold text-text-disabled mr-2">{index + 1}.</span>{winner.username}</p>
                  <p className="font-semibold text-warm-yellow">{winner.score.toLocaleString()} pts</p>
                </div>
              )) : <p className="text-center text-sm text-text-disabled p-4">No players found for this period.</p>}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-disabled">
          <button onClick={handleConfirm} disabled={loading || winnersPreview.length === 0} className="w-full primary-button flex items-center justify-center gap-2">
            {loading ? <Loader2 className="animate-spin" /> : <Gift />}
            Confirm & Announce
          </button>
        </div>
      </div>
    </div>
  );
};
