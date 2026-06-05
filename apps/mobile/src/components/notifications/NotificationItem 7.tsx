import React from 'react';
import { Notification } from '../../types';
import { formatDistanceToNow } from 'date-fns';
import { Gamepad2, Users, Flame, Award, Bell, Settings } from 'lucide-react';

const typeIcons: Record<Notification['type'], React.ReactNode> = {
  gameplay: <Gamepad2 size={16} />,
  league: <Users size={16} />,
  squad: <Flame size={16} />,
  premium: <Award size={16} />,
  reminder: <Bell size={16} />,
  system: <Settings size={16} />,
};

const typeColors: Record<Notification['type'], string> = {
  gameplay: 'text-lime-glow',
  league: 'text-electric-blue',
  squad: 'text-warm-yellow',
  premium: 'text-purple-400',
  reminder: 'text-hot-red',
  system: 'text-text-disabled',
};

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: () => void;
}

export const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onMarkAsRead }) => {
  return (
    <div
      onClick={notification.isRead ? undefined : onMarkAsRead}
      className={`p-4 border-b border-disabled cursor-pointer transition-colors ${
        notification.isRead ? 'bg-deep-navy' : 'bg-navy-accent hover:bg-navy-accent/50'
      }`}
    >
      <div className="flex items-start gap-3">
        {!notification.isRead && <div className="w-2 h-2 mt-1.5 bg-electric-blue rounded-full flex-shrink-0" />}
        <div className={`mt-1 ${typeColors[notification.type]}`}>{typeIcons[notification.type]}</div>
        <div className="flex-1">
          <div className="flex justify-between items-baseline">
            <h4 className="font-bold text-text-primary">{notification.title}</h4>
            <p className="text-xs text-text-disabled">{formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}</p>
          </div>
          <p className="text-sm text-text-secondary">{notification.message}</p>
          {notification.action && (
            <button className="text-sm font-bold text-electric-blue mt-2 hover:underline">
              {notification.action.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
