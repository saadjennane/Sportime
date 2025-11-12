# Notifications System Setup

This app uses **OneSignal** for push notifications and **Supabase** for notification history and preferences.

## Prerequisites

1. **OneSignal Account**: Create an account at [onesignal.com](https://onesignal.com/)
2. **Supabase Project**: Already configured

## Setup Steps

### 1. OneSignal Configuration

1. Create a new app in your OneSignal dashboard
2. Configure web push:
   - Go to Settings → Platforms → Web Push
   - Add your site URL (e.g., `https://yourdomain.com` or `http://localhost:5176` for development)
   - Set up HTTPS (required for push notifications in production)
3. Get your credentials:
   - **App ID**: Found in Settings → Keys & IDs
   - **REST API Key**: Found in Settings → Keys & IDs

### 2. Environment Variables

#### Frontend (.env)

Add to your `.env` file:

```
VITE_ONESIGNAL_APP_ID=your_onesignal_app_id_here
```

#### Backend (Supabase Secrets)

Set these secrets in your Supabase dashboard (Settings → Edge Functions → Secrets):

```
ONESIGNAL_APP_ID=your_onesignal_app_id_here
ONESIGNAL_API_KEY=your_onesignal_rest_api_key_here
```

Or via CLI:

```bash
supabase secrets set ONESIGNAL_APP_ID=your_app_id
supabase secrets set ONESIGNAL_API_KEY=your_rest_api_key
```

### 3. Deploy Database Schema

Run the notifications migration:

```bash
supabase db push
```

This creates:
- `notifications` table - Notification history
- `user_onesignal_players` table - OneSignal Player IDs
- `notification_preferences` table - User notification preferences

### 4. Deploy Edge Function

Deploy the `send-notification` edge function:

```bash
supabase functions deploy send-notification
```

### 5. Test Notifications

#### Option 1: Via Code

```typescript
import { sendNotification } from './services/notificationService';

await sendNotification(
  userId,
  'gameplay',
  'Test Notification',
  'This is a test message'
);
```

#### Option 2: Via Supabase SQL Editor

```sql
SELECT extensions.http_post(
  url := 'YOUR_SUPABASE_URL/functions/v1/send-notification',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer YOUR_ANON_KEY'
  ),
  body := jsonb_build_object(
    'userId', 'user-id-here',
    'type', 'system',
    'title', 'Test',
    'message', 'Hello from Supabase!'
  )
);
```

## How It Works

### Push Notifications Flow

1. User opens app → OneSignal SDK initializes
2. User grants permission → OneSignal creates Player ID
3. Player ID saved to Supabase (`user_onesignal_players`)
4. When sending notification:
   - Call `sendNotification()` from frontend OR
   - Call edge function directly from backend
   - Edge function checks user preferences
   - Sends push via OneSignal API
   - Saves notification to Supabase

### In-App Notifications

- Uses real-time Supabase subscriptions
- Notifications appear instantly in NotificationCenter
- Pagination for large notification lists
- Unread count badge on bell icon

## Notification Types

- `gameplay` - Game-related notifications (wins, losses, rewards)
- `league` - League invitations and updates (legacy)
- `squad` - Squad invitations and updates
- `premium` - Premium features and offers
- `reminder` - Daily challenges, streak reminders
- `system` - System messages, maintenance

## User Preferences

Users can control notifications per type via the notification preferences table:

- `push_enabled` - Enable/disable all push notifications
- `in_app_enabled` - Enable/disable in-app notifications
- `gameplay_enabled` - Enable/disable gameplay notifications
- `league_enabled` - Enable/disable league notifications
- `squad_enabled` - Enable/disable squad notifications
- `premium_enabled` - Enable/disable premium notifications
- `reminder_enabled` - Enable/disable reminder notifications
- `system_enabled` - Enable/disable system notifications

## Troubleshooting

### Push Notifications Not Working

1. Check OneSignal App ID in `.env`
2. Verify HTTPS is enabled (required for push)
3. Check browser console for permission errors
4. Verify player ID was registered in `user_onesignal_players` table
5. Test with OneSignal dashboard's "Send to Test Device" feature

### In-App Notifications Not Showing

1. Check if user is authenticated (guests don't get notifications)
2. Verify notifications table has data
3. Check browser console for real-time subscription errors
4. Ensure RLS policies allow user to read their notifications

### Edge Function Errors

1. Check Supabase logs: Dashboard → Edge Functions → send-notification → Logs
2. Verify secrets are set correctly
3. Test edge function in Supabase dashboard

## Development vs Production

### Development
- Use `allowLocalhostAsSecureOrigin: true` in OneSignal config
- Test with `http://localhost`
- Push notifications work but may be unreliable

### Production
- **MUST use HTTPS** (push notifications won't work on HTTP)
- Configure proper site URL in OneSignal
- Use production OneSignal App ID

## Next Steps

After setup, you can:

1. Add notification triggers in your business logic
2. Customize notification templates
3. Add deep linking to notification actions
4. Schedule notifications via Supabase cron jobs
5. Add email notifications (infrastructure ready)
