/**
 * useSwipePredictions Hook
 *
 * Manages user predictions for a swipe game including:
 * - Fetching user predictions
 * - Saving/updating predictions
 * - Calculating stats
 * - Real-time updates
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabase';
import * as swipeService from '../../services/swipeGameService';
import {
  mapOutcomeToPrediction,
  predictionRecordsToSwipePredictions,
  canMakePrediction,
} from './swipeMappers';
import type { SwipePrediction, SwipePredictionOutcome } from '../../types';
import type { SwipePredictionRecord } from '../../services/swipeGameService';

interface PredictionStats {
  totalPredictions: number;
  correctPredictions: number;
  totalPoints: number;
  accuracy: number;
}

interface UseSwipePredictionsReturn {
  // Predictions data
  predictions: SwipePrediction[];
  predictionRecords: SwipePredictionRecord[];

  // Stats
  stats: PredictionStats;

  // State
  isLoading: boolean;
  isSaving: boolean;
  error: Error | null;

  // Actions
  savePrediction: (
    fixtureId: string,
    prediction: SwipePredictionOutcome,
    odds: { teamA: number; draw: number; teamB: number }
  ) => Promise<void>;
  refresh: () => Promise<void>;
  hasPredictionFor: (fixtureId: string) => boolean;
  getPredictionFor: (fixtureId: string) => SwipePrediction | undefined;
}

export function useSwipePredictions(
  challengeId: string,
  matchdayId: string | null,
  userId: string | null
): UseSwipePredictionsReturn {
  const [predictions, setPredictions] = useState<SwipePrediction[]>([]);
  const [predictionRecords, setPredictionRecords] = useState<SwipePredictionRecord[]>([]);
  const [stats, setStats] = useState<PredictionStats>({
    totalPredictions: 0,
    correctPredictions: 0,
    totalPoints: 0,
    accuracy: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Load predictions
  const loadPredictions = useCallback(async () => {
    if (!userId || !matchdayId) {
      setPredictions([]);
      setPredictionRecords([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const records = await swipeService.getUserMatchdayPredictions(matchdayId, userId);
      setPredictionRecords(records);

      // Convert to UI format
      const uiPredictions = predictionRecordsToSwipePredictions(records);
      setPredictions(uiPredictions);

      // Calculate stats
      const totalPoints = records.reduce((sum, p) => sum + (p.points_earned || 0), 0);
      const correctCount = records.filter(p => p.is_correct === true).length;
      const totalCount = records.length;

      setStats({
        totalPredictions: totalCount,
        correctPredictions: correctCount,
        totalPoints,
        accuracy: totalCount > 0 ? (correctCount / totalCount) * 100 : 0,
      });
    } catch (err) {
      console.error('Error loading predictions:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [matchdayId, userId]);

  // Save a prediction
  const savePrediction = useCallback(
    async (
      fixtureId: string,
      prediction: SwipePredictionOutcome,
      odds: { teamA: number; draw: number; teamB: number }
    ) => {
      if (!userId || !matchdayId) {
        throw new Error('User must be logged in to save predictions');
      }

      setIsSaving(true);
      setError(null);

      try {
        // Convert odds from UI format to DB format
        const dbOdds = {
          home: odds.teamA,
          draw: odds.draw,
          away: odds.teamB,
        };

        // Convert prediction from UI format to DB format
        const dbPrediction = mapOutcomeToPrediction(prediction);

        await swipeService.savePrediction({
          challengeId,
          matchdayId,
          userId,
          fixtureId,
          prediction: dbPrediction,
          odds: dbOdds,
        });

        // Reload predictions to get updated state
        await loadPredictions();
      } catch (err) {
        console.error('Error saving prediction:', err);
        setError(err as Error);
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [challengeId, matchdayId, userId, loadPredictions]
  );

  // Check if user has prediction for a fixture
  const hasPredictionFor = useCallback(
    (fixtureId: string): boolean => {
      return predictions.some(p => p.matchId === fixtureId);
    },
    [predictions]
  );

  // Get prediction for a specific fixture
  const getPredictionFor = useCallback(
    (fixtureId: string): SwipePrediction | undefined => {
      return predictions.find(p => p.matchId === fixtureId);
    },
    [predictions]
  );

  // Refresh predictions
  const refresh = useCallback(async () => {
    await loadPredictions();
  }, [loadPredictions]);

  // Initial load
  useEffect(() => {
    loadPredictions();
  }, [loadPredictions]);

  // Real-time subscription disabled temporarily to debug re-render issue
  // TODO: Re-enable after fixing infinite loop
  // useEffect(() => {
  //   if (!userId || !matchdayId) return;
  //   const channel = supabase
  //     .channel(`swipe-predictions-${matchdayId}-${userId}`)
  //     .on('postgres_changes', { event: '*', schema: 'public', table: 'swipe_predictions',
  //       filter: `matchday_id=eq.${matchdayId},user_id=eq.${userId}` },
  //       () => loadPredictions()
  //     ).subscribe();
  //   return () => { channel.unsubscribe(); };
  // }, [matchdayId, userId, loadPredictions]);

  return {
    predictions,
    predictionRecords,
    stats,
    isLoading,
    isSaving,
    error,
    savePrediction,
    refresh,
    hasPredictionFor,
    getPredictionFor,
  };
}
