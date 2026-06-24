// RevenueCat webhook → flips the Supabase premium flag via set_subscription().
// Source of truth for premium = users.is_subscribed (read by the app as profiles.is_subscriber).
//
// Setup:
//   • Deploy:  supabase functions deploy revenuecat-webhook --no-verify-jwt
//   • Secrets: supabase secrets set REVENUECAT_WEBHOOK_SECRET=<random-string>
//   • RevenueCat dashboard → Webhooks → URL = https://<ref>.supabase.co/functions/v1/revenuecat-webhook
//     Authorization header = "Bearer <same random-string>"
//   • The app must call Purchases.configure({ appUserID: <supabase user id> }) so app_user_id == users.id.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('REVENUECAT_WEBHOOK_SECRET') ?? '';

// Events that mean "no longer entitled". Everything else (purchase/renewal/uncancel/
// product change/billing-recovered) means entitled. CANCELLATION keeps access until expiry.
const DEACTIVATE = new Set(['EXPIRATION']);

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method', { status: 405 });

  // RevenueCat sends the Authorization header you configure in the dashboard.
  const auth = req.headers.get('Authorization') ?? '';
  if (!WEBHOOK_SECRET || auth !== `Bearer ${WEBHOOK_SECRET}`) {
    return new Response('unauthorized', { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  const ev = payload?.event;
  if (!ev?.app_user_id || !ev?.type) return new Response('bad event', { status: 400 });

  const userId: string = ev.app_user_id;            // == Supabase users.id (set via appUserID)
  const type: string = ev.type;
  const active = !DEACTIVATE.has(type);
  const expiresAt = ev.expiration_at_ms ? new Date(ev.expiration_at_ms).toISOString() : null;

  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  const { error } = await db.rpc('set_subscription', {
    p_user_id: userId,
    p_active: active,
    p_expires_at: expiresAt,
  });
  if (error) return new Response(`set_subscription failed: ${error.message}`, { status: 500 });

  // Analytics — map the RevenueCat event to our premium funnel events.
  const PREMIUM_EVENT: Record<string, string> = {
    INITIAL_PURCHASE: 'premium_purchased', RENEWAL: 'premium_renewed',
    CANCELLATION: 'premium_cancelled', EXPIRATION: 'premium_cancelled',
    BILLING_ISSUE: 'premium_payment_failed',
  };
  const analyticsEvent = PREMIUM_EVENT[type];
  if (analyticsEvent) {
    await db.rpc('track_server_event', {
      p_user: userId, p_event: analyticsEvent,
      p_props: { plan: ev.product_id ?? null, store: ev.store ?? null, price: ev.price ?? null, currency: ev.currency ?? null },
    }).catch(() => {});
  }

  // Welcome bonus on the first ever purchase (premium_bonus coins from game_config).
  if (type === 'INITIAL_PURCHASE') {
    const { data: cfg } = await db.from('game_config')
      .select('value').eq('category', 'premium').eq('key', 'welcome_bonus_coins').maybeSingle();
    const welcome = Number(cfg?.value ?? 5000);
    if (welcome > 0) {
      await db.rpc('add_coins', {
        p_user_id: userId, p_amount: welcome, p_transaction_type: 'premium_bonus',
        p_metadata: { kind: 'welcome', source: 'revenuecat' },
      }).catch(() => {});
    }
  }

  return new Response(JSON.stringify({ ok: true, active, type }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
