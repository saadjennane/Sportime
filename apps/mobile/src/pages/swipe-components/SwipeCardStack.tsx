/**
 * SwipeCardStack - Presentational Component for Swipe Cards
 *
 * IMPORTANT: This component is wrapped in memo() to prevent re-renders.
 * All callbacks from parent are passed directly - no useCallback needed here.
 */

import React, { useState, memo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import type { SwipeMatch, SwipePredictionOutcome } from '../../types';
import type { SwipePredictionRecord } from '../../services/swipeGameService';
import { SwipeCard } from '../../components/SwipeCard';
import { SwipeTutorialModal } from '../../components/SwipeTutorialModal';
import { mapPredictionToOutcome } from '../../features/swipe/swipeMappers';

interface SwipeCardStackProps {
  matches: SwipeMatch[];
  predictions: Record<string, SwipePredictionRecord>;
  hasSeenTutorial: boolean;
  onDismissTutorial: (dontShowAgain: boolean) => void;
  onSwipe: (matchId: string, prediction: SwipePredictionOutcome) => void;
  onComplete: () => void;
  onExit: () => void;
}

export const SwipeCardStack = memo<SwipeCardStackProps>(function SwipeCardStack({
  matches,
  predictions,
  hasSeenTutorial,
  onDismissTutorial,
  onSwipe,
  onComplete,
  onExit,
}) {
  const [showTutorial, setShowTutorial] = useState(!hasSeenTutorial);
  const [currentIndex, setCurrentIndex] = useState(() => {
    // Calculate initial index based on matches without predictions
    // Start from the end (stack displays top card last)
    const unpredictedCount = matches.filter(m => !predictions[m.id]).length;
    return unpredictedCount - 1;
  });
  const [isSaving, setIsSaving] = useState(false);

  // Get matches that don't have predictions yet
  const unpredictedMatches = matches.filter(m => !predictions[m.id]);

  function handleCloseTutorial(dontShowAgain: boolean) {
    setShowTutorial(false);
    onDismissTutorial(dontShowAgain);
  }

  function handleSwipe(matchId: string, prediction: SwipePredictionOutcome) {
    // Call parent handler
    onSwipe(matchId, prediction);

    // Move to next card
    if (currentIndex <= 0) {
      // All done
      setTimeout(() => onComplete(), 350);
    } else {
      setCurrentIndex(prev => prev - 1);
    }
  }

  // No matches available
  if (matches.length === 0) {
    return (
      <div className="fixed inset-0 bg-deep-navy flex flex-col items-center justify-center z-40">
        <button
          onClick={onExit}
          className="absolute top-4 right-4 z-50 bg-navy-accent backdrop-blur-sm p-2 rounded-full text-text-secondary hover:bg-white/10 hover:scale-110 transition-all"
        >
          <X size={24} />
        </button>
        <div className="text-center p-6 bg-navy-accent border border-white/10 rounded-2xl shadow-lg max-w-sm mx-4">
          <p className="text-text-primary font-semibold text-lg">No matches available</p>
          <p className="text-text-secondary text-sm mt-2">
            There are no matches for this game yet. Please check back later.
          </p>
          <button
            onClick={onExit}
            className="mt-4 px-6 py-3 bg-electric-blue text-white rounded-xl font-semibold w-full hover:bg-electric-blue/80"
          >
            Go Back to Games
          </button>
        </div>
      </div>
    );
  }

  // All predictions made
  if (unpredictedMatches.length === 0 || currentIndex < 0) {
    return (
      <div className="fixed inset-0 bg-deep-navy flex flex-col items-center justify-center z-40">
        <button
          onClick={onExit}
          className="absolute top-4 right-4 z-50 bg-navy-accent backdrop-blur-sm p-2 rounded-full text-text-secondary hover:bg-white/10 hover:scale-110 transition-all"
        >
          <X size={24} />
        </button>
        <div className="bg-navy-accent border border-white/10 rounded-3xl shadow-2xl p-8 text-center max-w-sm mx-4">
          <div className="text-6xl mb-4">All Done!</div>
          <h3 className="text-2xl font-bold text-text-primary mb-2">All Done!</h3>
          <p className="text-text-secondary mb-6">
            You've made predictions for all {matches.length} matches
          </p>
          <button
            onClick={onComplete}
            className="w-full py-3 bg-gradient-to-r from-electric-blue to-neon-cyan text-white rounded-xl font-semibold hover:shadow-lg"
          >
            View Recap
          </button>
        </div>
      </div>
    );
  }

  // Cards to show (slice from unpredicted matches)
  const cardsToRender = unpredictedMatches.slice(0, currentIndex + 1);
  const swipedCount = unpredictedMatches.length - cardsToRender.length;

  return (
    <div className="fixed inset-0 bg-deep-navy flex flex-col items-center justify-center z-40 overflow-hidden">
      <button
        onClick={onExit}
        className="absolute top-4 right-4 z-50 bg-navy-accent backdrop-blur-sm p-2 rounded-full text-text-secondary hover:bg-white/10 hover:scale-110 transition-all"
      >
        <X size={24} />
      </button>

      <div className="relative w-[90vw] max-w-sm h-[60vh] flex items-center justify-center">
        {isSaving && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm rounded-3xl z-50">
            <Loader2 className="animate-spin text-electric-blue" size={32} />
          </div>
        )}

        <AnimatePresence>
          {cardsToRender.map((match, index) => {
            const isTop = index === cardsToRender.length - 1;
            const predictionRecord = predictions[match.id];
            const currentPrediction = predictionRecord
              ? mapPredictionToOutcome(predictionRecord.prediction)
              : undefined;

            return (
              <SwipeCard
                key={match.id}
                match={match}
                onSwipe={handleSwipe}
                isTop={isTop}
                currentPrediction={currentPrediction}
              />
            );
          })}
        </AnimatePresence>
      </div>

      {/* Progress indicator */}
      <div className="absolute bottom-6 text-center text-text-secondary font-semibold bg-navy-accent backdrop-blur-sm px-4 py-2 rounded-full border border-white/10">
        <p>
          {swipedCount} / {unpredictedMatches.length}
        </p>
      </div>

      {showTutorial && <SwipeTutorialModal onClose={handleCloseTutorial} />}
    </div>
  );
});

SwipeCardStack.displayName = 'SwipeCardStack';

export default SwipeCardStack;
