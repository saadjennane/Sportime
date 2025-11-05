import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FantasyGameWeek } from '../../types';
import { format, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MatchDaySwitcherProps {
  gameWeeks: FantasyGameWeek[];
  selectedGameWeekId: string;
  onSelect: (gameWeekId: string) => void;
}

export const MatchDaySwitcher: React.FC<MatchDaySwitcherProps> = ({ gameWeeks, selectedGameWeekId, onSelect }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScrollability = useCallback(() => {
    const container = scrollContainerRef.current;
    if (container) {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      const tolerance = 1;
      setCanScrollLeft(scrollLeft > tolerance);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - tolerance);
    }
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const activeItem = container.querySelector(`[data-id="${selectedGameWeekId}"]`) as HTMLElement;
    if (activeItem) {
      activeItem.scrollIntoView({
        behavior: 'auto',
        inline: 'center',
        block: 'nearest'
      });
    }
    
    // Check scrollability after a short delay to ensure layout is final
    const timer = setTimeout(checkScrollability, 100);

    container.addEventListener('scroll', checkScrollability, { passive: true });
    window.addEventListener('resize', checkScrollability);

    return () => {
      clearTimeout(timer);
      if (container) {
        container.removeEventListener('scroll', checkScrollability);
      }
      window.removeEventListener('resize', checkScrollability);
    };
  }, [selectedGameWeekId, checkScrollability, gameWeeks]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = scrollContainerRef.current.clientWidth * 0.8;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="relative group">
      {canScrollLeft && (
        <button
          onClick={() => handleScroll('left')}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md border border-gray-200 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          aria-label="Scroll left"
        >
          <ChevronLeft size={20} className="text-gray-600" />
        </button>
      )}
      
      <div
        ref={scrollContainerRef}
        className="flex items-center space-x-3 overflow-x-auto px-4 pb-2 scroll-smooth no-scrollbar"
      >
        {gameWeeks.map((gw) => {
          const isActive = gw.id === selectedGameWeekId;
          return (
            <button
              key={gw.id}
              data-id={gw.id}
              onClick={() => onSelect(gw.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl transition-all duration-300 w-auto text-center border-2 ${
                isActive
                  ? 'bg-white border-purple-500 shadow-md'
                  : 'bg-white/70 border-transparent hover:bg-white'
              }`}
            >
              <p className={`font-bold text-sm ${isActive ? 'text-purple-700' : 'text-gray-800'}`}>{gw.name}</p>
              <p className={`text-xs ${isActive ? 'text-purple-500' : 'text-gray-500'}`}>
                {format(parseISO(gw.startDate), 'd MMM')}
              </p>
              {isActive && (
                <div className="w-1/2 h-0.5 bg-purple-500 rounded-full mx-auto mt-1.5"></div>
              )}
            </button>
          );
        })}
      </div>

      {canScrollRight && (
        <button
          onClick={() => handleScroll('right')}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md border border-gray-200 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          aria-label="Scroll right"
        >
          <ChevronRight size={20} className="text-gray-600" />
        </button>
      )}
    </div>
  );
};
