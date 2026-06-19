# Premium — RevenueCat integration (skeleton)

The premium **perks** are already built and gate on the server flag `users.is_subscribed`
(read by the app as `profiles.is_subscriber`). This document wires **real billing** so that
flag flips on actual App Store / Play purchases.

## Source of truth
- Write path: **`set_subscription(user_id, active, expires_at)`** RPC (migration
  `20260618170000_subscription_write_path.sql`) — the only place that sets the flag.
  Granted to `service_role` only (the webhook), never the client.
- The app keeps reading `profiles.is_subscriber`. No app gating change needed.

## One-time setup
1. **App Store Connect** (+ Google Play): create the auto-renewable subscriptions
   (e.g. `premium_monthly`, `premium_seasonal`).
2. **RevenueCat dashboard**:
   - Add the apps + the products.
   - Create an **Entitlement** called `premium` and attach the products.
   - Create an **Offering** with the packages (for the paywall).
   - **Webhooks** → URL `https://crypuzduplbzbmvefvzr.supabase.co/functions/v1/revenuecat-webhook`,
     Authorization header `Bearer <SECRET>`.
3. **Supabase**:
   ```bash
   supabase functions deploy revenuecat-webhook --no-verify-jwt
   supabase secrets set REVENUECAT_WEBHOOK_SECRET=<SECRET>
   ```
4. **App**:
   ```bash
   npm i @revenuecat/purchases-capacitor && npx cap sync
   ```
   Add to `.env`:
   ```
   VITE_REVENUECAT_IOS_KEY=appl_xxx
   VITE_REVENUECAT_ANDROID_KEY=goog_xxx
   ```

## App wiring (`services/premiumPurchaseService.ts`)
- On login (subscriber or not): `configurePurchases(profile.id)` — **`appUserID` must be the
  Supabase user id** so the webhook's `app_user_id` maps to `users.id`.
- Paywall: `getPremiumPackages()` → render → `purchasePremium(pkg)`.
- "Restore purchases" button: `restorePurchases()`.
- Replace the mock `subscribeToPremium` (in `useMockStore`) with `purchasePremium`.

## Flow
```
User taps Subscribe → purchasePremium(pkg)            (StoreKit / Play Billing via RevenueCat)
   → RevenueCat validates the receipt
   → RevenueCat POSTs the webhook → revenuecat-webhook edge fn
       → set_subscription(user, true, expires_at)     (flips users.is_subscribed)
       → (INITIAL_PURCHASE) add_coins welcome bonus
   → app reads profiles.is_subscriber = true → all premium perks unlock
```

## Notes
- Apple/Google take 15–30%. Digital subscriptions on iOS **must** use StoreKit (no Stripe).
- The client entitlement check (`isPremiumEntitlementActive`) is for instant UX only —
  the authoritative gate is the server flag synced by the webhook.
- Test the webhook with RevenueCat's "Send test event" once deployed.
