import { useState, useEffect } from 'react';
import { getUserTickets } from '../services/ticketService';
import { UserTicket, TicketTier } from '../types';

interface UseUserTicketsOptions {
  userId: string | null;
  ticketType?: TicketTier;
  includeExpired?: boolean;
  includeUsed?: boolean;
  enabled?: boolean;
}

export function useUserTickets({
  userId,
  ticketType,
  includeExpired = false,
  includeUsed = false,
  enabled = true,
}: UseUserTicketsOptions) {
  const [tickets, setTickets] = useState<UserTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled || !userId) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    async function fetchTickets() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getUserTickets(userId, ticketType, includeExpired, includeUsed);
        if (isMounted) {
          setTickets(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Failed to fetch tickets'));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchTickets();

    return () => {
      isMounted = false;
    };
  }, [userId, ticketType, includeExpired, includeUsed, enabled]);

  const refresh = async () => {
    if (!userId) return;

    try {
      setIsLoading(true);
      setError(null);
      const data = await getUserTickets(userId, ticketType, includeExpired, includeUsed);
      setTickets(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to refresh tickets'));
    } finally {
      setIsLoading(false);
    }
  };

  return { tickets, isLoading, error, refresh };
}
