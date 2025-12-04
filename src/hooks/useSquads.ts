import { useState, useEffect } from 'react';
import { getUserSquads, getSquadById } from '../services/squadService';
import type { Squad } from '../types';

interface UseSquadsResult {
  squads: (Squad & { role: string })[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch and manage user's squads
 * @param userId - The user ID to fetch squads for
 * @returns User's squads with loading and error states
 */
export function useSquads(userId: string | null | undefined): UseSquadsResult {
  const [squads, setSquads] = useState<(Squad & { role: string })[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchSquads = async () => {
    if (!userId) {
      setSquads([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await getUserSquads(userId);
      setSquads(data);
    } catch (err) {
      console.error('[useSquads] Failed to fetch squads:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch squads'));
      setSquads([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSquads();
  }, [userId]);

  return {
    squads,
    isLoading,
    error,
    refetch: fetchSquads,
  };
}

interface UseSquadDetailsResult {
  squad: (Squad & { member_count: number }) | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch and manage a single squad's details
 * @param squadId - The squad ID to fetch
 * @returns Squad details with loading and error states
 */
export function useSquadDetails(squadId: string | null | undefined): UseSquadDetailsResult {
  const [squad, setSquad] = useState<(Squad & { member_count: number }) | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchSquad = async () => {
    if (!squadId) {
      setSquad(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await getSquadById(squadId);
      setSquad(data);
    } catch (err) {
      console.error('[useSquadDetails] Failed to fetch squad:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch squad'));
      setSquad(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSquad();
  }, [squadId]);

  return {
    squad,
    isLoading,
    error,
    refetch: fetchSquad,
  };
}
