import React, { useState, useMemo, useEffect } from 'react';
import { SwipeMatchDay, UserSwipeEntry, SwipePredictionOutcome, SwipeMatch } from '../types';
import { SwipeCard } from '../components/SwipeCard';
import { AnimatePresence } from 'framer-motion';
import { SwipeTutorialModal } from '../components/SwipeTutorialModal';
import { X } from 'lucide-react';

interface SwipeGamePageProps {
  matchDay: SwipeMatchDay;
  userEntry: UserSwipeEntry;
  onSwipePrediction: (matchDayId: string, matchId: string, prediction: SwipePredictionOutcome) => void;
  hasSeenSwipeTutorial: boolean;
  onDismissTutorial: (dontShowAgain: boolean) => void;
  onExit: () => void;
}

export const SwipeGamePage: React.FC<SwipeGamePageProps> = ({ matchDay, userEntry, onSwipePrediction, hasSeenSwipeTutorial, onDismissTutorial, onExit }) => {
  const [showTutorial, setShowTutorial] = useState(!hasSeenSwipeTutorial);

  const [cardStack, setCardStack] = useState<SwipeMatch[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);

  useEffect(() => {
    const predictedMatchIds = new Set(userEntry.predictions.map(p => p.matchId));
    const unpredictedMatches = matchDay.matches.filter(m => !predictedMatchIds.has(m.id));
    
    const initialStack = unpredictedMatches.length > 0 ? unpredictedMatches : matchDay.matches;
    
    setCardStack(initialStack);
    setCurrentIndex(initialStack.length - 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchDay.id]);


  const handleSwipe = (matchId: string, prediction: SwipePredictionOutcome) => {
    if (currentIndex < 0) return;
    
    setCurrentIndex(prevIndex => prevIndex - 1);
    
    onSwipePrediction(matchDay.id, matchId, prediction);
  };

  const handleCloseTutorial = (dontShowAgain: boolean) => {
    setShowTutorial(false);
    onDismissTutorial(dontShowAgain);
  };
  
  const swipedCount = cardStack.length - (currentIndex + 1);
  const totalMatchesInStack = cardStack.length;

  // The cards to be rendered are a slice of the stack from the beginning up to the current card.
  // When a card is swiped, currentIndex decreases, and this slice becomes smaller,
  // effectively removing the top card from the DOM and triggering AnimatePresence's exit animation.
  const cardsToRender = useMemo(() => {
    if (currentIndex < 0 || cardStack.length === 0) return [];
    return cardStack.slice(0, currentIndex + 1);
  }, [cardStack, currentIndex]);


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
          {cardsToRender.map((match, index) => {
            const isTop = index === cardsToRender.length - 1;
            const currentPrediction = userEntry.predictions.find(p => p.matchId === match.id)?.prediction;
            
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

      {currentIndex >= 0 && (
        <div className="absolute bottom-6 text-center text-gray-500 font-semibold bg-white/50 backdrop-blur-sm px-4 py-2 rounded-full">
            <p>{swipedCount} / {totalMatchesInStack}</p>
        </div>
      )}

      {showTutorial && (
        <SwipeTutorialModal onClose={handleCloseTutorial} />
      )}
    </div>
  );
};
