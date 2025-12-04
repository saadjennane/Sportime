import React, { useState, useEffect } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableLeagueItem } from './SortableLeagueItem';
import { X, Save } from 'lucide-react';

interface LeagueOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  leagues: { name: string; logo: string }[];
  onSave: (newOrder: string[]) => void;
}

export const LeagueOrderModal: React.FC<LeagueOrderModalProps> = ({ isOpen, onClose, leagues, onSave }) => {
  const [items, setItems] = useState(leagues);
  const sensors = useSensors(useSensor(PointerSensor));

  useEffect(() => {
    setItems(leagues);
  }, [leagues]);

  if (!isOpen) return null;

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setItems((currentItems) => {
        const oldIndex = currentItems.findIndex((item) => item.name === active.id);
        const newIndex = currentItems.findIndex((item) => item.name === over.id);
        return arrayMove(currentItems, oldIndex, newIndex);
      });
    }
  };

  const handleSave = () => {
    onSave(items.map(item => item.name));
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-deep-navy/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
      <div className="modal-base w-full max-w-md h-auto max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-disabled">
          <h2 className="text-lg font-bold text-text-primary">Reorder Leagues</h2>
          <button onClick={onClose} className="p-2 text-text-secondary hover:bg-white/10 rounded-full">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={items.map(i => i.name)} strategy={verticalListSortingStrategy}>
              {items.map((league) => (
                <SortableLeagueItem key={league.name} id={league.name} name={league.name} logo={league.logo} />
              ))}
            </SortableContext>
          </DndContext>
        </div>
        <div className="p-4 border-t border-disabled">
          <button onClick={handleSave} className="w-full primary-button flex items-center justify-center gap-2">
            <Save size={18} />
            Save Order
          </button>
        </div>
      </div>
    </div>
  );
};
