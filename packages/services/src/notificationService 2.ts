import { supabase } from './supabase';
import type { Database } from '../types/supabase';

type Notification = Database['public']['Tables']['notifications']['Row'];
type NotificationInsert = Database['public']['Tables']['notifications']['Insert'];
type OneSignalPlayer = Database['public']['Tables']['user_onesignal_players']['Row'];
type NotificationPreferences = Database['public']['Tables']['notification_preferences']['Row'];

/**
 * Notification Service
 * Handles notification history, OneSignal integration, and user preferences
 */

// ============================================================================
// NOTIFICATION HISTORY (Supabase)
// ============================================================================

/**
 * Get user's notifications with pagination
 */
export async function getUserNotifications(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('[notificationService] Failed to get notifications:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get count of unread notifications
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    console.error('[notificationService] Failed to get unread count:', error);
    throw error;
  }

  return count || 0;
}

/**
 * Mark a single notification as read
 */
export async function markAsRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);

  if (error) {
    console.error('[notificationService] Failed to mark as read:', error);
    throw error;
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    console.error('[notificationService] Failed to mark all as read:', error);
    throw error;
  }
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId);

  if (error) {
    console.error('[notificationService] Failed to delete notification:', error);
    throw error;
  }
}

/**
 * Create a notification directly (for in-app only, without push)
 */
export async function createInAppNotification(
  userId: string,
  type: Notification['type'],
  title: string,
  message: string,
  actionLabel?: string,
  actionLink?: string,
  metadata?: any
): Promise<Notification> {
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      type,
      title,
      message,
      action_label: actionLabel,
      action_link: actionLink,
      metadata: metadata || {},
    })
    .select()
    .single();

  if (error) {
    console.error('[notificationService] Failed to create notification:', error);
    throw error;
  }

  return data;
}

// ============================================================================
// ONESIGNAL PLAYER MANAGEMENT
// ============================================================================

/**
 * Register a OneSignal Player ID for a user
 */
export async function registerOneSignalPlayer(
  userId: string,
  playerId: string,
  deviceType: 'web' | 'ios' | 'android'
): Promise<OneSignalPlayer> {
  const { data, error } = await supabase
    .from('user_onesignal_players')
    .upsert(
      {
        user_id: userId,
        player_id: playerId,
        device_type: deviceType,
        is_active: true,
        last_seen_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,player_id',
      }
    )
    .select()
    .single();

  if (error) {
    console.error('[notificationService] Failed to register OneSignal player:', error);
    throw error;
  }

  return data;
}

/**
 * Get all active OneSignal Player IDs for a user
 */
export async function getOneSignalPlayers(userId: string): Promise<OneSignalPlayer[]> {
  const { data, error } = await supabase
    .from('user_onesignal_players')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (error) {
    console.error('[notificationService] Failed to get OneSignal players:', error);
    throw error;
  }

  return data || [];
}

/**
 * Deactivate a OneSignal Player ID (when user logs out or unsubscribes)
 */
export async function deactivateOneSignalPlayer(playerId: string): Promise<void> {
  const { error } = await supabase
    .from('user_onesignal_players')
    .update({ is_active: false })
    .eq('player_id', playerId);

  if (error) {
    console.error('[notificationService] Failed to deactivate player:', error);
    throw error;
  }
}

// ============================================================================
// NOTIFICATION PREFERENCES
// ============================================================================

/**
 * Get user's notification preferences
 */
export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[notificationService] Failed to get preferences:', error);
    throw error;
  }

  // Return default preferences if none exist (shouldn't happen due to trigger)
  if (!data) {
    return {
      user_id: userId,
      gameplay_enabled: true,
      league_enabled: true,
      squad_enabled: true,
      premium_enabled: true,
      reminder_enabled: true,
      system_enabled: true,
      push_enabled: true,
      in_app_enabled: true,
      email_enabled: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  return data;
}

/**
 * Update user's notification preferences
 */
export async function updateNotificationPreferences(
  userId: string,
  preferences: Partial<Omit<NotificationPreferences, 'user_id' | 'created_at' | 'updated_at'>>
): Promise<NotificationPreferences> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .upsert(
      {
        user_id: userId,
        ...preferences,
      },
      {
        onConflict: 'user_id',
      }
    )
    .select()
    .single();

  if (error) {
    console.error('[notificationService] Failed to update preferences:', error);
    throw error;
  }

  return data;
}

/**
 * Check if user should receive a notification of a specific type
 */
export async function shouldReceiveNotification(
  userId: string,
  type: Notification['type']
): Promise<{ push: boolean; inApp: boolean }> {
  const prefs = await getNotificationPreferences(userId);

  const typeEnabled = prefs[`${type}_enabled` as keyof NotificationPreferences] as boolean;

  return {
    push: prefs.push_enabled && typeEnabled,
    inApp: prefs.in_app_enabled && typeEnabled,
  };
}

// ============================================================================
// SEND NOTIFICATION (via Edge Function)
// ============================================================================

/**
 * Send a notification via OneSignal push + save to Supabase
 * This calls the Edge Function which handles OneSignal API and database insert
 */
export async function sendNotification(
  userId: string,
  type: Notification['type'],
  title: string,
  message: string,
  actionLabel?: string,
  actionLink?: string,
  metadata?: any
): Promise<{ success: boolean; notificationId?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('send-notification', {
      body: {
        userId,
        type,
        title,
        message,
        actionLabel,
        actionLink,
        metadata,
      },
    });

    if (error) {
      console.error('[notificationService] Failed to send notification:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('[notificationService] Error calling send-notification function:', error);
    throw error;
  }
}

// ============================================================================
// REAL-TIME SUBSCRIPTION HELPER
// ============================================================================

/**
 * Subscribe to new notifications for a user
 * Returns a subscription object that should be unsubscribed when component unmounts
 */
export function subscribeToNotifications(
  userId: string,
  callback: (notification: Notification) => void
) {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        callback(payload.new as Notification);
      }
    )
    .subscribe();

  return channel;
}
