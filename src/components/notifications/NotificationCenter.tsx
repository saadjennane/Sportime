import React from 'react';
import { Notification } from '../../types';
import { X, CheckCheck } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { NotificationItem } from './NotificationItem';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ isOpen, onClose, notifications, onMarkAsRead, onMarkAllAsRead }) => {
  const unreadCount = notifications.filter(n => !n.isRead).length;

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
                  <button onClick={onMarkAllAsRead} className="text-xs font-semibold text-electric-blue hover:underline">
                    Mark all as read
                  </button>
                )}
                <button onClick={onClose} className="p-2 text-text-secondary hover:bg-white/10 rounded-full">
                  <X size={20} />
                </button>
              </div>
            </header>
            
            <div className="flex-1 overflow-y-auto">
              {notifications.length > 0 ? (
                notifications.map(notification => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkAsRead={() => onMarkAsRead(notification.id)}
                  />
                ))
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
