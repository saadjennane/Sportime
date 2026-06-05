import { useState, useEffect, useCallback } from 'react';
import { Match } from '../types';

const STORAGE_KEY = 'userLeagueOrder';

export const useLeagueOrder = (matches: Match[]) => {
  const [orderedLeagues, setOrderedLeagues] = useState<string[]>([]);
  const [allLeagues, setAllLeagues] = useState<string[]>([]);

  useEffect(() => {
    const uniqueLeagues = Array.from(new Set(matches.map(m => m.leagueName)));
    setAllLeagues(uniqueLeagues);

    try {
      const storedOrder = localStorage.getItem(STORAGE_KEY);
      if (storedOrder) {
        const parsedOrder = JSON.parse(storedOrder) as string[];
        // Filter out leagues that no longer exist and add new ones
        const currentLeaguesSet = new Set(uniqueLeagues);
        const validStoredOrder = parsedOrder.filter(league => currentLeaguesSet.has(league));
        const newLeagues = uniqueLeagues.filter(league => !validStoredOrder.includes(league));
        setOrderedLeagues([...validStoredOrder, ...newLeagues]);
      } else {
        setOrderedLeagues(uniqueLeagues);
      }
    } catch (error) {
      console.error("Failed to parse league order from localStorage", error);
      setOrderedLeagues(uniqueLeagues);
    }
  }, [matches]);

  const saveOrder = useCallback((newOrder: string[]) => {
    setOrderedLeagues(newOrder);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newOrder));
    } catch (error) {
      console.error("Failed to save league order to localStorage", error);
    }
  }, []);

  return { orderedLeagues, allLeagues, setOrderedLeagues: saveOrder };
};
