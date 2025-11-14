/**
 * useActivityTracker Hook
 *
 * Automatically tracks user activity when component mounts and on route changes.
 * Should be used in App.tsx or main layout components.
 *
 * Usage:
 *   const MyComponent = () => {
 *     useActivityTracker(userId);
 *     return <div>...</div>;
 *   };
 */

import { useEffect } from 'react';
import { trackActivity } from '../services/activityTracker';

export function useActivityTracker(userId: string | null) {
  useEffect(() => {
    if (!userId) return;

    // Track activity on mount
    trackActivity(userId);

    // Track activity every 5 minutes while user is active
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        trackActivity(userId);
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [userId]);
}
