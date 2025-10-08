import React, { useState } from 'react';
import { SwipeMatch, SwipePredictionOutcome } from '../types';
import { motion, PanInfo, useMotionValue, useTransform } from 'framer-motion';

interface SwipeCardProps {
  match: SwipeMatch;
  onSwipe: (matchId: string, prediction: SwipePredictionOutcome) => void;
  isTop: boolean;
  currentPrediction?: SwipePredictionOutcome;
}

const swipeThreshold = 100;

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
      transition: { duration: 0.3 }
    };
  }
};

export const SwipeCard: React.FC<SwipeCardProps> = ({ match, onSwipe, isTop, currentPrediction }) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | 'up' | null>(null);

  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  const opacityLeft = useTransform(x, [-120, -70], [1, 0]);
  const opacityRight = useTransform(x, [70, 120], [0, 1]);
  const opacityUp = useTransform(y, [-120, -70], [1, 0]);

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (!isTop) return;
    
    const { offset } = info;
    let direction: 'left' | 'right' | 'up' | null = null;
    let prediction: SwipePredictionOutcome | null = null;

    if (offset.y < -swipeThreshold && Math.abs(offset.y) > Math.abs(offset.x)) {
      direction = 'up';
      prediction = 'draw';
    } else if (offset.x < -swipeThreshold) {
      direction = 'left';
      prediction = 'teamA';
    } else if (offset.x > swipeThreshold) {
      direction = 'right';
      prediction = 'teamB';
    }

    if (direction && prediction) {
      setExitDirection(direction);
      setTimeout(() => onSwipe(match.id, prediction as SwipePredictionOutcome), 0);
    }
  };

  return (
    <motion.div
      key={match.id}
      variants={cardVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      custom={exitDirection}
      drag={isTop}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      onDragEnd={handleDragEnd}
      style={{ x, y, rotate }}
      whileTap={{ scale: 0.98, cursor: 'grabbing' }}
      className={`absolute w-[90vw] max-w-sm h-[60vh] bg-white rounded-3xl shadow-2xl p-6 flex flex-col justify-between cursor-grab ${isTop ? '' : 'pointer-events-none'}`}
    >
      {isTop && (
        <>
          <motion.div style={{ opacity: opacityLeft }} className="absolute top-1/2 left-4 -translate-y-1/2 text-red-500 font-bold text-3xl border-4 border-red-500 px-4 py-2 rounded-xl rotate-[-15deg] pointer-events-none">
            {match.teamA.name.split(' ')[0].toUpperCase()}
          </motion.div>
          <motion.div style={{ opacity: opacityRight }} className="absolute top-1/2 right-4 -translate-y-1/2 text-green-500 font-bold text-3xl border-4 border-green-500 px-4 py-2 rounded-xl rotate-[15deg] pointer-events-none">
            {match.teamB.name.split(' ')[0].toUpperCase()}
          </motion.div>
          <motion.div style={{ opacity: opacityUp }} className="absolute top-10 left-1/2 -translate-x-1/2 text-blue-500 font-bold text-3xl border-4 border-blue-500 px-4 py-2 rounded-xl pointer-events-none">
            DRAW
          </motion.div>
        </>
      )}

      <div className="text-center">
        <p className="text-sm text-gray-500 font-semibold">{match.kickoffTime}</p>
      </div>

      <div className="flex items-center justify-around">
        <div className={`text-center p-3 rounded-xl transition-colors ${currentPrediction === 'teamA' ? 'bg-purple-100' : ''}`}>
          <p className="text-6xl">{match.teamA.emoji}</p>
          <p className="font-bold text-lg">{match.teamA.name}</p>
          <p className="font-semibold text-purple-600">@{match.odds.teamA.toFixed(2)}</p>
        </div>
        <p className="text-2xl font-bold text-gray-300">VS</p>
        <div className={`text-center p-3 rounded-xl transition-colors ${currentPrediction === 'teamB' ? 'bg-purple-100' : ''}`}>
          <p className="text-6xl">{match.teamB.emoji}</p>
          <p className="font-bold text-lg">{match.teamB.name}</p>
          <p className="font-semibold text-purple-600">@{match.odds.teamB.toFixed(2)}</p>
        </div>
      </div>

      <div className={`text-center p-3 rounded-xl transition-colors ${currentPrediction === 'draw' ? 'bg-purple-100' : ''}`}>
        <p className="font-bold text-lg">Draw</p>
        <p className="font-semibold text-purple-600">@{match.odds.draw.toFixed(2)}</p>
      </div>
    </motion.div>
  );
};
