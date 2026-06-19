/**
 * SwipeCardStack - Presentational Component for Swipe Cards
 *
 * IMPORTANT: This component is wrapped in memo() to prevent re-renders.
 * All callbacks from parent are passed directly - no useCallback needed here.
 */

import React, { useState, useEffect, memo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { X, Undo2 } from 'lucide-react';
import type { SwipeMatch, SwipePredictionOutcome } from '../../types';
import type { SwipePredictionRecord } from '../../services/swipeGameService';
import { SwipeCard } from '../../components/SwipeCard';
import { SwipeTutorialModal } from '../../components/SwipeTutorialModal';
import { mapPredictionToOutcome } from '../../features/swipe/swipeMappers';
import { hapticImpact } from '../../native/haptics';
import { SwipeBoosterBar, GameBoosters } from './SwipeBoosterBar';

type BoosterType = 'x2' | 'x3';

interface SwipeCardStackProps {
  matches: SwipeMatch[];
  predictions: Record<string, SwipePredictionRecord>;
  hasSeenTutorial: boolean;
  onDismissTutorial: (dontShowAgain: boolean) => void;
  onSwipe: (matchId: string, prediction: SwipePredictionOutcome, booster?: BoosterType) => void;
  onUndo?: (matchId: string) => void;
  onComplete: () => void;
  onExit: () => void;
  /** If true, show all matches (including already predicted) for editing */
  editMode?: boolean;
  gameBoosters?: GameBoosters;
  currentMatchdayId?: string | null;
  onCancelBooster?: (fixtureId: string) => void;
}

export const SwipeCardStack = memo<SwipeCardStackProps>(function SwipeCardStack({
  matches,
  predictions,
  hasSeenTutorial,
  onDismissTutorial,
  onSwipe,
  onUndo,
  onComplete,
  onExit,
  editMode = false,
  gameBoosters,
  currentMatchdayId,
  onCancelBooster,
}) {
  const [showTutorial, setShowTutorial] = useState(!hasSeenTutorial);
  const [armedBooster, setArmedBooster] = useState<BoosterType | null>(null);

  // In edit mode, show ALL matches; otherwise only unpredicted
  const matchesToShow = editMode ? matches : matches.filter(m => !predictions[m.id]);

  const [currentIndex, setCurrentIndex] = useState(() => {
    // Start from the end (stack displays top card last)
    return matchesToShow.length - 1;
  });
  // Last committed pick, so it can be undone in-deck.
  const [lastSwiped, setLastSwiped] = useState<string | null>(null);
  // True while the last card is flying off, before we switch to the recap —
  // keeps the AnimatePresence mounted so the exit animation actually plays.
  const [exiting, setExiting] = useState(false);

  // Keep the index in range if the deck shrinks/grows after an external refresh.
  useEffect(() => {
    setCurrentIndex(idx => Math.min(idx, matchesToShow.length - 1));
  }, [matchesToShow.length]);

  function handleCloseTutorial(dontShowAgain: boolean) {
    setShowTutorial(false);
    onDismissTutorial(dontShowAgain);
  }

  // Undo the last swipe: remove its pick (re-shows the card) and step back.
  function handleUndo() {
    if (!lastSwiped) return;
    hapticImpact('light');
    onUndo?.(lastSwiped);
    setCurrentIndex(prev => prev + 1);
    setLastSwiped(null);
  }

  function handleSwipe(matchId: string, prediction: SwipePredictionOutcome) {
    // Block swipe if match has already started
    const match = matches.find(m => m.id === matchId);
    if (match && new Date(match.kickoffTime) <= new Date()) {
      console.warn('[SwipeCardStack] Match already started, cannot save prediction');
      // Move to next card without saving
      if (currentIndex <= 0) {
        setTimeout(() => onComplete(), 350);
      } else {
        setCurrentIndex(prev => prev - 1);
      }
      return;
    }

    // Tactile feedback at the moment a prediction is committed (native only).
    hapticImpact('medium');

    // Call parent handler (carries the armed booster so it sticks to this match).
    onSwipe(matchId, prediction, armedBooster ?? undefined);
    setLastSwiped(matchId);
    if (armedBooster) setArmedBooster(null);

    // Move to next card
    if (currentIndex <= 0) {
      // Last card: remove it so AnimatePresence plays its exit (fly-off), keep the
      // stack mounted via `exiting`, then go to the recap once it has flown off.
      setExiting(true);
      setCurrentIndex(-1);
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
          className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 z-50 bg-navy-accent backdrop-blur-sm p-2 rounded-full text-text-secondary hover:bg-white/10 hover:scale-110 transition-all"
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

  // All cards swiped through (but not while the last card is still flying off)
  if (!exiting && (matchesToShow.length === 0 || currentIndex < 0)) {
    return (
      <div className="fixed inset-0 bg-deep-navy flex flex-col items-center justify-center z-40">
        <button
          onClick={onExit}
          className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 z-50 bg-navy-accent backdrop-blur-sm p-2 rounded-full text-text-secondary hover:bg-white/10 hover:scale-110 transition-all"
        >
          <X size={24} />
        </button>
        <div className="bg-navy-accent border border-white/10 rounded-3xl shadow-2xl p-8 text-center max-w-sm mx-4">
          <h3 className="text-2xl font-bold text-text-primary mb-2">
            {editMode ? 'Review Complete!' : 'All Done!'}
          </h3>
          <p className="text-text-secondary mb-6">
            {editMode
              ? `You've reviewed all ${matches.length} matches`
              : `You've made predictions for all ${matches.length} matches`}
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

  // Cards to show (slice from matches to show)
  const cardsToRender = matchesToShow.slice(0, currentIndex + 1);
  const swipedCount = matchesToShow.length - cardsToRender.length;

  return (
    <div className="fixed inset-0 bg-deep-navy flex flex-col items-center justify-center z-40 overflow-hidden">
      <button
        onClick={onExit}
        className="absolute top-[max(1rem,calc(env(safe-area-inset-top)+0.5rem))] right-4 z-50 bg-navy-accent backdrop-blur-sm p-2 rounded-full text-text-secondary hover:bg-white/10 hover:scale-110 transition-all"
      >
        <X size={24} />
      </button>

      <div className="relative w-[90vw] max-w-sm h-[60vh] flex items-center justify-center" style={{ touchAction: 'none' }}>
        <AnimatePresence>
          {cardsToRender.map((match, index) => {
            const isTop = index === cardsToRender.length - 1;
            const predictionRecord = predictions[match.id];
            const currentPrediction = predictionRecord
              ? mapPredictionToOutcome(predictionRecord.prediction)
              : undefined;
            // Top card previews the armed booster; any card shows its committed booster.
            const cardBooster = (isTop ? armedBooster : null) ?? predictionRecord?.booster ?? undefined;
            // Real odds are always > 1.0 — block swiping until they're synced.
            const oddsReady = match.odds.teamA > 1 && match.odds.draw > 1 && match.odds.teamB > 1;

            return (
              <SwipeCard
                key={match.id}
                match={match}
                onSwipe={handleSwipe}
                isTop={isTop}
                currentPrediction={currentPrediction}
                booster={cardBooster ?? undefined}
                oddsReady={oddsReady}
              />
            );
          })}
        </AnimatePresence>
      </div>

      {/* Boosters bar */}
      {gameBoosters && (
        <div className="absolute bottom-20">
          <SwipeBoosterBar
            gameBoosters={gameBoosters}
            currentMatchdayId={currentMatchdayId ?? null}
            armed={armedBooster}
            onArm={setArmedBooster}
            onCancel={(fid) => onCancelBooster?.(fid)}
            armHint="Swipe a match to apply this booster"
          />
        </div>
      )}

      {/* Progress indicator + Undo */}
      <div className="absolute bottom-6 flex items-center gap-3">
        <div className="text-center text-text-secondary font-semibold bg-navy-accent backdrop-blur-sm px-4 py-2 rounded-full border border-white/10">
          <p>
            {swipedCount} / {matchesToShow.length}
          </p>
        </div>
        {lastSwiped && onUndo && (
          <button
            onClick={handleUndo}
            className="flex items-center gap-1.5 bg-navy-accent backdrop-blur-sm px-4 py-2 rounded-full border border-white/10 text-warm-yellow font-semibold hover:bg-white/5 active:scale-95 transition-all"
          >
            <Undo2 size={16} /> Undo
          </button>
        )}
      </div>

      {showTutorial && <SwipeTutorialModal onClose={handleCloseTutorial} />}
    </div>
  );
});

SwipeCardStack.displayName = 'SwipeCardStack';

export default SwipeCardStack;
