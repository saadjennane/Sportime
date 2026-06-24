# Sportime — Notification Rails (B1–B5) — Technical Spec

> The foundations. Nothing in the notification catalog ships safely until these exist.
> Build order: **B3 (log) → B4 (send v2) → B2 (orchestrator) → B5 (tags) → B1 (router)**.
> Every trigger (cron/webhook/app) calls the **orchestrator `notify`**, never `send-notification` directly.

Audited reality this builds on:
- `send-notification` edge fn targets `user_onesignal_players.player_id` via **legacy** `https://onesignal.com/api/v1/notifications` + `Authorization: Basic`.
- Client `oneSignalService.ts`: `login(userId)` sets **external_id = profile.id**; stores subscription id. **No `addTags`, no notification-click handler.**
- Tables: `notifications`, `notification_preferences(gameplay|league|squad|premium|reminder|system + push/in_app/email)`, `user_onesignal_players`.
- ⚠️ **New REST key is `os_v2_app_…`** → must use **v5 API `https://api.onesignal.com` + `Authorization: Key`**. The legacy v1 + Basic path will break with this key. **B4 migrates auth.**

---

## Category → preference-type mapping

The 10 growth categories must map onto the **6 existing `notification_preferences` columns** so user opt-outs keep working. Priority is independent.

| Growth category | pref type (`{type}_enabled`) | Default priority |
|---|---|---|
| Onboarding | `system` | P1 |
| Activation | `gameplay` | P1 |
| Daily engagement | `reminder` | P1 |
| Matches & competitions | `gameplay` | P0 (settle/kickoff) / P1 |
| Fantasy | `gameplay` | P0 (deadline/results) / P1 |
| Social | `squad` / `league` | P1 |
| Rewards | `gameplay` | P1/P2 |
| Premium | `premium` | P0 (dunning) / P2 (upsell) |
| Reactivation | `reminder` | P2 |
| Churn prevention | `reminder` | P1 |

> Keep the 6 pref columns as the **user-facing toggles**; the orchestrator stores the fine-grained `category` + `priority` in `notification_log`.

---

## B3 — `notification_log` table 🔴

Powers frequency caps, quiet-hours, dedup, holdout and per-notification analytics.

```sql
create table public.notification_log (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  notif_key     text not null,                 -- catalog id, e.g. 'MC-3', 'ON-1'
  category      text not null,                 -- onboarding|activation|daily|matches|fantasy|social|rewards|premium|reactivation|churn
  pref_type     text not null,                 -- gameplay|league|squad|premium|reminder|system
  priority      smallint not null,             -- 0=P0,1=P1,2=P2
  dedup_key     text,                           -- e.g. 'MC-3:fixture:{id}' — uniqueness window
  channel       text not null default 'push',  -- push|inapp|email
  status        text not null default 'queued',-- queued|held|sent|skipped_cap|skipped_pref|skipped_dedup|failed
  skip_reason   text,
  scheduled_for timestamptz,                    -- when quiet-hours/timezone delayed
  sent_at       timestamptz,
  opened_at     timestamptz,                    -- backfilled from OneSignal click/confirmed delivery
  onesignal_id  text,
  payload       jsonb,
  created_at    timestamptz not null default now()
);

create index notif_log_user_time      on public.notification_log (user_id, created_at desc);
create index notif_log_user_cat_time  on public.notification_log (user_id, category, created_at desc);
create unique index notif_log_dedup    on public.notification_log (user_id, dedup_key)
  where dedup_key is not null and status in ('queued','held','sent');
```

**Holdout flag** lives on the user (stable bucket):
```sql
alter table public.users add column if not exists mkt_holdout boolean
  generated always as ((('x'||substr(md5(id::text),1,8))::bit(32)::bigint % 10) = 0) stored;
-- ~10% deterministic holdout; P2 (and optionally P1 marketing) suppressed for these, still logged as status='skipped_holdout'.
```

---

## B4 — `send-notification` v2 🔴

Low-level sender only. **Migrate auth + target by external_id + support scheduling.** Keep the in-app `notifications` row write.

### Env (edge function secrets)
```
ONESIGNAL_APP_ID        = 7873fb7e-774d-4dd4-afae-e37ab2d73c56
ONESIGNAL_REST_API_KEY  = os_v2_app_...   # NEW key
```

### Contract
```ts
interface SendInput {
  userId: string;                 // external_id
  notifKey: string;               // for log linkage
  type: 'gameplay'|'league'|'squad'|'premium'|'reminder'|'system';
  title: string;
  message: string;
  route?: string;                 // sportime://...  -> data.route (B1)
  imageUrl?: string;
  data?: Record<string, unknown>;
  sendAfter?: string;             // ISO; OneSignal send_after
  timezoneDelivery?: boolean;     // delayed_option:'timezone' + delivery_time_of_day
  deliveryTimeOfDay?: string;     // 'HH:mm' local when timezoneDelivery
  channels?: ('push'|'inapp')[];  // default ['push','inapp']
}
```

### OneSignal v5 push payload
```ts
const res = await fetch('https://api.onesignal.com/notifications', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Key ${Deno.env.get('ONESIGNAL_REST_API_KEY')}`,   // ⚠️ Key, not Basic
  },
  body: JSON.stringify({
    app_id: Deno.env.get('ONESIGNAL_APP_ID'),
    target_channel: 'push',
    include_aliases: { external_id: [userId] },   // ⚠️ external_id, not player_ids
    headings: { en: title },
    contents: { en: message },
    big_picture: imageUrl, ios_attachments: imageUrl ? { id1: imageUrl } : undefined,
    data: { notifKey, route, ...data },           // route consumed by B1 click handler
    ...(sendAfter ? { send_after: sendAfter } : {}),
    ...(timezoneDelivery ? { delayed_option: 'timezone', delivery_time_of_day: deliveryTimeOfDay } : {}),
  }),
});
```
- Still gate on `notification_preferences` (`push_enabled` + `{type}_enabled`) and write the in-app row when `in_app_enabled`.
- Return `{ onesignal_id, sent:{push,inapp} }` to the orchestrator (which logs it).

> **Segment/broadcast variant** (campaigns): same call with `included_segments:[...]` instead of `include_aliases`. Used by reactivation/premium batch journeys.

---

## B2 — Orchestrator edge fn `notify` 🔴

The single public entry point. Pipeline:

```
notify(input) →
  1. load prefs + holdout + tz for user
  2. PREF GATE      → push_enabled && {pref_type}_enabled ? else log skipped_pref, stop
  3. HOLDOUT GATE   → if mkt_holdout && priority>=2 → log skipped_holdout, stop
  4. DEDUP GATE     → dedup_key seen within cooldown? → log skipped_dedup, stop
  5. FREQUENCY GATE → count recent sends (see caps); if over → log skipped_cap, stop
                      (P0 bypasses global cap but still digests)
  6. QUIET HOURS    → if now∈[22:00,08:00) local AND not P0-time-critical →
                      set scheduled_for = next 08:30 local (or use B4 timezoneDelivery)
  7. DIGEST         → if same (category) burst within 15min → merge into one (see below)
  8. SEND           → call send-notification v2
  9. LOG            → write notification_log row (status sent/held), store onesignal_id
```

### Input
```ts
interface NotifyInput {
  userId: string;
  notifKey: string;                 // 'MC-3'
  category: string;                 // 'matches'
  priority: 0|1|2;
  title: string;
  message: string;
  route?: string;
  dedupKey?: string;                // 'MC-3:fixture:123'  (default `${notifKey}:${userId}`)
  dedupCooldownH?: number;          // default 12
  imageUrl?: string;
  data?: Record<string, unknown>;
  forceNow?: boolean;               // P0 time-critical (live result the user is watching)
  bundleKey?: string;               // settlements share a bundleKey for digesting
}
```

### Caps (config, tunable)
```ts
const CAPS = {
  marketing_per_day: 2,     // P1+P2
  marketing_per_week: 6,
  p2_per_day: 1,
  p2_per_week: 3,
  perCategoryPerDay: { social: 1, premium: 2/*wk handled separately*/, rewards: 1, reactivation: 1 },
  quietStart: 22, quietEnd: 8,         // local hours
  digestWindowMin: 15,
  newUserMarketingPerDay: 1,           // days_since_install <= 7
  ignoreThrottleAfter: 3,              // consecutive unopened marketing → reduce cadence
};
```

### Digest rule (settlements & bursts)
If ≥2 queued items share `bundleKey` within `digestWindowMin`, collapse:
> "3 of your picks settled · **+1,240 coins** 🎉" → route `sportime://finished`.
Implementation: orchestrator buffers by `(userId,bundleKey)` for 60s (or a `*/2min` flush cron reads `status='queued'` rows and merges). Settlement crons (B6) emit per-bet but tag the same `bundleKey = 'settle:{userId}:{date}'`.

### Priority arbitration
- P0 always proceeds (skips frequency gate, still dedup+digest).
- If a P1 and a P2 are both eligible the same slot → **P1 wins, P2 deferred** to next day (or dropped if stale).

---

## B5 — Segmentation ⚠️ REVISED (DB-driven)

> **Constraint found in build:** OneSignal's current (free) plan **caps data tags to ~2/user** (`409 entitlements-tag-limit`). Rich tag-based segmentation is therefore **not viable** without a paid OneSignal plan.
> **Decision:** segmentation lives in **our DB** (we already hold sports, favourites, premium, dormancy, picks). Each journey's cron computes the audience in SQL and calls `notify` per user, **targeting by `external_id`** (proven working). OneSignal is the delivery pipe only.
> **What ships now:** the client persists `users.timezone` (for quiet-hours). The `addOneSignalTags` helper + `sync-onesignal-tags` fn are kept (deployed) but **dormant** until a paid plan — re-enable to push tags for OneSignal-native segments/IAM targeting.

### Original tag design (for a future paid plan)

### B5a — Client tags (`oneSignalService.ts`, add `addOneSignalTags`)
```ts
export async function addOneSignalTags(tags: Record<string,string>): Promise<void> {
  if (!isNative() || !initialized) return;
  try { OneSignal.User.addTags(tags); } catch (e) { console.warn('[OneSignal] addTags', e); }
}
```
Call sites (set immediately, low latency):
| When (file) | Tags |
|---|---|
| `setupOneSignalForUser` / after profile load (App.tsx ~L387) | `tz`, `locale`, `level`, `is_premium`, `premium_status`, `follows_football`, `follows_f1`, `favorite_club`, `favorite_f1_driver`, `favorite_f1_constructor`, `in_squad`, `push_optin` |
| On `game_joined` (already tracked) | `last_game_type`, bump `games_played_total` |
| On bet placed (`handleBetClick` success) | `has_pending_pick=true` |
| On settlement seen / pick history | recompute `has_pending_pick` |
| On favourite change (Fan Pulse) | `favorite_*` |

> `tz` from `Intl.DateTimeFormat().resolvedOptions().timeZone`.

### B5b — Server reconcile `sync-onesignal-tags` (cron `*/15min` + nightly full) 🔴
Computed/server-only tags pushed via OneSignal v5 REST:
```
PATCH https://api.onesignal.com/apps/{app_id}/users/by/external_id/{userId}
Authorization: Key {REST_KEY}
{ "properties": { "tags": { "dormant_days":"4","lifecycle_stage":"at_risk",
  "streak_count":"6","streak_at_risk":"true","games_7d":"3","pending_picks_count":"2",
  "fantasy_deadline_pending":"false","spins_available":"true","tickets_total":"3",
  "coins_bucket":"mid","ignored_streak":"0" } } }
```
Source queries (DB): `last_active_at` → `dormant_days`/`lifecycle_stage`; `match_bets` pending → `pending_picks_count`; `user_streaks` → streak; aggregates → `games_7d`; rosters → `fantasy_deadline_pending`; spin/ticket state.

**Full tag list & owner** (client=C, server=S):
`tz`C `locale`C `lifecycle_stage`S `install_date`S `days_since_install`S `last_active_date`S `dormant_days`S `d1_activated`S `d7_retained`S `level`C `coins_bucket`S `is_premium`C `premium_status`C `follows_football`C `follows_f1`C `favorite_club`C `favorite_f1_driver`C `favorite_f1_constructor`C `has_pending_pick`C `pending_picks_count`S `streak_count`S `streak_at_risk`S `in_squad`C `squad_count`S `games_played_total`C `games_7d`S `last_game_type`C `fantasy_active`S `fantasy_deadline_pending`S `spins_available`S `tickets_total`S `push_optin`C `ignored_streak`S

---

## B1 — Deep-link router 🔴

Unifies three entry points into one resolver:
1. **Cold start** — `CapApp.getLaunchUrl()` (already used for masterpass).
2. **Warm `appUrlOpen`** — universal/`sportime://` links (already listened).
3. **Notification click** — `OneSignal.Notifications.addEventListener('click', e => resolveRoute(e.notification.additionalData?.route))` ← **new, add in `oneSignalService.ts`**, forwarded to App via a callback/registered handler.

### `resolveRoute(url: string)` mapping (extend the existing `extract()` logic)
```ts
// sportime://<segment>/<id?>  OR  https://sportime.app/<segment>/<id?>
type Routed =
 | { page:'matches', tab?:'today'|'picks'|'finished' }
 | { page:'matches', fixtureId:string }            // match/{id} -> open pick/stats
 | { page:'challenges', browse?:boolean }          // games
 | { gameRoom:{ kind:'challenge'|'swipe'|'fantasy'|'tq'|'live', id:string } }
 | { leaderboard:string }
 | { page:'squads', leagueId?:string } | { joinLeague:string }
 | { page:'funzone' }                              // fanpulse
 | { shop:true } | { wallet:true } | { spin:string } | { premium:true }
 | { page:'profile', tab?:'stats'|'history' }
 | { masterpass:string };                          // existing
```
`resolveRoute` sets the existing App state (`setPage`, `setActiveChallengeId`, `setActiveSwipeGameId`, `setActiveFantasyGameId`, `setActiveTournamentId`, `setActiveLiveGame`, `setActiveLeagueId`, `setHistoryOpen`, `setIsPremiumModalOpen`, `handleOpenSpinWheel`, etc.). Route table = §4 of the architecture doc.

**Cold-start UX:** if route needs auth and user is guest → stash route, run signup, replay after auth (mirror the existing `claimToken` pattern).

---

## Build checklist (DoD)
- [ ] B3 `notification_log` + `mkt_holdout` migration applied.
- [ ] B4 `send-notification` v2: `api.onesignal.com` + `Key` auth + `include_aliases.external_id` + `send_after`/timezone. (⚠️ blocks delivery with the new key.)
- [ ] B2 `notify` edge fn live; all triggers call it.
- [ ] B5a `addOneSignalTags` + client call sites; B5b `sync-onesignal-tags` cron.
- [ ] B1 `resolveRoute` + OneSignal click handler + appUrlOpen/launch wired; guest-stash replay.
- [ ] Smoke test: orchestrator → push received → tap → correct screen → `notification_log` row with `opened_at`.

> After B1–B5 are green, we ship notifications **by phases**: Phase 1 = Onboarding + Activation + Daily loop (MVP-15), each as a full per-notification fiche (copy/A-B/payload/IAM).
