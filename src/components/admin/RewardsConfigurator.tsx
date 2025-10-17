import React, { useState, useEffect } from 'react';
import { GameRewardTier, RewardItem, TournamentType } from '../../types';
import { Plus, Trash2, Edit, RefreshCw, GripVertical, Save } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { AddRewardModal } from './AddRewardModal';
import { BASE_REWARD_PACKS } from '../../config/rewardPacks';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AddRewardLineModal } from './AddRewardLineModal';

interface RewardsConfiguratorProps {
  rewards: GameRewardTier[];
  onRewardsChange: (newRewards: GameRewardTier[]) => void;
  tier: TournamentType;
  format: string;
  updateBasePack: (tier: TournamentType, format: string, updatedPack: GameRewardTier[]) => void;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

const getRewardLabel = (reward: RewardItem) => {
  let label = reward.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  if (reward.tier) label += ` (${reward.tier.charAt(0).toUpperCase() + reward.tier.slice(1)})`;
  if (reward.value) label += ` - ${reward.value}`;
  if (reward.name) label += `: ${reward.name}`;
  return label;
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

const SortableRewardLine: React.FC<{
  line: GameRewardTier;
  onUpdate: (lineId: string, updates: Partial<GameRewardTier>) => void;
  onDelete: (lineId: string) => void;
  onAddReward: (lineId: string) => void;
  onEditReward: (lineId: string, reward: RewardItem) => void;
  onDeleteReward: (lineId: string, rewardId: string) => void;
  onClearLine: (lineId: string) => void;
}> = (props) => {
  const { line, onUpdate, onDelete, onAddReward, onEditReward, onDeleteReward, onClearLine } = props;
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: line.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="bg-deep-navy p-3 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <button {...attributes} {...listeners} className="p-1 text-text-disabled cursor-grab active:cursor-grabbing">
          <GripVertical size={16} />
        </button>
        <p className="font-bold text-electric-blue flex-1">{getRankLabel(line)}</p>
        <button type="button" onClick={() => onClearLine(line.id)} className="p-1 text-xs text-warm-yellow hover:underline">Clear</button>
        <button type="button" onClick={() => onDelete(line.id)} className="p-1 text-hot-red hover:bg-hot-red/10 rounded-full"><Trash2 size={14} /></button>
      </div>
      <div className="space-y-2 pl-4">
        {line.rewards.map(reward => (
          <div key={reward.id} className="flex items-center justify-between bg-navy-accent p-2 rounded">
            <span className="text-xs text-text-secondary capitalize">{getRewardLabel(reward)}</span>
            <div className="flex items-center">
              <button type="button" onClick={() => onEditReward(line.id, reward)} className="p-1 text-text-disabled hover:text-electric-blue"><Edit size={14} /></button>
              <button type="button" onClick={() => onDeleteReward(line.id, reward.id)} className="p-1 text-text-disabled hover:text-hot-red"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => onAddReward(line.id)} className="w-full text-xs text-electric-blue font-semibold p-1 rounded hover:bg-electric-blue/10">
          + Add Reward
        </button>
      </div>
    </div>
  );
};

export const RewardsConfigurator: React.FC<RewardsConfiguratorProps> = ({ rewards, onRewardsChange, tier, format, updateBasePack, addToast }) => {
  const [rewardLines, setRewardLines] = useState<GameRewardTier[]>([]);
  const [isAddRewardModalOpen, setIsAddRewardModalOpen] = useState(false);
  const [isAddLineModalOpen, setIsAddLineModalOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<{ lineId: string; reward: RewardItem } | null>(null);

  useEffect(() => {
    setRewardLines(rewards || []);
  }, [rewards]);

  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = rewardLines.findIndex(line => line.id === active.id);
      const newIndex = rewardLines.findIndex(line => line.id === over.id);
      const newOrder = arrayMove(rewardLines, oldIndex, newIndex);
      setRewardLines(newOrder);
      onRewardsChange(newOrder);
    }
  };

  const handleUpdateLine = (lineId: string, updates: Partial<GameRewardTier>) => {
    const newLines = rewardLines.map(line => line.id === lineId ? { ...line, ...updates } : line);
    setRewardLines(newLines);
    onRewardsChange(newLines);
  };

  const handleDeleteLine = (lineId: string) => {
    const newLines = rewardLines.filter(line => line.id !== lineId);
    setRewardLines(newLines);
    onRewardsChange(newLines);
  };
  
  const handleClearLine = (lineId: string) => {
    const newLines = rewardLines.map(line => line.id === lineId ? { ...line, rewards: [] } : line);
    setRewardLines(newLines);
    onRewardsChange(newLines);
  };

  const handleAddReward = (lineId: string) => {
    setEditingReward({ lineId, reward: { id: uuidv4(), type: 'xp', value: 100 } });
    setIsAddRewardModalOpen(true);
  };

  const handleEditReward = (lineId: string, reward: RewardItem) => {
    setEditingReward({ lineId, reward });
    setIsAddRewardModalOpen(true);
  };

  const handleDeleteReward = (lineId: string, rewardId: string) => {
    const newLines = rewardLines.map(line => {
      if (line.id === lineId) {
        return { ...line, rewards: line.rewards.filter(r => r.id !== rewardId) };
      }
      return line;
    });
    setRewardLines(newLines);
    onRewardsChange(newLines);
  };

  const handleSaveReward = (newReward: RewardItem) => {
    if (!editingReward) return;
    const { lineId } = editingReward;

    const newLines = rewardLines.map(line => {
      if (line.id === lineId) {
        const existingIndex = line.rewards.findIndex(r => r.id === newReward.id);
        const updatedRewards = [...line.rewards];
        if (existingIndex > -1) {
          updatedRewards[existingIndex] = newReward;
        } else {
          updatedRewards.push(newReward);
        }
        return { ...line, rewards: updatedRewards };
      }
      return line;
    });
    setRewardLines(newLines);
    onRewardsChange(newLines);
  };

  const handleReset = () => {
    const durationKey = format === 'daily' ? 'matchday' : format;
    const basePack = BASE_REWARD_PACKS[tier]?.[durationKey] || [];
    const deepCopied = JSON.parse(JSON.stringify(basePack));
    setRewardLines(deepCopied);
    onRewardsChange(deepCopied);
    addToast('Rewards reset to base pack.', 'info');
  };

  const handleSaveAsBase = () => {
    const durationKey = format === 'daily' ? 'matchday' : format;
    updateBasePack(tier, durationKey, rewardLines);
    addToast(`Base pack for ${tier} - ${format} updated!`, 'success');
  };
  
  const sortRewardLines = (lines: GameRewardTier[]) => {
    const typeOrder = { rank: 1, range: 2, percent: 3 };
    return [...lines].sort((a, b) => {
      if (a.positionType !== b.positionType) {
        return typeOrder[a.positionType] - typeOrder[b.positionType];
      }
      return a.start - b.start;
    });
  };

  const handleSaveNewLine = (newLineData: Omit<GameRewardTier, 'id' | 'rewards'>) => {
    const newLine: GameRewardTier = { ...newLineData, id: uuidv4(), rewards: [] };
    const sortedLines = sortRewardLines([...rewardLines, newLine]);
    setRewardLines(sortedLines);
    onRewardsChange(sortedLines);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-deep-navy p-2 rounded-lg">
        <p className="text-xs font-semibold text-text-disabled px-2">Base: {tier} - {format}</p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={handleReset} className="p-2 text-text-secondary hover:bg-white/10 rounded-lg" title="Reset to Base"><RefreshCw size={14} /></button>
          <button type="button" onClick={handleSaveAsBase} className="p-2 text-text-secondary hover:bg-white/10 rounded-lg" title="Save as Base Pack"><Save size={14} /></button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={rewardLines} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {rewardLines.map(line => (
              <SortableRewardLine
                key={line.id}
                line={line}
                onUpdate={handleUpdateLine}
                onDelete={handleDeleteLine}
                onAddReward={handleAddReward}
                onEditReward={handleEditReward}
                onDeleteReward={handleDeleteReward}
                onClearLine={handleClearLine}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button type="button" onClick={() => setIsAddLineModalOpen(true)} className="w-full flex items-center justify-center gap-2 text-sm font-semibold bg-lime-glow/20 text-lime-glow px-3 py-2 rounded-lg hover:bg-lime-glow/30">
        <Plus size={16} /> Add Range / Percent
      </button>

      {isAddRewardModalOpen && (
        <AddRewardModal
          isOpen={isAddRewardModalOpen}
          onClose={() => setIsAddRewardModalOpen(false)}
          onSave={handleSaveReward}
          existingReward={editingReward?.reward}
        />
      )}
      <AddRewardLineModal
        isOpen={isAddLineModalOpen}
        onClose={() => setIsAddLineModalOpen(false)}
        onSave={handleSaveNewLine}
        existingLines={rewardLines}
      />
    </div>
  );
};
