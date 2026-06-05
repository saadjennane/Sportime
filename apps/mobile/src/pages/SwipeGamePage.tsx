import React, { useState, useMemo, useEffect } from 'react';
import { SwipePredictionOutcome, SwipeMatch } from '../types';
import { SwipeCard } from '../components/SwipeCard';
import { AnimatePresence } from 'framer-motion';
import { SwipeTutorialModal } from '../components/SwipeTutorialModal';
import { X, Loader2 } from 'lucide-react';
import { useSwipeGame } from '../features/swipe/useSwipeGame';
import { useSwipePredictions } from '../features/swipe/useSwipePredictions';

interface SwipeGamePageProps {
  challengeId: string;
  matchdayId?: string;
  userId: string | null;
  hasSeenSwipeTutorial: boolean;
  onDismissTutorial: (dontShowAgain: boolean) => void;
  onExit: () => void;
  onComplete?: () => void; // Called when all predictions are made
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

  // Load game data
  const {
    currentMatchday,
    matches,
    isLoading: isLoadingGame,
  } = useSwipeGame(challengeId, userId, matchdayId);

  // Load predictions
  const {
    predictions,
    savePrediction,
    hasPredictionFor,
    isSaving,
    isLoading: isLoadingPredictions,
  } = useSwipePredictions(challengeId, currentMatchday?.id || null, userId);

  const [cardStack, setCardStack] = useState<SwipeMatch[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);

  // Initialize card stack with unpredicted matches
  useEffect(() => {
    if (!matches || matches.length === 0) return;

    // Filter out matches that already have predictions
    const unpredictedMatches = matches.filter(m => !hasPredictionFor(m.id));

    // If all matches are predicted, show all matches (for editing)
    const initialStack = unpredictedMatches.length > 0 ? unpredictedMatches : matches;

    setCardStack(initialStack);
    setCurrentIndex(initialStack.length - 1);
  }, [matches, predictions, hasPredictionFor]);

  // Handle swipe prediction
  const handleSwipe = async (matchId: string, prediction: SwipePredictionOutcome) => {
    if (currentIndex < 0 || !currentMatchday) return;

    const match = cardStack[currentIndex];
    if (!match) return;

    try {
      // Save prediction
      await savePrediction(matchId, prediction, match.odds);

      // Move to next card
      setCurrentIndex(prevIndex => prevIndex - 1);

      // Check if all predictions are made
      if (currentIndex === 0 && onComplete) {
        // Small delay before calling onComplete to let the animation finish
        setTimeout(() => {
          onComplete();
        }, 350);
      }
    } catch (err) {
      console.error('Error saving prediction:', err);
    }
  };

  const handleCloseTutorial = (dontShowAgain: boolean) => {
    setShowTutorial(false);
    onDismissTutorial(dontShowAgain);
  };

  const swipedCount = cardStack.length - (currentIndex + 1);
  const totalMatchesInStack = cardStack.length;

  // The cards to be rendered
  const cardsToRender = useMemo(() => {
    if (currentIndex < 0 || cardStack.length === 0) return [];
    return cardStack.slice(0, currentIndex + 1);
  }, [cardStack, currentIndex]);

  // Loading state
  if (isLoadingGame || isLoadingPredictions) {
    return (
      <div className="fixed inset-0 bg-gray-100 flex flex-col items-center justify-center z-40">
        <Loader2 className="animate-spin text-purple-600" size={48} />
        <p className="mt-4 text-gray-600 font-semibold">Loading matches...</p>
      </div>
    );
  }

  // No matches available
  if (!currentMatchday || matches.length === 0) {
    return (
      <div className="fixed inset-0 bg-gray-100 flex flex-col items-center justify-center z-40">
        <button
          onClick={onExit}
          className="absolute top-4 right-4 z-50 bg-white/50 backdrop-blur-sm p-2 rounded-full text-gray-700 hover:bg-white hover:scale-110 transition-all"
        >
          <X size={24} />
        </button>
        <div className="text-center p-6">
          <p className="text-gray-600 font-semibold text-lg">No matches available</p>
          <p className="text-gray-500 text-sm mt-2">
            There are no matches for this matchday yet
          </p>
          <button
            onClick={onExit}
            className="mt-4 px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-100 flex flex-col items-center justify-center z-40 overflow-hidden">
      <button
        onClick={onExit}
        className="absolute top-4 right-4 z-50 bg-white/50 backdrop-blur-sm p-2 rounded-full text-gray-700 hover:bg-white hover:scale-110 transition-all"
      >
        <X size={24} />
      </button>

      <div className="relative w-[90vw] max-w-sm h-[60vh] flex items-center justify-center">
        {isSaving && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-sm rounded-3xl z-50">
            <Loader2 className="animate-spin text-purple-600" size={32} />
          </div>
        )}

        <AnimatePresence>
          {cardsToRender.map((match, index) => {
            const isTop = index === cardsToRender.length - 1;
            const currentPrediction = predictions.find(p => p.matchId === match.id)?.prediction;

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

        {/* All done message */}
        {currentIndex < 0 && cardStack.length > 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-white rounded-3xl shadow-2xl p-8 text-center max-w-sm">
              <div className="text-6xl mb-4">🎉</div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">All Done!</h3>
              <p className="text-gray-600 mb-6">
                You've made predictions for all {totalMatchesInStack} matches
              </p>
              <button
                onClick={onExit}
                className="w-full py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700"
              >
                View Recap
              </button>
            </div>
          </div>
        )}
      </div>

      {currentIndex >= 0 && (
        <div className="absolute bottom-6 text-center text-gray-500 font-semibold bg-white/50 backdrop-blur-sm px-4 py-2 rounded-full">
          <p>
            {swipedCount} / {totalMatchesInStack}
          </p>
        </div>
      )}

      {showTutorial && <SwipeTutorialModal onClose={handleCloseTutorial} />}
    </div>
  );
};
