import { Notification } from '../types';
import { subHours } from 'date-fns';

export const mockNotifications: Notification[] = [
  {
    id: "n1",
    type: "gameplay",
    title: "You won!",
    message: "✅ Madrid beat Barça. +300 coins added.",
    timestamp: subHours(new Date(), 2).toISOString(),
    isRead: false,
  },
  {
    id: "n2",
    type: "squad",
    title: "Invite received",
    message: "🎯 Houda invited you to a Live Game – tap to join!",
    timestamp: subHours(new Date(), 3).toISOString(),
    isRead: false,
    action: { label: 'Join Game' }
  },
  {
    id: "n3",
    type: "reminder",
    title: "Daily Streak",
    message: "🔥 Don’t lose your streak – make your picks before midnight.",
    timestamp: subHours(new Date(), 4).toISOString(),
    isRead: true,
  },
  {
    id: "n4",
    type: "league",
    title: "New Game Linked",
    message: "The admin has linked 'Pro Weekend League' to The Winners Circle.",
    timestamp: subHours(new Date(), 26).toISOString(),
    isRead: true,
  },
];
