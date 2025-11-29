import React, { useState } from 'react';
import { motion, PanInfo, useMotionValue, useTransform } from 'framer-motion';
import { SwipeMatch, SwipePredictionOutcome } from '../types';
import { flushSync } from 'react-dom';

interface SwipeCardProps {
  match: SwipeMatch;
  onSwipe: (matchId: string, prediction: SwipePredictionOutcome) => void;
  isTop: boolean;
  currentPrediction?: SwipePredictionOutcome;
}

const swipeThreshold = 50;

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

  // Helper component for team logo/fallback
  const TeamLogo = ({ team }: { team: { name: string; logo?: string; emoji: string } }) => {
    const [imageError, setImageError] = React.useState(false);

    if (team.logo && !imageError) {
      return (
        <img
          src={team.logo}
          alt={team.name}
          className="w-16 h-16 object-contain"
          onError={() => setImageError(true)}
        />
      );
    }

    // Fallback: Initial letter
    return (
      <div className="w-16 h-16 bg-deep-navy rounded-full flex items-center justify-center text-2xl font-bold text-text-secondary">
        {team.name.charAt(0)}
      </div>
    );
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
      className={`absolute w-[90vw] max-w-sm h-[60vh] bg-navy-accent border border-white/10 rounded-3xl shadow-2xl p-6 flex flex-col justify-between cursor-grab ${isTop ? '' : 'pointer-events-none'}`}
    >
      {isTop && (
        <>
          <motion.div style={{ opacity: opacityLeft }} className="absolute top-1/2 left-4 -translate-y-1/2 text-hot-red font-bold text-3xl border-4 border-hot-red px-4 py-2 rounded-xl rotate-[-15deg] pointer-events-none bg-hot-red/10">
            {match.teamA.name.split(' ')[0].toUpperCase()}
          </motion.div>
          <motion.div style={{ opacity: opacityRight }} className="absolute top-1/2 right-4 -translate-y-1/2 text-lime-glow font-bold text-3xl border-4 border-lime-glow px-4 py-2 rounded-xl rotate-[15deg] pointer-events-none bg-lime-glow/10">
            {match.teamB.name.split(' ')[0].toUpperCase()}
          </motion.div>
          <motion.div style={{ opacity: opacityUp }} className="absolute top-10 left-1/2 -translate-x-1/2 text-electric-blue font-bold text-3xl border-4 border-electric-blue px-4 py-2 rounded-xl pointer-events-none bg-electric-blue/10">
            DRAW
          </motion.div>
        </>
      )}

      <div className="text-center">
        <p className="text-sm text-text-secondary font-semibold">{match.kickoffTime}</p>
      </div>

      <div className="flex items-center justify-around">
        <div className={`text-center p-3 rounded-xl transition-colors ${currentPrediction === 'teamA' ? 'bg-electric-blue/20' : ''}`}>
          <TeamLogo team={match.teamA} />
          <p className="font-bold text-lg text-text-primary mt-2">{match.teamA.name}</p>
          <p className="font-semibold text-electric-blue">@{match.odds.teamA.toFixed(2)}</p>
        </div>
        <p className="text-2xl font-bold text-text-disabled">VS</p>
        <div className={`text-center p-3 rounded-xl transition-colors ${currentPrediction === 'teamB' ? 'bg-electric-blue/20' : ''}`}>
          <TeamLogo team={match.teamB} />
          <p className="font-bold text-lg text-text-primary mt-2">{match.teamB.name}</p>
          <p className="font-semibold text-electric-blue">@{match.odds.teamB.toFixed(2)}</p>
        </div>
      </div>

      <div className={`text-center p-3 rounded-xl transition-colors ${currentPrediction === 'draw' ? 'bg-electric-blue/20' : ''}`}>
        <p className="font-bold text-lg text-text-primary">Draw</p>
        <p className="font-semibold text-electric-blue">@{match.odds.draw.toFixed(2)}</p>
      </div>
    </motion.div>
  );
};
