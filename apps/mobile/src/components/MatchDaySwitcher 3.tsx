import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FantasyGameWeek } from '../types';
import { format, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MatchDaySwitcherProps {
  matchDays: FantasyGameWeek[];
  selectedMatchDayId: string;
  onSelect: (matchDayId: string) => void;
}

export const MatchDaySwitcher: React.FC<MatchDaySwitcherProps> = ({ matchDays, selectedMatchDayId, onSelect }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScrollability = useCallback(() => {
    const container = scrollContainerRef.current;
    if (container) {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      // Use Math.round to avoid floating point inaccuracies
      const roundedScrollLeft = Math.round(scrollLeft);
      const roundedScrollWidth = Math.round(scrollWidth);
      const roundedClientWidth = Math.round(clientWidth);

      setCanScrollLeft(roundedScrollLeft > 0);
      setCanScrollRight(roundedScrollLeft < roundedScrollWidth - roundedClientWidth);
    }
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const activeItem = container.querySelector(`[data-id="${selectedMatchDayId}"]`) as HTMLElement;
    if (activeItem) {
      activeItem.scrollIntoView({
        behavior: 'auto',
        inline: 'center',
        block: 'nearest'
      });
    }

    // Initial check after a short delay to allow layout to settle
    const timer = setTimeout(checkScrollability, 150);

    container.addEventListener('scroll', checkScrollability, { passive: true });
    window.addEventListener('resize', checkScrollability);

    return () => {
      clearTimeout(timer);
      container.removeEventListener('scroll', checkScrollability);
      window.removeEventListener('resize', checkScrollability);
    };
  }, [selectedMatchDayId, checkScrollability]);

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
    <div className="relative">
      {canScrollLeft && (
        <button
          onClick={() => handleScroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md border border-gray-200 hover:bg-white"
          aria-label="Scroll left"
        >
          <ChevronLeft size={20} className="text-gray-600" />
        </button>
      )}
      <div
        ref={scrollContainerRef}
        className="flex items-center space-x-3 overflow-x-auto pb-4 no-scrollbar scroll-smooth snap-x snap-mandatory px-2"
      >
        {matchDays.map((day) => {
          const isActive = day.id === selectedMatchDayId;
          return (
            <button
              key={day.id}
              data-id={day.id}
              onClick={() => onSelect(day.id)}
              className={`flex-shrink-0 snap-center px-4 py-2 rounded-xl transition-all duration-300 w-32 text-center border-2 ${
                isActive
                  ? 'bg-white border-purple-500 shadow-lg'
                  : 'bg-white/70 border-transparent hover:bg-white'
              }`}
            >
              <p className={`font-bold text-sm ${isActive ? 'text-purple-700' : 'text-gray-800'}`}>{day.name}</p>
              <p className={`text-xs ${isActive ? 'text-purple-500' : 'text-gray-500'}`}>
                {format(parseISO(day.startDate), 'MMM d')}
              </p>
              {isActive && (
                <div className="w-1/2 h-1 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full mx-auto mt-2"></div>
              )}
            </button>
          );
        })}
      </div>
      {canScrollRight && (
        <button
          onClick={() => handleScroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md border border-gray-200 hover:bg-white"
          aria-label="Scroll right"
        >
          <ChevronRight size={20} className="text-gray-600" />
        </button>
      )}
    </div>
  );
};
