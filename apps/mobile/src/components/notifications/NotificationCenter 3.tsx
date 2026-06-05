import React, { useEffect, useRef } from 'react';
import { Notification } from '../../types';
import { X, CheckCheck, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { NotificationItem } from './NotificationItem';
import { useNotifications } from '../../hooks/useNotifications';
import type { Database } from '../../types/supabase';

type SupabaseNotification = Database['public']['Tables']['notifications']['Row'];

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | null | undefined;
}

// Convert Supabase notification to frontend format
function mapNotification(n: SupabaseNotification): Notification {
  return {
    id: n.id,
    type: n.type as Notification['type'],
    title: n.title,
    message: n.message,
    timestamp: n.created_at,
    isRead: n.is_read,
    action: n.action_label
      ? {
          label: n.action_label,
          link: n.action_link || undefined,
        }
      : undefined,
  };
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ isOpen, onClose, userId }) => {
  const {
    notifications: supabaseNotifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    loadMore,
    hasMore,
  } = useNotifications(userId);

  const notifications = supabaseNotifications.map(mapNotification);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Handle infinite scroll
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !hasMore || isLoading) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;

      if (isNearBottom) {
        loadMore();
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [hasMore, isLoading, loadMore]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-50"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-deep-navy border-l border-disabled shadow-2xl flex flex-col z-50"
          >
            <header className="flex items-center justify-between p-4 border-b border-disabled flex-shrink-0">
              <h2 className="text-xl font-bold text-text-primary">Notifications</h2>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button onClick={markAllAsRead} className="text-xs font-semibold text-electric-blue hover:underline">
                    Mark all as read
                  </button>
                )}
                <button onClick={onClose} className="p-2 text-text-secondary hover:bg-white/10 rounded-full">
                  <X size={20} />
                </button>
              </div>
            </header>

            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
              {notifications.length > 0 ? (
                <>
                  {notifications.map(notification => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onMarkAsRead={() => markAsRead(notification.id)}
                    />
                  ))}
                  {isLoading && (
                    <div className="flex justify-center p-4">
                      <Loader2 size={24} className="animate-spin text-electric-blue" />
                    </div>
                  )}
                </>
              ) : isLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 size={48} className="animate-spin text-electric-blue" />
                </div>
              ) : (
                <div className="text-center p-8 text-text-disabled">
                  <CheckCheck size={48} className="mx-auto mb-4" />
                  <p className="font-semibold">All caught up!</p>
                  <p className="text-sm">You have no new notifications.</p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
