/**
 * useFantasy Hooks
 *
 * Comprehensive hooks for Fantasy game functionality with real-time Supabase updates.
 * Provides hooks for players, game weeks, teams, leaderboard, and boosters.
 *
 * Usage:
 *   const { players, isLoading } = useFantasyPlayers();
 *   const { gameWeek, isLoading } = useCurrentGameWeek(gameId);
 *   const { team, saveTeam } = useFantasyTeam(userId, gameWeekId);
 *   const { leaderboard } = useFantasyLeaderboard(gameId, gameWeekId);
 *   const { boosters } = useFantasyBoosters();
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import {
  getAvailableFantasyPlayers,
  getCurrentGameWeek,
  getGameWeeks,
  getUserFantasyTeam,
  saveUserFantasyTeam,
  getFantasyLeaderboard,
  getFantasyBoosters,
} from '../services/fantasyService';
import type {
  FantasyPlayer,
  FantasyGameWeek,
  UserFantasyTeam,
  FantasyLeaderboardEntry,
} from '../types';

// ============================================================================
// useFantasyPlayers - Fetch available Fantasy players
// ============================================================================

interface UseFantasyPlayersReturn {
  players: FantasyPlayer[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useFantasyPlayers(): UseFantasyPlayersReturn {
  const [players, setPlayers] = useState<FantasyPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlayers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await getAvailableFantasyPlayers();
      setPlayers(data);
    } catch (err: any) {
      console.error('[useFantasyPlayers] Error:', err);
      setError(err.message || 'Failed to load Fantasy players');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  // Subscribe to real-time updates on fantasy_players table
  useEffect(() => {
    const channel = supabase
      .channel('fantasy-players-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fantasy_players',
        },
        (payload) => {
          console.log('[useFantasyPlayers] Players updated, refetching...');
          fetchPlayers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPlayers]);

  return {
    players,
    isLoading,
    error,
    refetch: fetchPlayers,
  };
}

// ============================================================================
// useCurrentGameWeek - Fetch current live game week
// ============================================================================

interface UseCurrentGameWeekReturn {
  gameWeek: FantasyGameWeek | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCurrentGameWeek(gameId: string | null): UseCurrentGameWeekReturn {
  const [gameWeek, setGameWeek] = useState<FantasyGameWeek | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGameWeek = useCallback(async () => {
    if (!gameId) {
      setGameWeek(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await getCurrentGameWeek(gameId);
      setGameWeek(data);
    } catch (err: any) {
      console.error('[useCurrentGameWeek] Error:', err);
      setError(err.message || 'Failed to load current game week');
    } finally {
      setIsLoading(false);
    }
  }, [gameId]);

  // Initial fetch
  useEffect(() => {
    fetchGameWeek();
  }, [fetchGameWeek]);

  // Subscribe to real-time updates on fantasy_game_weeks table
  useEffect(() => {
    if (!gameId) return;

    const channel = supabase
      .channel(`game-week-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fantasy_game_weeks',
          filter: `fantasy_game_id=eq.${gameId}`,
        },
        (payload) => {
          console.log('[useCurrentGameWeek] Game week updated, refetching...');
          fetchGameWeek();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, fetchGameWeek]);

  return {
    gameWeek,
    isLoading,
    error,
    refetch: fetchGameWeek,
  };
}

// ============================================================================
// useGameWeeks - Fetch all game weeks for a game
// ============================================================================

interface UseGameWeeksReturn {
  gameWeeks: FantasyGameWeek[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useGameWeeks(gameId: string | null): UseGameWeeksReturn {
  const [gameWeeks, setGameWeeks] = useState<FantasyGameWeek[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGameWeeks = useCallback(async () => {
    if (!gameId) {
      setGameWeeks([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await getGameWeeks(gameId);
      setGameWeeks(data);
    } catch (err: any) {
      console.error('[useGameWeeks] Error:', err);
      setError(err.message || 'Failed to load game weeks');
    } finally {
      setIsLoading(false);
    }
  }, [gameId]);

  // Initial fetch
  useEffect(() => {
    fetchGameWeeks();
  }, [fetchGameWeeks]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!gameId) return;

    const channel = supabase
      .channel(`game-weeks-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fantasy_game_weeks',
          filter: `fantasy_game_id=eq.${gameId}`,
        },
        (payload) => {
          console.log('[useGameWeeks] Game weeks updated, refetching...');
          fetchGameWeeks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, fetchGameWeeks]);

  return {
    gameWeeks,
    isLoading,
    error,
    refetch: fetchGameWeeks,
  };
}

// ============================================================================
// useFantasyTeam - Fetch and save user's Fantasy team
// ============================================================================

interface UseFantasyTeamReturn {
  team: UserFantasyTeam | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  saveTeam: (team: UserFantasyTeam) => Promise<boolean>;
  refetch: () => Promise<void>;
}

export function useFantasyTeam(
  userId: string | null,
  gameWeekId: string | null
): UseFantasyTeamReturn {
  const [team, setTeam] = useState<UserFantasyTeam | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTeam = useCallback(async () => {
    if (!userId || !gameWeekId) {
      setTeam(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await getUserFantasyTeam(userId, gameWeekId);
      setTeam(data);
    } catch (err: any) {
      console.error('[useFantasyTeam] Error:', err);
      setError(err.message || 'Failed to load Fantasy team');
    } finally {
      setIsLoading(false);
    }
  }, [userId, gameWeekId]);

  const handleSaveTeam = useCallback(
    async (teamToSave: UserFantasyTeam): Promise<boolean> => {
      setIsSaving(true);
      setError(null);

      try {
        const success = await saveUserFantasyTeam(teamToSave);
        if (success) {
          setTeam(teamToSave);
        }
        return success;
      } catch (err: any) {
        console.error('[useFantasyTeam] Save error:', err);
        setError(err.message || 'Failed to save Fantasy team');
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    []
  );

  // Initial fetch
  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  // Subscribe to real-time updates on user_fantasy_teams table
  useEffect(() => {
    if (!userId || !gameWeekId) return;

    const channel = supabase
      .channel(`fantasy-team-${userId}-${gameWeekId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_fantasy_teams',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('[useFantasyTeam] Team updated, refetching...');
          fetchTeam();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, gameWeekId, fetchTeam]);

  return {
    team,
    isLoading,
    isSaving,
    error,
    saveTeam: handleSaveTeam,
    refetch: fetchTeam,
  };
}

// ============================================================================
// useFantasyLeaderboard - Fetch Fantasy leaderboard for a game week
// ============================================================================

interface UseFantasyLeaderboardReturn {
  leaderboard: FantasyLeaderboardEntry[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useFantasyLeaderboard(
  gameId: string | null,
  gameWeekId: string | null
): UseFantasyLeaderboardReturn {
  const [leaderboard, setLeaderboard] = useState<FantasyLeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    if (!gameId || !gameWeekId) {
      setLeaderboard([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await getFantasyLeaderboard(gameId, gameWeekId);
      setLeaderboard(data);
    } catch (err: any) {
      console.error('[useFantasyLeaderboard] Error:', err);
      setError(err.message || 'Failed to load leaderboard');
    } finally {
      setIsLoading(false);
    }
  }, [gameId, gameWeekId]);

  // Initial fetch
  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // Subscribe to real-time updates on fantasy_leaderboard table
  useEffect(() => {
    if (!gameWeekId) return;

    const channel = supabase
      .channel(`fantasy-leaderboard-${gameWeekId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fantasy_leaderboard',
          filter: `game_week_id=eq.${gameWeekId}`,
        },
        (payload) => {
          console.log('[useFantasyLeaderboard] Leaderboard updated, refetching...');
          fetchLeaderboard();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameWeekId, fetchLeaderboard]);

  return {
    leaderboard,
    isLoading,
    error,
    refetch: fetchLeaderboard,
  };
}

// ============================================================================
// useFantasyBoosters - Fetch available Fantasy boosters
// ============================================================================

interface FantasyBooster {
  id: number;
  name: string;
  description: string;
  icon: string | null;
  type: 'regular' | 'live';
  created_at?: string;
}

interface UseFantasyBoostersReturn {
  boosters: FantasyBooster[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useFantasyBoosters(): UseFantasyBoostersReturn {
  const [boosters, setBoosters] = useState<FantasyBooster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBoosters = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await getFantasyBoosters();
      setBoosters(data);
    } catch (err: any) {
      console.error('[useFantasyBoosters] Error:', err);
      setError(err.message || 'Failed to load boosters');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchBoosters();
  }, [fetchBoosters]);

  // Subscribe to real-time updates on fantasy_boosters table
  useEffect(() => {
    const channel = supabase
      .channel('fantasy-boosters-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fantasy_boosters',
        },
        (payload) => {
          console.log('[useFantasyBoosters] Boosters updated, refetching...');
          fetchBoosters();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchBoosters]);

  return {
    boosters,
    isLoading,
    error,
    refetch: fetchBoosters,
  };
}
