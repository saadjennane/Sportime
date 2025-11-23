import React from 'react';
import { SportimeGame, RewardItem, GameRewardTier } from '../types';
import { X, Gift, Ticket, Star as StarIcon, User, Award } from 'lucide-react';

interface RewardsPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  game: SportimeGame;
}

const RewardIcon: React.FC<{ type: RewardItem['type'], tier?: RewardItem['tier'] }> = ({ type, tier }) => {
  const iconProps = { size: 20, className: "text-warm-yellow" };
  switch (type) {
    case 'ticket': return <Ticket {...iconProps} />;
    case 'spin': return <Gift {...iconProps} />;
    case 'xp': return <StarIcon {...iconProps} />;
    case 'masterpass': return <User {...iconProps} />;
    case 'custom': return <Award {...iconProps} />;
    default: return <Gift {...iconProps} />;
  }
};

const getRankLabel = (tier: GameRewardTier): string => {
  if (tier.positionType === 'rank') {
    if (tier.start === 1) return '🥇 1st Place';
    if (tier.start === 2) return '🥈 2nd Place';
    if (tier.start === 3) return '🥉 3rd Place';
    return `Rank ${tier.start}`;
  }
  if (tier.positionType === 'range') {
    return `Ranks ${tier.start} - ${tier.end}`;
  }
  if (tier.positionType === 'percent') {
    return `Top ${tier.start}%`;
  }
  return 'Unknown Rank';
};

export const RewardsPreviewModal: React.FC<RewardsPreviewModalProps> = ({ isOpen, onClose, game }) => {
  if (!isOpen) return null;

  const getRewardLabel = (reward: RewardItem) => {
    let label = reward.type.replace('_', ' ');
    if (reward.tier) label += ` (${reward.tier})`;
    if (reward.value) label += ` - ${reward.value}`;
    if (reward.name) label += `: ${reward.name}`;
    return label;
  };

  return (
    <div className="fixed inset-0 bg-deep-navy/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70] animate-scale-in">
      <div className="modal-base w-full max-w-md h-auto max-h-[80vh] flex flex-col p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <Gift className="text-warm-yellow" /> Prize Pool
          </h2>
          <button onClick={onClose} className="p-2 text-text-secondary hover:bg-white/10 rounded-full">
            <X size={24} />
          </button>
        </div>
        <p className="text-center text-sm text-text-secondary -mt-2 mb-4">{game.name}</p>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {game.rewards.map((tier) => (
            <div key={tier.id}>
              <h3 className="font-bold text-lg text-electric-blue mb-2">{getRankLabel(tier)}</h3>
              <div className="space-y-2">
                {tier.rewards.map(reward => (
                  <div key={reward.id} className="bg-deep-navy p-3 rounded-lg flex items-center gap-3">
                    <RewardIcon type={reward.type} tier={reward.tier} />
                    <p className="text-sm font-semibold text-text-primary capitalize">{getRewardLabel(reward)}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
