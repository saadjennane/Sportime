import React, { useState, useRef, memo } from 'react';
import { motion, PanInfo, useMotionValue, useTransform } from 'framer-motion';
import { SwipeMatch, SwipePredictionOutcome } from '../types';
import { flushSync } from 'react-dom';
import { format, parseISO } from 'date-fns';
import { hapticImpact } from '../native/haptics';

interface SwipeCardProps {
  match: SwipeMatch;
  onSwipe: (matchId: string, prediction: SwipePredictionOutcome) => void;
  isTop: boolean;
  currentPrediction?: SwipePredictionOutcome;
  /** When set, frames the card and stamps the booster (x2 = blue, x3 = red). */
  booster?: 'x2' | 'x3';
  /** False when odds aren't synced yet — the card can't be swiped. */
  oddsReady?: boolean;
}

const swipeThreshold = 50;

// TeamLogo component defined OUTSIDE SwipeCard to prevent recreation on each render.
// No surrounding circle — just the centered logo (or initial fallback).
const TeamLogo = memo(({ team }: { team: { name: string; logo?: string; emoji: string } }) => {
  const [imageError, setImageError] = useState(false);

  if (team.logo && !imageError) {
    return (
      <img
        src={team.logo}
        alt={team.name}
        className="w-20 h-20 object-contain mx-auto"
        onError={() => setImageError(true)}
      />
    );
  }

  // Fallback: Initial letter
  return (
    <div className="w-20 h-20 mx-auto flex items-center justify-center text-4xl font-bold text-text-secondary">
      {team.name.charAt(0)}
    </div>
  );
});

const cardVariants = {
  initial: { scale: 0.95, y: 20, opacity: 0 },
  animate: { scale: 1, y: 0, opacity: 1 },
  exit: (direction: 'left' | 'right' | 'up' | null) => {
    let exitX = 0;
    let exitY = 0;

    if (direction === 'left') exitX = -500;
    if (direction === 'right') exitX = 500;
    if (direction === 'up') exitY = -500;
    
    return {
      x: exitX,
      y: exitY,
      opacity: 0,
      transition: { duration: 0.3 }
    };
  }
};

export const SwipeCard = memo<SwipeCardProps>(function SwipeCard({ match, onSwipe, isTop, currentPrediction, booster, oddsReady = true }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | 'up' | null>(null);

  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  // Reveal the choice indicator as soon as the drag starts (~12px), full by ~50px.
  const opacityLeft = useTransform(x, [-50, -12], [1, 0]);
  const opacityRight = useTransform(x, [12, 50], [0, 1]);
  const opacityUp = useTransform(y, [-50, -12], [1, 0]);

  // Light tactile cue the first time a drag crosses the commit threshold, so
  // the user feels "release now". Does not affect the swipe decision below.
  const passedThreshold = useRef(false);
  const handleDrag = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (!isTop) return;
    const past =
      Math.abs(info.offset.x) > swipeThreshold || info.offset.y < -swipeThreshold;
    if (past && !passedThreshold.current) {
      passedThreshold.current = true;
      hapticImpact('light');
    } else if (!past && passedThreshold.current) {
      passedThreshold.current = false;
    }
  };

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (!isTop) return;
    passedThreshold.current = false;

    const { offset, velocity } = info;
    let direction: 'left' | 'right' | 'up' | null = null;
    let prediction: SwipePredictionOutcome | null = null;

    // Swipe vertical (draw) - priorité si mouvement majoritairement vertical
    if ((offset.y < -swipeThreshold || velocity.y < -500) && Math.abs(offset.y) > Math.abs(offset.x)) {
      direction = 'up';
      prediction = 'draw';
    }
    // Swipe gauche avec threshold OU vélocité rapide
    else if (offset.x < -swipeThreshold || velocity.x < -500) {
      direction = 'left';
      prediction = 'teamA';
    }
    // Swipe droite avec threshold OU vélocité rapide
    else if (offset.x > swipeThreshold || velocity.x > 500) {
      direction = 'right';
      prediction = 'teamB';
    }

    if (direction && prediction) {
      flushSync(() => {
        setExitDirection(direction);
      });
      onSwipe(match.id, prediction as SwipePredictionOutcome);
    }
  };

  const selectedClass = (key: SwipePredictionOutcome) =>
    currentPrediction === key
      ? 'border-electric-blue bg-electric-blue/20 shadow-[0_0_14px_rgba(59,130,246,0.45)]'
      : 'border-transparent';

  const kickoffLabel = (() => {
    try {
      return format(parseISO(match.kickoffTime), 'EEE, MMM d · HH:mm');
    } catch {
      return match.kickoffTime;
    }
  })();

  return (
    <motion.div
      key={match.id}
      variants={cardVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      custom={exitDirection}
      drag={isTop && oddsReady}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      style={{ x, y, rotate }}
      whileTap={{ scale: 0.98, cursor: 'grabbing' }}
      className={`absolute w-[90vw] max-w-sm h-[60vh] bg-navy-accent rounded-3xl shadow-2xl p-6 flex flex-col justify-between cursor-grab ${isTop ? '' : 'pointer-events-none'} ${
        booster === 'x2' ? 'border-2 border-electric-blue ring-2 ring-electric-blue/40'
        : booster === 'x3' ? 'border-2 border-hot-red ring-2 ring-hot-red/40'
        : 'border border-white/10'}`}
    >
      {/* Odds not synced yet — block swiping */}
      {isTop && !oddsReady && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-2 pointer-events-none">
          <span className="w-2.5 h-2.5 rounded-full bg-warm-yellow animate-pulse" />
          <p className="text-sm font-semibold text-warm-yellow bg-deep-navy/80 px-3 py-1.5 rounded-lg">Odds loading…</p>
        </div>
      )}

      {/* Booster stamp */}
      {booster && (
        <div className={`absolute top-4 right-4 z-10 text-2xl font-extrabold px-3 py-1 rounded-xl rotate-[12deg] border-2 ${
          booster === 'x2' ? 'text-electric-blue border-electric-blue bg-electric-blue/10'
          : 'text-hot-red border-hot-red bg-hot-red/10'}`}>
          {booster}
        </div>
      )}
      {isTop && (
        <>
          <motion.div style={{ opacity: opacityLeft }} className="absolute top-1/2 left-4 -translate-y-1/2 text-lime-glow font-bold text-3xl border-4 border-lime-glow px-4 py-2 rounded-xl rotate-[-15deg] pointer-events-none bg-lime-glow/10">
            {match.teamA.name.split(' ')[0].toUpperCase()}
          </motion.div>
          <motion.div style={{ opacity: opacityRight }} className="absolute top-1/2 right-4 -translate-y-1/2 text-lime-glow font-bold text-3xl border-4 border-lime-glow px-4 py-2 rounded-xl rotate-[15deg] pointer-events-none bg-lime-glow/10">
            {match.teamB.name.split(' ')[0].toUpperCase()}
          </motion.div>
          <motion.div style={{ opacity: opacityUp }} className="absolute top-28 left-1/2 -translate-x-1/2 text-electric-blue font-bold text-3xl border-4 border-electric-blue px-4 py-2 rounded-xl pointer-events-none bg-electric-blue/10">
            DRAW
          </motion.div>
        </>
      )}

      {/* Draw on top — visually cues "swipe up = draw" */}
      <div className={`text-center px-4 py-2.5 rounded-2xl border-2 transition-all ${selectedClass('draw')}`}>
        <p className="font-bold text-lg text-text-primary">Draw</p>
        <p className="font-semibold text-electric-blue">@{match.odds.draw.toFixed(2)}</p>
      </div>

      <div className="flex items-center justify-center gap-3">
        <div className={`flex-1 text-center p-3 rounded-2xl border-2 transition-all ${selectedClass('teamA')}`}>
          <TeamLogo team={match.teamA} />
          <p className="font-bold text-base text-text-primary mt-2 truncate">{match.teamA.name}</p>
          <p className="font-semibold text-electric-blue">@{match.odds.teamA.toFixed(2)}</p>
        </div>
        <p className="text-xl font-bold text-text-disabled flex-shrink-0">VS</p>
        <div className={`flex-1 text-center p-3 rounded-2xl border-2 transition-all ${selectedClass('teamB')}`}>
          <TeamLogo team={match.teamB} />
          <p className="font-bold text-base text-text-primary mt-2 truncate">{match.teamB.name}</p>
          <p className="font-semibold text-electric-blue">@{match.odds.teamB.toFixed(2)}</p>
        </div>
      </div>

      {/* Kickoff date at the bottom — formatted EEE, MMM d · HH:mm */}
      <div className="text-center">
        <p className="text-sm text-text-secondary font-semibold">{kickoffLabel}</p>
      </div>
    </motion.div>
  );
});

SwipeCard.displayName = 'SwipeCard';
