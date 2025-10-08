import React, { useState, useMemo, useEffect } from 'react';
import { SwipeMatchDay, UserSwipeEntry, SwipePredictionOutcome } from '../types';
import { SwipeCard } from '../components/SwipeCard';
import { AnimatePresence } from 'framer-motion';
import { SwipeTutorialModal } from '../components/SwipeTutorialModal';
import { X } from 'lucide-react';

interface SwipeGamePageProps {
  matchDay: SwipeMatchDay;
  userEntry: UserSwipeEntry;
  onSwipePrediction: (matchId: string, prediction: SwipePredictionOutcome) => void;
  onAllSwipesDone: () => void;
  hasSeenSwipeTutorial: boolean;
  onDismissTutorial: (dontShowAgain: boolean) => void;
  onExit: () => void;
}

export const SwipeGamePage: React.FC<SwipeGamePageProps> = ({ matchDay, userEntry, onSwipePrediction, onAllSwipesDone, hasSeenSwipeTutorial, onDismissTutorial, onExit }) => {
  const [showTutorial, setShowTutorial] = useState(!hasSeenSwipeTutorial);
  // Refactored state: use an array of matches left to swipe instead of an index.
  const [matchesLeft, setMatchesLeft] = useState([...matchDay.matches]);

  const handleSwipe = (matchId: string, prediction: SwipePredictionOutcome) => {
    onSwipePrediction(matchId, prediction);
    // This will trigger the AnimatePresence exit animation for the swiped card.
    setMatchesLeft(prev => prev.filter(m => m.id !== matchId));
  };

  useEffect(() => {
    // When no matches are left, trigger the completion callback.
    if (matchesLeft.length === 0 && !showTutorial) {
      const timer = setTimeout(() => {
        onAllSwipesDone();
      }, 300); // Delay to allow the last card's exit animation to finish.
      return () => clearTimeout(timer);
    }
  }, [matchesLeft, onAllSwipesDone, showTutorial]);

  const handleCloseTutorial = (dontShowAgain: boolean) => {
    setShowTutorial(false);
    onDismissTutorial(dontShowAgain);
  };
  
  const swipedCount = matchDay.matches.length - matchesLeft.length;

  return (
    <div className="fixed inset-0 bg-gray-100 flex flex-col items-center justify-center z-40 overflow-hidden">
      
      <button 
        onClick={onExit}
        className="absolute top-4 right-4 z-50 bg-white/50 backdrop-blur-sm p-2 rounded-full text-gray-700 hover:bg-white hover:scale-110 transition-all"
      >
        <X size={24} />
      </button>

      <div className="relative w-[90vw] max-w-sm h-[60vh] flex items-center justify-center">
        <AnimatePresence>
          {matchesLeft.map((match, index) => {
            const currentPrediction = userEntry.predictions.find(p => p.matchId === match.id)?.prediction;
            return (
              <SwipeCard
                key={match.id}
                match={match}
                onSwipe={handleSwipe}
                isTop={index === matchesLeft.length - 1} // The last item in the array is on top
                currentPrediction={currentPrediction}
              />
            );
          })}
        </AnimatePresence>
      </div>

      {matchesLeft.length === 0 && !showTutorial && (
        <div className="absolute text-center p-8 animate-scale-in">
          <h2 className="text-2xl font-bold">All Done!</h2>
          <p className="text-gray-600">Taking you to your picks...</p>
        </div>
      )}

      {matchesLeft.length > 0 && (
        <div className="absolute bottom-6 text-center text-gray-500 font-semibold bg-white/50 backdrop-blur-sm px-4 py-2 rounded-full">
            <p>{swipedCount} / {matchDay.matches.length}</p>
        </div>
      )}

      {showTutorial && (
        <SwipeTutorialModal onClose={handleCloseTutorial} />
      )}
    </div>
  );
};
