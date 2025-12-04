import React, { useState, useMemo } from 'react';
import { GameRewardTier } from '../../types';
import { X } from 'lucide-react';

interface AddRewardLineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (line: Omit<GameRewardTier, 'id' | 'rewards'>) => void;
  existingLines: GameRewardTier[];
}

type PositionType = 'rank' | 'range' | 'percent';

export const AddRewardLineModal: React.FC<AddRewardLineModalProps> = ({ isOpen, onClose, onSave, existingLines }) => {
  const [positionType, setPositionType] = useState<PositionType>('range');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  const validationError = useMemo(() => {
    const startNum = parseInt(start, 10);
    const endNum = parseInt(end, 10);

    if (!start) return null; // Not an error until user types

    for (const line of existingLines) {
      if (line.positionType === 'rank' && positionType === 'rank' && line.start === startNum) {
        return `Rank ${startNum} already exists.`;
      }
      if (line.positionType === 'range' && positionType === 'range') {
        if (startNum <= endNum && Math.max(line.start, startNum) <= Math.min(line.end!, endNum)) {
          return `Range overlaps with existing range ${line.start}-${line.end}.`;
        }
      }
      if (line.positionType === 'percent' && positionType === 'percent' && line.start === startNum) {
        return `Top ${startNum}% already exists.`;
      }
    }
    
    if (positionType === 'range' && start && end && startNum >= endNum) {
      return 'Start of range must be smaller than end.';
    }

    return null;
  }, [positionType, start, end, existingLines]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (validationError) return;
    const lineData: Omit<GameRewardTier, 'id' | 'rewards'> = {
      positionType,
      start: parseInt(start, 10),
      end: positionType === 'range' ? parseInt(end, 10) : undefined,
    };
    onSave(lineData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-deep-navy/60 backdrop-blur-sm flex items-center justify-center p-4 z-[90] animate-scale-in">
      <div className="modal-base max-w-sm w-full p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-text-primary">Add Reward Line</h2>
          <button onClick={onClose} className="p-2 text-text-secondary hover:bg-white/10 rounded-full"><X size={20} /></button>
        </div>

        <div className="space-y-3">
          <select value={positionType} onChange={e => setPositionType(e.target.value as PositionType)} className="input-base">
            <option value="rank">Single Rank</option>
            <option value="range">Rank Range</option>
            <option value="percent">Top Percentage</option>
          </select>

          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              placeholder={positionType === 'percent' ? 'Top %' : 'Start'}
              value={start}
              onChange={e => setStart(e.target.value)}
              className="input-base"
            />
            {positionType === 'range' && (
              <input
                type="number"
                placeholder="End"
                value={end}
                onChange={e => setEnd(e.target.value)}
                className="input-base"
              />
            )}
          </div>
          {validationError && <p className="text-xs text-hot-red text-center">{validationError}</p>}
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-2 bg-disabled text-text-secondary rounded-lg font-semibold">Cancel</button>
          <button onClick={handleSave} disabled={!!validationError || !start} className="flex-1 primary-button py-2">Add Line</button>
        </div>
      </div>
    </div>
  );
};
