import { useState, useEffect, useCallback } from 'react';
import {
  getUserNotifications,
  getUnreadCount,
  markAsRead as markNotificationAsRead,
  markAllAsRead as markAllNotificationsAsRead,
  subscribeToNotifications,
} from '../services/notificationService';
import type { Database } from '../types/supabase';

type Notification = Database['public']['Tables']['notifications']['Row'];

interface UseNotificationsResult {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
}

const NOTIFICATIONS_PER_PAGE = 50;

/**
 * Hook to manage notifications from Supabase with real-time updates
 * @param userId - The user ID to fetch notifications for
 * @returns Notifications data with loading states and actions
 */
export function useNotifications(userId: string | null | undefined): UseNotificationsResult {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchNotifications = useCallback(async (reset: boolean = false) => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const currentOffset = reset ? 0 : offset;

      // Fetch notifications
      const data = await getUserNotifications(userId, NOTIFICATIONS_PER_PAGE, currentOffset);

      // Fetch unread count
      const count = await getUnreadCount(userId);

      if (reset) {
        setNotifications(data);
        setOffset(data.length);
      } else {
        setNotifications((prev) => [...prev, ...data]);
        setOffset((prev) => prev + data.length);
      }

      setUnreadCount(count);
      setHasMore(data.length === NOTIFICATIONS_PER_PAGE);
    } catch (err) {
      console.error('[useNotifications] Failed to fetch notifications:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch notifications'));
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [userId, offset]);

  const refetch = useCallback(async () => {
    await fetchNotifications(true);
  }, [fetchNotifications]);

  const loadMore = useCallback(async () => {
    if (!isLoading && hasMore) {
      await fetchNotifications(false);
    }
  }, [isLoading, hasMore, fetchNotifications]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await markNotificationAsRead(notificationId);

      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('[useNotifications] Failed to mark as read:', err);
      // Refetch to sync state
      await refetch();
    }
  }, [refetch]);

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;

    try {
      await markAllNotificationsAsRead(userId);

      // Optimistic update
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('[useNotifications] Failed to mark all as read:', err);
      // Refetch to sync state
      await refetch();
    }
  }, [userId, refetch]);

  // Initial fetch
  useEffect(() => {
    fetchNotifications(true);
  }, [userId]);

  // Real-time subscription for new notifications
  useEffect(() => {
    if (!userId) return;

    const channel = subscribeToNotifications(userId, (newNotification) => {
      console.log('[useNotifications] New notification received:', newNotification);

      // Add new notification to the top of the list
      setNotifications((prev) => [newNotification, ...prev]);

      // Increment unread count if not already read
      if (!newNotification.is_read) {
        setUnreadCount((prev) => prev + 1);
      }
    });

    return () => {
      channel.unsubscribe();
    };
  }, [userId]);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    refetch,
    markAsRead,
    markAllAsRead,
    loadMore,
    hasMore,
  };
}
