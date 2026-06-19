// RevenueCat purchase wrapper (SKELETON). Server stays the source of truth: the real
// premium flag is set by the RevenueCat webhook → set_subscription() → users.is_subscribed,
// which the app reads via profiles.is_subscriber. This file only drives the purchase UX.
//
// To activate:
//   1. npm i @revenuecat/purchases-capacitor && npx cap sync
//   2. Set VITE_REVENUECAT_IOS_KEY / VITE_REVENUECAT_ANDROID_KEY in .env
//   3. In the RevenueCat dashboard: create products + an entitlement called 'premium',
//      and point the webhook at the `revenuecat-webhook` edge function.
//
// The dynamic import is @vite-ignore'd so the app builds even before the plugin is installed.

import { Capacitor } from '@capacitor/core';

const RC_KEY_IOS = import.meta.env.VITE_REVENUECAT_IOS_KEY as string | undefined;
const RC_KEY_ANDROID = import.meta.env.VITE_REVENUECAT_ANDROID_KEY as string | undefined;
export const PREMIUM_ENTITLEMENT = 'premium';

let _purchases: any = null;
async function purchases(): Promise<any> {
  if (_purchases) return _purchases;
  const mod: any = await import(/* @vite-ignore */ '@revenuecat/purchases-capacitor').catch(() => null);
  if (!mod?.Purchases) {
    throw new Error('RevenueCat not installed — run: npm i @revenuecat/purchases-capacitor && npx cap sync');
  }
  _purchases = mod.Purchases;
  return _purchases;
}

/** Call once after login, with the Supabase user id as the RevenueCat app user id. */
export async function configurePurchases(appUserId: string): Promise<void> {
  const apiKey = Capacitor.getPlatform() === 'android' ? RC_KEY_ANDROID : RC_KEY_IOS;
  if (!apiKey) throw new Error('Missing RevenueCat API key (VITE_REVENUECAT_*_KEY)');
  const P = await purchases();
  await P.configure({ apiKey, appUserID: appUserId });
}

// Shown in the paywall before RevenueCat is live, so the offer UI is wired & demoable.
// No prices and no purchase — buying throws an honest "coming soon" (never fakes premium).
const PREVIEW_PACKAGES = [
  { identifier: 'preview_monthly', product: { title: 'Premium — Monthly', priceString: '' }, _preview: true },
  { identifier: 'preview_seasonal', product: { title: 'Premium — Season Pass', priceString: '' }, _preview: true },
];

/** Packages for the paywall — real RevenueCat offering, or preview packages until it's live. */
export async function getPremiumPackages(): Promise<any[]> {
  try {
    const P = await purchases();
    const offerings = await P.getOfferings();
    const real = offerings?.current?.availablePackages ?? [];
    return real.length ? real : PREVIEW_PACKAGES;
  } catch {
    return PREVIEW_PACKAGES; // RevenueCat not installed/configured yet
  }
}

/** Purchase a package. Returns true if the 'premium' entitlement is now active. */
export async function purchasePremium(aPackage: any): Promise<boolean> {
  if (aPackage?._preview) {
    throw new Error('Premium purchases aren’t live yet — coming soon.');
  }
  const P = await purchases();
  const res = await P.purchasePackage({ aPackage });
  return !!res?.customerInfo?.entitlements?.active?.[PREMIUM_ENTITLEMENT];
}

/** Restore previous purchases (App Store / Play). */
export async function restorePurchases(): Promise<boolean> {
  const P = await purchases();
  const res = await P.restorePurchases();
  return !!res?.customerInfo?.entitlements?.active?.[PREMIUM_ENTITLEMENT];
}

/** Client-side entitlement check (UX only — the gate is server-side is_subscriber). */
export async function isPremiumEntitlementActive(): Promise<boolean> {
  const P = await purchases();
  const res = await P.getCustomerInfo();
  return !!res?.customerInfo?.entitlements?.active?.[PREMIUM_ENTITLEMENT];
}
