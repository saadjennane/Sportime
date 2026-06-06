import React, { useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { hapticImpact } from '../native/haptics';

const THRESHOLD = 70; // px of pull needed to trigger a refresh
const MAX_PULL = 110; // px cap on the rubber-band

interface PullToRefreshProps {
  onRefresh: () => void | Promise<void>;
  children: React.ReactNode;
}

/**
 * Pull-to-refresh that engages only when its scroll container is at the top.
 * It locates the nearest scrollable ancestor (e.g. the app's #app-scroll region)
 * and reads its scrollTop, so it works whether the page scrolls via the window
 * or an inner overflow container.
 */
export const PullToRefresh: React.FC<PullToRefreshProps> = ({ onRefresh, children }) => {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);
  const passedThreshold = useRef(false);

  const getScrollTop = (): number => {
    let el: HTMLElement | null = rootRef.current?.parentElement ?? null;
    while (el) {
      const oy = getComputedStyle(el).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight) {
        return el.scrollTop;
      }
      el = el.parentElement;
    }
    return window.scrollY;
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (refreshing) return;
    startY.current = getScrollTop() <= 0 ? e.touches[0].clientY : null;
    passedThreshold.current = false;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current === null || refreshing) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0 && getScrollTop() <= 0) {
      const dist = Math.min(dy * 0.5, MAX_PULL); // rubber-band damping
      setPull(dist);
      if (!passedThreshold.current && dist >= THRESHOLD) {
        passedThreshold.current = true;
        hapticImpact('light');
      }
    } else {
      setPull(0);
    }
  };

  const onTouchEnd = async () => {
    if (startY.current === null) return;
    const shouldRefresh = pull >= THRESHOLD && !refreshing;
    startY.current = null;
    if (shouldRefresh) {
      setRefreshing(true);
      setPull(THRESHOLD);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPull(0);
      }
    } else {
      setPull(0);
    }
  };

  const indicatorHeight = refreshing ? 40 : pull;

  return (
    <div ref={rootRef} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div
        className="flex items-center justify-center overflow-hidden"
        style={{
          height: indicatorHeight,
          opacity: indicatorHeight > 0 ? 1 : 0,
          transition: startY.current === null ? 'height 0.2s ease, opacity 0.2s ease' : 'none',
        }}
      >
        <Loader2
          className={`w-5 h-5 text-electric-blue ${refreshing ? 'animate-spin' : ''}`}
          style={{ transform: refreshing ? undefined : `rotate(${pull * 3}deg)` }}
        />
      </div>
      {children}
    </div>
  );
};
