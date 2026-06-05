import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

interface SortableLeagueItemProps {
  id: string;
  name: string;
  logo: string;
}

export const SortableLeagueItem: React.FC<SortableLeagueItemProps> = ({ id, name, logo }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center bg-deep-navy p-3 rounded-lg touch-none">
      <button {...attributes} {...listeners} className="p-2 cursor-grab active:cursor-grabbing text-text-disabled">
        <GripVertical size={20} />
      </button>
      <img src={logo} alt={name} className="w-6 h-6 mx-2" />
      <span className="font-semibold text-text-primary">{name}</span>
    </div>
  );
};
