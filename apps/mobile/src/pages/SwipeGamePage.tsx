import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { SwipePredictionOutcome, SwipeMatch } from '../types';
import { SwipeCard } from '../components/SwipeCard';
import { AnimatePresence } from 'framer-motion';
import { SwipeTutorialModal } from '../components/SwipeTutorialModal';
import { X, Loader2 } from 'lucide-react';
import { useSwipeGameData, useSwipePredictionsData } from '../features/swipe/useSwipeSelectors';
import { useSwipeActions } from '../features/swipe/useSwipeActions';

interface SwipeGamePageProps {
  challengeId: string;
  matchdayId?: string;
  userId: string | null;
  hasSeenSwipeTutorial: boolean;
  onDismissTutorial: (dontShowAgain: boolean) => void;
  onExit: () => void;
  onComplete?: () => void;
}

export const SwipeGamePage: React.FC<SwipeGamePageProps> = ({
  challengeId,
  matchdayId,
  userId,
  hasSeenSwipeTutorial,
  onDismissTutorial,
  onExit,
  onComplete,
}) => {
  const [showTutorial, setShowTutorial] = useState(!hasSeenSwipeTutorial);
  const [cardStack, setCardStack] = useState<SwipeMatch[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const hasInitialized = useRef(false);

  // Get stable actions (never recreated)
  const { initSwipe, savePrediction } = useSwipeActions();

  // Get game data from store (shallow equality prevents re-renders)
  const {
    currentMatchday,
    matches,
    isLoading: isLoadingGame,
    error: gameError,
  } = useSwipeGameData();

  // Get predictions data from store
  const { predictions, isSaving } = useSwipePredictionsData();

  // Initialize store when component mounts or dependencies change
  useEffect(() => {
    initSwipe(challengeId, userId, matchdayId);
  }, [initSwipe, challengeId, userId, matchdayId]);

  // Initialize card stack ONCE when matches first load
  // IMPORTANT: Do NOT depend on predictions - that causes the infinite loop!
  // The card stack should be ALL matches, and we track completion via currentIndex
  useEffect(() => {
    if (hasInitialized.current) return;
    if (!matches || matches.length === 0) return;

    hasInitialized.current = true;

    // Set stack to ALL matches - we'll use currentIndex to track progress
    // Don't filter by predictions here - that would cause re-render cascade
    setCardStack(matches);
    setCurrentIndex(matches.length - 1);
  }, [matches]); // ONLY matches - NOT predictions!

  // Handle swipe prediction
  // savePrediction is a stable reference from store, no need for useRef
  const handleSwipe = useCallback(async (matchId: string, prediction: SwipePredictionOutcome) => {
    if (currentIndex < 0 || !currentMatchday) return;

    const match = cardStack[currentIndex];
    if (!match) return;

    try {
      await savePrediction(matchId, prediction, match.odds);
      setCurrentIndex(prevIndex => prevIndex - 1);

      if (currentIndex === 0 && onComplete) {
        setTimeout(() => onComplete(), 350);
      }
    } catch (err) {
      console.error('Error saving prediction:', err);
    }
  }, [currentIndex, currentMatchday, cardStack, onComplete, savePrediction]);

  const handleCloseTutorial = useCallback((dontShowAgain: boolean) => {
    setShowTutorial(false);
    onDismissTutorial(dontShowAgain);
  }, [onDismissTutorial]);

  // Memoize cards to render to prevent unnecessary re-renders
  const cardsToRender = useMemo(() => {
    if (currentIndex < 0 || cardStack.length === 0) return [];
    return cardStack.slice(0, currentIndex + 1);
  }, [currentIndex, cardStack]);

  // Create stable prediction lookup map
  const predictionMap = useMemo(() => {
    const map = new Map<string, SwipePredictionOutcome>();
    predictions.forEach(p => map.set(p.matchId, p.prediction));
    return map;
  }, [predictions]);

  const swipedCount = cardStack.length - (currentIndex + 1);
  const totalMatchesInStack = cardStack.length;

  // Error state
  if (gameError) {
    return (
      <div className="fixed inset-0 bg-deep-navy flex flex-col items-center justify-center z-40">
        <button
          onClick={onExit}
          className="absolute top-4 right-4 z-50 bg-navy-accent backdrop-blur-sm p-2 rounded-full text-text-secondary hover:bg-white/10 hover:scale-110 transition-all"
        >
          <X size={24} />
        </button>
        <div className="text-center p-6 bg-navy-accent border border-white/10 rounded-2xl shadow-lg max-w-sm mx-4">
          <p className="text-text-primary font-semibold text-lg">Error loading game</p>
          <p className="text-text-secondary text-sm mt-2">
            {gameError.message || 'Something went wrong. Please try again.'}
          </p>
          <button
            onClick={onExit}
            className="mt-4 px-6 py-3 bg-electric-blue text-white rounded-xl font-semibold w-full hover:bg-electric-blue/80"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Loading state - only show when game is still loading
  // Don't wait for predictions loading since it depends on matchday being loaded
  if (isLoadingGame) {
    return (
      <div className="fixed inset-0 bg-deep-navy flex flex-col items-center justify-center z-40">
        <button
          onClick={onExit}
          className="absolute top-4 right-4 z-50 bg-navy-accent backdrop-blur-sm p-2 rounded-full text-text-secondary hover:bg-white/10 hover:scale-110 transition-all"
        >
          <X size={24} />
        </button>
        <Loader2 className="animate-spin text-electric-blue" size={48} />
        <p className="mt-4 text-text-secondary font-semibold">Loading matches...</p>
      </div>
    );
  }

  // No matches available
  if (!currentMatchday || matches.length === 0) {
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

            return (
              <SwipeCard
                key={match.id}
                match={match}
                onSwipe={handleSwipe}
                isTop={isTop}
                currentPrediction={predictionMap.get(match.id)}
              />
            );
          })}
        </AnimatePresence>

        {/* All done message */}
        {currentIndex < 0 && cardStack.length > 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-navy-accent border border-white/10 rounded-3xl shadow-2xl p-8 text-center max-w-sm">
              <div className="text-6xl mb-4">🎉</div>
              <h3 className="text-2xl font-bold text-text-primary mb-2">All Done!</h3>
              <p className="text-text-secondary mb-6">
                You've made predictions for all {totalMatchesInStack} matches
              </p>
              <button
                onClick={onExit}
                className="w-full py-3 bg-gradient-to-r from-electric-blue to-neon-cyan text-white rounded-xl font-semibold hover:shadow-lg"
              >
                View Recap
              </button>
            </div>
          </div>
        )}
      </div>

      {currentIndex >= 0 && (
        <div className="absolute bottom-6 text-center text-text-secondary font-semibold bg-navy-accent backdrop-blur-sm px-4 py-2 rounded-full border border-white/10">
          <p>
            {swipedCount} / {totalMatchesInStack}
          </p>
        </div>
      )}

      {showTutorial && <SwipeTutorialModal onClose={handleCloseTutorial} />}
    </div>
  );
};
