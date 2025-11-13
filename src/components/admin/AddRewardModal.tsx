import React, { useState } from 'react';
import { RewardItem, SpinTier, TournamentType } from '../../types';
import { X } from 'lucide-react';

interface AddRewardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (reward: RewardItem) => void;
  existingReward?: RewardItem | null;
}

const rewardTypes = ["ticket", "spin", "xp", "giftcard", "masterpass", "custom", "premium_3d", "premium_7d", "coins"];
const tiers: (TournamentType | SpinTier)[] = ["free", "amateur", "master", "apex", "premium"];

export const AddRewardModal: React.FC<AddRewardModalProps> = ({ isOpen, onClose, onSave, existingReward }) => {
  const [reward, setReward] = useState<Partial<RewardItem>>(existingReward || { type: 'xp' });

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(reward as RewardItem);
    onClose();
  };

  const needsTier = reward.type === 'ticket' || reward.type === 'spin' || reward.type === 'masterpass';
  const needsValue = reward.type === 'xp' || reward.type === 'giftcard' || reward.type === 'coins';
  const needsCustom = reward.type === 'custom';

  return (
    <div className="fixed inset-0 bg-deep-navy/60 backdrop-blur-sm flex items-center justify-center p-4 z-[80] animate-scale-in">
      <div className="modal-base max-w-sm w-full p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-text-primary">{existingReward ? 'Edit' : 'Add'} Reward</h2>
          <button onClick={onClose} className="p-2 text-text-secondary hover:bg-white/10 rounded-full"><X size={20} /></button>
        </div>

        <div className="space-y-3">
          <select value={reward.type} onChange={e => setReward({ ...reward, type: e.target.value as RewardItem['type'] })} className="input-base">
            {rewardTypes.map(t => <option key={t} value={t} className="capitalize">{t.replace('_', ' ')}</option>)}
          </select>

          {needsTier && (
            <select value={reward.tier} onChange={e => setReward({ ...reward, tier: e.target.value as any })} className="input-base">
              <option value="">Select Tier</option>
              {tiers.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
            </select>
          )}

          {needsValue && (
            <input type="number" placeholder="Value (e.g., 200)" value={reward.value as number || ''} onChange={e => setReward({ ...reward, value: Number(e.target.value) })} className="input-base" />
          )}

          {needsCustom && (
            <>
              <input type="text" placeholder="Item Name" value={reward.name || ''} onChange={e => setReward({ ...reward, name: e.target.value })} className="input-base" />
              <input type="text" placeholder="Logo URL" value={reward.logo || ''} onChange={e => setReward({ ...reward, logo: e.target.value })} className="input-base" />
            </>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-2 bg-disabled text-text-secondary rounded-lg font-semibold">Cancel</button>
          <button onClick={handleSave} className="flex-1 primary-button py-2">Save Reward</button>
        </div>
      </div>
    </div>
  );
};
