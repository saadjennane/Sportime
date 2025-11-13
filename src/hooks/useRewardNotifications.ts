import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { RewardItem } from '../types';

interface RewardNotificationData {
  id: string;
  rewards: RewardItem[];
  timestamp: Date;
}

export function useRewardNotifications(userId: string | undefined) {
  const [notifications, setNotifications] = useState<RewardNotificationData[]>([]);

  useEffect(() => {
    if (!userId) return;

    // Subscribe to new reward notifications in real-time
    const channel = supabase
      .channel('reward-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const notification = payload.new;

          // Only process reward notifications
          if (notification.type === 'reward') {
            console.log('[useRewardNotifications] New reward notification:', notification);

            // Extract reward data from metadata
            const metadata = notification.metadata || {};
            const rewardItem: RewardItem = {
              id: notification.id,
              type: metadata.reward_type || 'custom',
              value: metadata.reward_value,
              tier: metadata.reward_tier,
              name: notification.title,
            };

            // Add to notifications array
            const newNotification: RewardNotificationData = {
              id: notification.id,
              rewards: [rewardItem],
              timestamp: new Date(notification.created_at),
            };

            setNotifications((prev) => [...prev, newNotification]);

            // Auto-remove after display (handled by RewardNotification component)
          }
        }
      )
      .subscribe((status) => {
        console.log('[useRewardNotifications] Subscription status:', status);
      });

    // Cleanup subscription
    return () => {
      console.log('[useRewardNotifications] Unsubscribing');
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return {
    notifications,
    removeNotification,
  };
}
