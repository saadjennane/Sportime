// Analytics event catalog (single source of truth for event names) + typed wrappers.
// Rule: NEVER call track('...') with a raw string — always use EVENTS + trackEvent so names
// stay consistent with the tracking plan (docs/analytics/Sportime-Analytics-Architecture.md).
import { track } from '../services/analytics';

export const EVENTS = {
  // Lifecycle & session
  APP_OPENED: 'app_opened',
  SESSION_STARTED: 'session_started',
  APP_BACKGROUNDED: 'app_backgrounded',
  SCREEN_VIEWED: 'screen_viewed',
  TAB_SWITCHED: 'tab_switched',
  SPORT_SWITCHED: 'sport_switched',
  DEEPLINK_OPENED: 'deeplink_opened',

  // Onboarding & activation
  SIGNUP_STARTED: 'signup_started',
  SIGNUP_COMPLETED: 'signup_completed',
  SPORTS_SELECTED: 'sports_selected',
  FAVOURITE_SELECTED: 'favourite_selected',
  PUSH_PERMISSION_PROMPTED: 'push_permission_prompted',
  PUSH_PERMISSION_RESULT: 'push_permission_result',
  ONBOARDING_STEP_VIEWED: 'onboarding_step_viewed',

  // Predictions / picks  (north-star activation event = pick_placed)
  MATCH_VIEWED: 'match_viewed',
  PICK_STARTED: 'pick_started',
  PICK_PLACED: 'pick_placed',
  PICK_EDITED: 'pick_edited',
  RESULTS_VIEWED: 'results_viewed',

  // Games & competitions
  GAMES_BROWSED: 'games_browsed',
  GAME_VIEWED: 'game_viewed',
  GAME_JOINED: 'game_joined',
  GAME_ENTRY_SUBMITTED: 'game_entry_submitted',
  LEADERBOARD_VIEWED: 'leaderboard_viewed',

  // Fantasy
  FANTASY_LINEUP_SAVED: 'fantasy_lineup_saved',
  FANTASY_CAPTAIN_SET: 'fantasy_captain_set',
  FANTASY_TRANSFER_MADE: 'fantasy_transfer_made',

  // Social / squads / virality
  SQUAD_CREATED: 'squad_created',
  SQUAD_JOINED: 'squad_joined',
  SQUAD_INVITE_SENT: 'squad_invite_sent',
  MASTERPASS_SENT: 'masterpass_sent',
  MASTERPASS_CLAIMED: 'masterpass_claimed',

  // Economy
  SHOP_VIEWED: 'shop_viewed',
  COIN_PACK_PURCHASED: 'coin_pack_purchased',
  SPIN_PLAYED: 'spin_played',

  // Premium (Sportime+)
  PAYWALL_VIEWED: 'paywall_viewed',
  PREMIUM_CTA_CLICKED: 'premium_cta_clicked',
  PREMIUM_PURCHASED: 'premium_purchased',

  // Notifications
  NOTIF_OPENED: 'notif_opened',
} as const;

export type AnalyticsEvent = (typeof EVENTS)[keyof typeof EVENTS];

/** Typed event tracker — only accepts catalog event names. */
export function trackEvent(event: AnalyticsEvent, props?: Record<string, unknown>): void {
  track(event, props as Record<string, any> | undefined);
}

/** Convenience for screen views. */
export function trackScreen(screen: string, prevScreen?: string): void {
  trackEvent(EVENTS.SCREEN_VIEWED, { screen, prev_screen: prevScreen });
}
