# Sportime — Analytics Architecture (v1)

> Owner: Data Product. Audience: Product, Growth, Engineering.
> Principle: **dual-source truth.** PostHog = client behaviour & funnels; Supabase = server-side economic/transactional truth (already ledgered). Every metric has ONE canonical source. We don't double-count.

---

## 0. Current state (audited)

- **PostHog wired** (`apps/mobile/src/services/analytics.ts`): `init` (EU, `capture_pageview:false`, `person_profiles:'identified_only'`, no session recording), `identifyUser`, `resetAnalytics`, `track`. Fires `app_opened` at start.
- **Instrumented events (~9, F1-heavy):** `game_joined`, `f1_bet_placed`, `f1_duel_saved`, `f1_predictor_saved`, `f1_season_forecast_saved`, `f1_fantasy_roster_saved`, `f1_hof_saved`, `f1_fav_driver`, `f1_fav_constructor`. → **Core funnel is NOT tracked** (signup, pick, results, premium, social).
- **Server ledgers already exist (server truth):** `coin_transactions` (amount, balance_after, transaction_type, metadata), `xp_events` (amount, source_type, source_id, reason), `match_bets`, `user_fantasy_*`, `challenge_participants`, `notification_log` (push), `user_activity_logs` (weekly per-user rollup).
- **Gaps:** no event taxonomy/naming standard, no typed event catalog, no screen/session tracking, no server event sink for non-ledgered business events, no marts (DAU/retention/funnels), no dashboards, no attribution, no data-quality monitoring.

### Source-of-truth split (the rule)
| Domain | Canonical source | Why |
|---|---|---|
| Funnels, screens, taps, flows, time-to-action, retention curves | **PostHog** | client context, sequencing |
| Coins, XP, tickets, spins | **Supabase ledgers** (`coin_transactions`, `xp_events`) | money-like, must reconcile |
| Picks, games, settlements | **Supabase** (`match_bets`, game tables) | authoritative counts |
| Premium / revenue | **Supabase** (`revenuecat-webhook` → tables) | billing truth |
| Push performance | **`notification_log`** (+ OneSignal API) | already built |
| Behavioural intent around the above (e.g. paywall_viewed, pick_started) | **PostHog** | client-only signal |

> Pattern: a completed economic action fires a **PostHog event for funnel context** AND lives in a **server ledger for the count**. Reconcile on `user_id` + day. Counts come from the server; conversion/sequence from PostHog.

---

## 1. Naming conventions (enforced)

- **Events:** `snake_case`, **`object_action`**, action in **past tense** for completed actions: `pick_placed`, `game_joined`, `premium_purchased`, `squad_created`. Screen views: `screen_viewed`. No spaces, no caps, no PII in names.
- **Properties:** `snake_case`. Reserved/standard props on (almost) every event: `sport` (`football`|`f1`), `surface` (the screen/source, e.g. `matches`, `game_room`), `game_type` where relevant.
- **User properties:** `snake_case`, domain-readable (`is_premium`, `favourite_club`, `lifecycle_stage`).
- **IDs:** always send the raw entity id (`fixture_id`, `game_id`, `squad_id`) — never names.
- **Server event `source_type`** (xp_events/coin_transactions) already snake_case — keep aligned with PostHog event names where they overlap.
- **Booleans** start with `is_`/`has_`/`follows_`. **Counts** end with `_count`/`_total`. **Money** in coins as integers; **timestamps** ISO/epoch.
- **One catalog, one definition.** Every event defined once in the typed catalog (§8) — no ad-hoc `track('...')`.

---

## 2. Event taxonomy (the tracking plan)

`C` = client (PostHog) · `S` = server (Supabase ledger/sink) · `C+S` = both (PostHog funnel + server count).
Every event also carries the **base context** (§4 super properties): `platform`, `app_version`, `sport`, `surface`, `session_id`.

### 2.1 Lifecycle & session — C
| Event | Required props |
|---|---|
| `app_opened` | `cold_start`(bool) |
| `session_started` | `session_id`, `resumed`(bool) |
| `app_backgrounded` | `session_duration_s` |
| `screen_viewed` | `screen`, `prev_screen` |
| `tab_switched` | `from_tab`, `to_tab` |
| `sport_switched` | `from_sport`, `to_sport` |
| `deeplink_opened` | `route`, `notif_key?` |

### 2.2 Onboarding & activation — C (state) + S (grants)
| Event | Src | Required props |
|---|---|---|
| `signup_started` | C | `method`(email/guest), `entry_point` |
| `signup_completed` | C+S | `user_type` |
| `sports_selected` | C | `sports`(array) |
| `favourite_selected` | C | `kind`(club/driver/constructor), `entity_id` |
| `push_permission_prompted` | C | `surface` |
| `push_permission_result` | C | `granted`(bool) |
| `signup_bonus_granted` | S | `coins`, `tickets` |
| `onboarding_step_viewed` | C | `step` |

### 2.3 Predictions / picks — C+S
| Event | Src | Required props |
|---|---|---|
| `match_viewed` | C | `fixture_id`, `league_id`, `sport` |
| `pick_started` | C | `fixture_id` |
| `pick_placed` | C+S | `fixture_id`, `league_id`, `prediction`, `stake`, `odds`, `sport`, `is_first_pick`(bool) |
| `pick_edited` | C | `fixture_id` |
| `pick_settled` | S | `fixture_id`, `result`, `won`(bool), `payout`, `stake` |
| `results_viewed` | C | `surface`(finished/history) |

### 2.4 Games & competitions — C+S
| Event | Src | Required props |
|---|---|---|
| `games_browsed` | C | `sport`, `tab`(browse/my) |
| `game_viewed` | C | `game_id`, `game_type` |
| `game_joined` | C+S | `game_id`, `game_type`, `entry_cost`, `entry_method`(coins/ticket/masterpass), `is_first_game`(bool) |
| `game_entry_submitted` | C+S | `game_id`, `game_type` |
| `game_settled` | S | `game_id`, `game_type`, `rank`, `participants`, `reward` |
| `leaderboard_viewed` | C | `game_id`, `game_type` |

### 2.5 Fantasy — C+S
| Event | Src | Required props |
|---|---|---|
| `fantasy_lineup_saved` | C+S | `game_id`, `game_week_id`, `complete`(bool), `captain_set`(bool) |
| `fantasy_captain_set` | C | `game_id`, `player_id` |
| `fantasy_transfer_made` | C | `game_id`, `in_player_id`, `out_player_id` |
| `fantasy_gw_settled` | S | `game_id`, `game_week_id`, `points`, `rank` |

### 2.6 Social / squads / virality — C+S
| Event | Src | Required props |
|---|---|---|
| `squad_created` | C+S | `squad_id` |
| `squad_joined` | C+S | `squad_id`, `via`(invite/code/link) |
| `squad_invite_sent` | C | `squad_id`, `channel` |
| `squad_invite_accepted` | C+S | `squad_id`, `inviter_id` |
| `masterpass_sent` | C+S | `game_id`, `tier` |
| `masterpass_claimed` | C+S | `game_id`, `inviter_id` |
| `leaderboard_overtaken` | S | `game_id`, `rival_id` |

### 2.7 Economy — coins / XP / tickets / spins — S (ledger) + C (intent)
| Event | Src | Required props |
|---|---|---|
| `coins_earned` | S | `amount`, `balance_after`, `source`(transaction_type), `ref_id` |
| `coins_spent` | S | `amount`, `balance_after`, `sink`(transaction_type), `ref_id` |
| `xp_earned` | S | `amount`, `source_type`, `ref_id` |
| `level_up` | S | `from_level`, `to_level` |
| `shop_viewed` | C | `surface` |
| `coin_pack_purchased` | C+S | `pack_id`, `coins`, `price` |
| `ticket_granted` | S | `tier`, `reason` |
| `ticket_used` | S | `tier`, `game_id` |
| `spin_played` | C+S | `tier`, `reward_type`, `reward_value` |

### 2.8 Premium — Sportime+ — C (funnel) + S (billing)
| Event | Src | Required props |
|---|---|---|
| `paywall_viewed` | C | `feature`, `surface` |
| `premium_cta_clicked` | C | `plan`, `surface` |
| `premium_purchased` | C+S | `plan`, `price`, `currency` |
| `premium_renewed` | S | `plan` |
| `premium_cancelled` | S | `plan`, `reason?` |
| `premium_payment_failed` | S | `plan` |

### 2.9 Rewards & badges — S
`reward_earned` (`type`, `value`) · `gift_card_redeemed` (`value`, `provider`) · `badge_earned` (`badge_id`).

### 2.10 Notifications — S (`notification_log`) + C (open)
| Event | Src | Required props |
|---|---|---|
| `notif_sent` | S | `notif_key`, `category`, `priority`, `channel` |
| `notif_held` / `notif_skipped` | S | `notif_key`, `reason` |
| `notif_opened` | C | `notif_key`, `route` (from the click handler) |
| `notif_downstream_action` | derived | `notif_key`, `action_event`, `latency_s` |

---

## 3. (covered in §2) — required properties are listed per event above.

## 4. User properties (person props + dims)

Set on PostHog via `identify` + `posthog.register` (super props), mirrored in a `dim_users` mart for SQL cohorts.

**Identity:** `user_id`, `username`, `user_type`, `signup_date`, `registered_at`.
**Acquisition:** `install_source`, `utm_source/medium/campaign` (needs §9 capture), `first_seen_date`.
**Sport affinity:** `follows_football`, `follows_f1`, `favourite_club`, `favourite_driver`, `favourite_constructor`.
**Lifecycle:** `lifecycle_stage` (new/activated/core/at_risk/dormant/churned), `days_since_install`, `last_active_date`, `is_activated` (made first pick), `activation_date`.
**Engagement:** `picks_total`, `games_played_total`, `games_7d`, `last_game_type`, `in_squad`, `squad_count`.
**Economy:** `coins_balance`, `coins_bucket`, `level`, `xp_total`, `lifetime_coins_earned`, `lifetime_coins_spent`.
**Premium:** `is_premium`, `premium_status`, `premium_since`, `ltv_coins`, `ltv_revenue`.
**Comms:** `push_optin`, `tz`, `locale`.

**Super properties (on every event):** `platform`(ios/android/web), `app_version`, `sport`(active universe), `is_premium`, `lifecycle_stage`.

---

## 5. Supabase tables needed (analytics layer)

Keep existing ledgers as-is. Add a thin **server event sink** + **marts**.

```sql
-- 5.1 Server-emitted business events not already in a ledger (settlements, grants, premium,
--     social, notif). Client events stay in PostHog; this is the server stream + a join target.
create table public.analytics_events (
  id          bigint generated always as identity primary key,
  user_id     uuid references public.users(id) on delete set null,
  event       text not null,                 -- matches the catalog name
  props       jsonb not null default '{}',
  source      text not null default 'server',-- server|client_mirror
  session_id  text,
  occurred_at timestamptz not null default now()
);
create index analytics_events_user_time on public.analytics_events (user_id, occurred_at desc);
create index analytics_events_event_time on public.analytics_events (event, occurred_at desc);

-- 5.2 Daily per-user activity fact (DAU/retention/engagement) — rolled up nightly.
create table public.fct_user_day (
  user_id uuid not null references public.users(id) on delete cascade,
  day date not null,
  sessions int default 0, picks int default 0, games_joined int default 0,
  coins_earned int default 0, coins_spent int default 0, xp_earned int default 0,
  active boolean default true,
  primary key (user_id, day)
);

-- 5.3 User dimension mart (cohorts/segments) — refreshed nightly from users + ledgers.
create table public.dim_users (
  user_id uuid primary key references public.users(id) on delete cascade,
  signup_date date, registered_at timestamptz, acquisition_source text,
  first_pick_at timestamptz, is_activated boolean, activation_day_offset int,
  lifecycle_stage text, is_premium boolean, premium_since timestamptz,
  follows_football boolean, follows_f1 boolean, favourite_club text,
  lifetime_coins_earned bigint, lifetime_coins_spent bigint, level text,
  games_played_total int, in_squad boolean, last_active_date date,
  updated_at timestamptz default now()
);

-- 5.4 Retention cohort fact (signup_week × week_offset → retained users).
create table public.fct_retention (
  cohort_week date not null, week_offset int not null,
  cohort_size int not null, retained int not null,
  primary key (cohort_week, week_offset)
);

-- 5.5 OneSignal delivery stats snapshot (pulled from OneSignal API per notif).
create table public.notif_delivery_stats (
  onesignal_id text primary key, notif_key text,
  successful int, failed int, errored int, converted int, fetched_at timestamptz default now()
);
```

> Existing tables reused as marts: `coin_transactions` (coin economy), `xp_events` (XP), `match_bets` (picks), `notification_log` (push), `user_activity_logs` (legacy weekly — can be deprecated once `fct_user_day` lands).

---

## 6. Backend functions needed

| Fn | Type | Role |
|---|---|---|
| `track_server_event(p_user, p_event, p_props)` | RPC/SQL | append to `analytics_events` — called by settlement/premium/social hooks |
| `rollup_user_day(p_day date)` | SQL | build `fct_user_day` from sessions(PostHog export or app pings) + ledgers |
| `refresh_dim_users()` | SQL | rebuild `dim_users` from `users` + ledgers nightly |
| `compute_retention()` | SQL | fill `fct_retention` from `dim_users` + `fct_user_day` |
| `pull_notif_delivery_stats()` | edge fn | OneSignal API → `notif_delivery_stats` (daily) |
| metric RPCs | SQL | `get_north_star()`, `get_activation_funnel(p_from,p_to)`, `get_coin_economy(p_from,p_to)` — power dashboards/alerts |

Hook points (emit `analytics_events` server-side): `notify-settlements` (`pick_settled`), `complete_guest_registration` (`signup_completed`,`signup_bonus_granted`), `revenuecat-webhook` (premium_*), settlement/finalize crons (`game_settled`), `notify` orchestrator already writes `notification_log` (`notif_sent`).

---

## 7. Capacitor integration plan

1. **Typed event catalog** — `src/analytics/events.ts`: `export const EVENTS = {...} as const` + a typed `track<E>(event, props)` wrapper so names/props are compile-checked. Kills ad-hoc strings.
2. **Super properties** — on init: `posthog.register({ platform, app_version, sport })`; update `sport` on `sport_switched`.
3. **Identify enrichment** — on auth: `identifyUser(id, { username, user_type, signup_date, is_premium, follows_* , lifecycle_stage })`.
4. **Screen tracking** — central `screen_viewed` on `page`/drill-in state change (App router) with `prev_screen`.
5. **Session model** — `session_started` on cold start + on resume after >30 min background (hook `useResumeRefresh`); `app_backgrounded` with duration.
6. **Server ping for DAU** — lightweight `users.last_active_at` already set on open (done); `fct_user_day` derives sessions from it + PostHog.
7. **Offline/again** — PostHog buffers; ensure `flush` on background.
8. **No PII** in props; respect `person_profiles:'identified_only'` (guests stay anonymous until signup).
9. **Instrument the core funnel first** (signup→pick→game→results→premium) before long-tail.

---

## 8. OneSignal integration plan (push measurement)

1. **Sent** — already logged in `notification_log` by the `notify` orchestrator (`notif_sent`, status, priority, category).
2. **Opened** — the OneSignal click handler (B1) fires `posthog.capture('notif_opened', { notif_key, route })` **and** patches `notification_log.opened_at`. Add the PostHog call to `setNotificationOpenHandler`.
3. **Delivered/Errored** — `pull_notif_delivery_stats` edge fn calls OneSignal `GET /notifications/{id}` per recent send → `notif_delivery_stats`.
4. **Attribution** — `notif_downstream_action`: join `notification_log` (sent) → next qualifying event (pick_placed/game_joined/premium_purchased) for that user within an **attribution window** (e.g. 24h) → measures true incrementality vs the **10% holdout** (`users.mkt_holdout`, already built).
5. **Per-notif KPIs:** sent → delivered → open rate → CTR → downstream conversion → opt-out/mute. Surfaced in the Notifications dashboard.

---

## 9. Attribution / acquisition (needs setup)

- Capture `utm_*` + referrer at first open (deeplink/universal link params) → store on `dim_users.acquisition_source`.
- iOS install attribution: requires an MMP or Apple Ads/AppsFlyer/Branch SDK (not present). **Phase 4** decision — for now mark `acquisition_source='organic/unknown'` and capture in-app referral source (masterpass/squad link) which we DO control.

---

## 10. Priority dashboards

1. **North Star / Exec** — DAU/WAU/MAU, DAU/MAU stickiness, D1/D7/D30 retention, activation rate, premium conversion, ARPU, coin-economy health, push opt-in.
2. **Activation funnel** (§11) with drop-off + time-to-activate.
3. **Retention & cohorts** — signup-week curves, by sport / first-game-type / acquisition / activation.
4. **Engagement** — sessions/user, picks/user, games/user, feature adoption, DAU by surface.
5. **Coin economy** — sources vs sinks, net issuance (inflation), balance distribution, sink/source ratio, top sinks.
6. **Games & competitions** — joins by type, completion rate, repeat rate, fill rate.
7. **Fantasy** — lineup completion, GW participation, captain-set rate.
8. **Premium funnel** — paywall→cta→purchase, conversion by segment, MRR, churn, LTV.
9. **Notifications** — per-notif sent/delivered/open/CTR/downstream + holdout lift + opt-out.
10. **Social / virality** — invites sent→accepted, **k-factor**, squad membership %, squad retention lift.

---

## 11. Activation funnels

**Primary activation funnel:**
`app_opened` → `signup_completed` → `sports_selected` → `favourite_selected` → **`pick_placed` (first)** → `pick_settled` (first) → `game_joined` (first) → **D1 return** (`active` day+1).
> North-star activation event = **first `pick_placed`**. Target: minimise time-to-first-pick.

**Secondary funnels:** Game (`game_viewed`→`game_joined`→`game_entry_submitted`→`game_settled`) · Premium (`paywall_viewed`→`premium_cta_clicked`→`premium_purchased`) · Social (`squad_invite_sent`→`squad_invite_accepted`).

---

## 12. Retention cohorts

- **Signup-week cohorts** → D1/D7/D30/D90 + weekly curves (classic + unbounded/rolling).
- Split by: **sport** (football vs F1), **first game type**, **acquisition source**, **activated vs not**, **premium vs free**, **in-squad vs solo** (expect squad retention lift), **made-first-pick day-0 vs later**.
- **Stickiness** DAU/MAU per cohort. **Resurrection** (dormant→active) rate from reactivation pushes.

---

## 13. Domain metrics

**Coins:** issued/day by source, spent/day by sink, **net issuance (inflation)**, sink:source ratio (health ~≥1), balance distribution (median/p90), % balances growing without spend (hoarding), coins per DAU.
**XP:** XP/day by `source_type`, level distribution, median time-to-level, XP→retention correlation.
**Squads:** squads created/day, members/squad (avg/median), **% users in ≥1 squad**, invite accept rate, **squad retention lift** (in-squad D30 vs solo).
**Fantasy:** teams set/GW, **lineup completion rate**, captain-set rate, GW participation, transfers/user, fantasy→overall retention.
**Competitions:** games joined/user, **completion rate**, repeat participation (joined ≥2), entry method mix (coins/ticket/masterpass), fill/abandon rate.
**Sportime+:** paywall view→purchase **conversion**, conversion by segment (core daily, level, coin-bucket), **MRR/ARPPU/ARPU**, **churn rate**, **LTV** (revenue + coin-value), dunning recovery rate, perk usage.

---

## 14. Data alerts

**Pipeline / quality:** event volume drop >30% d/d (PostHog), ingestion lag > 1h, spike in events with null `user_id`, schema violation (unknown event/prop), `identify` failure rate, nightly rollup job failure (`fct_user_day`/`dim_users`), `analytics_events` write errors.
**Business guardrails:** DAU drop >15% d/d, D1 retention drop >5pp w/w, activation rate drop, premium conversion drop, **coin net-issuance anomaly** (inflation spike), settlement backlog (unsettled bets aging), **push opt-out / uninstall spike**, paywall conversion collapse.
Delivery: PostHog alerts + a Supabase `cron` running threshold RPCs → Slack/email (or a `data_alerts` table surfaced in admin).

---

## 15. Roadmap

**Phase 0 — Foundations (1–2d):** naming standard + **typed event catalog** (`events.ts`), super props, identify enrichment, `screen_viewed` + session model. Ship `analytics_events` table + `track_server_event`.
**Phase 1 — Core funnel (week 1):** instrument signup→pick→game→results→premium (client) + server hooks (`pick_settled`, `signup_completed`, `game_settled`, premium_*). Activation funnel live.
**Phase 2 — Marts & retention (week 2):** `fct_user_day`, `dim_users`, `fct_retention` + nightly jobs. North-Star + Activation + Retention dashboards.
**Phase 3 — Economy / premium / push (week 3):** coin economy, premium funnel, notifications dashboard (open/CTR/holdout lift via `notif_opened` + `notif_delivery_stats`).
**Phase 4 — Virality, attribution, alerts (week 4):** k-factor & squad lift, acquisition source capture (in-app referral now, MMP later), data-quality + business alerts.

> Definition of done per phase: events flowing + reconciled (PostHog count ≈ server ledger ±tolerance) + one dashboard + one alert. Build the catalog first — every later phase plugs into it.
