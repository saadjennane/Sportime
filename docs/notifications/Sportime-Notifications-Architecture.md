# Sportime — Notifications & Lifecycle Architecture (v1)

> Owner: Growth / CRM. Audience: Product + Engineering.
> Philosophy: **earn the slot.** We don't maximize sends — we maximize activation, retention (D1/D7/D30/D90), daily habit, game participation, Sportime+ conversion, reactivation and LTV. A notification that can't defend its expected uplift doesn't ship.
> Channels v1: **Push (OneSignal) + In-App Messages (OneSignal IAM)**. Email = phase 2.

---

## 0. Current infrastructure (audited — what exists vs. gaps)

### Exists ✅
- **Edge fn `send-notification`**: input `{userId, type, title, message, actionLabel, actionLink, metadata}`. Targets `user_onesignal_players.player_id`, honours `notification_preferences`, writes the in-app feed row in `notifications`. Types: `gameplay|league|squad|premium|reminder|system`.
- **Tables**: `notifications` (in-app feed), `notification_preferences` (per-category + push/in_app/email toggles), `user_onesignal_players` (device map).
- **OneSignal native** wired (`oneSignalService.ts`), `OneSignal.login(userId)` sets **external_id = profile id**. App ID `7873fb7e-...`. REST key available server-side.
- **~30 cron jobs** (settle / finalize / autocreate / live-scores / sync) = ready-made backend triggers.
- **Deep link**: only `sportime://masterpass/<token>` + `https://sportime.app/i/<token>`.

### Gaps to build (see §6)
- **Deep-link router** for arbitrary routes (only masterpass today).
- **Notification orchestrator** layer (frequency cap, quiet hours, priority arbitration, dedup/digest) above `send-notification`.
- **Scheduler** for time-relative sends (kickoff T-60, fantasy/TQ deadline T-3h/T-1h).
- **Tag-sync job** (push user attributes → OneSignal tags) — required for all segmentation.
- **Notify hooks** inside `settle-*` / `finalize-challenges` / `check-badge-awards` / `revenuecat-webhook`.
- **`send-notification` v2**: target by `external_id`, support `send_after` + timezone delivery, segments, IAM, and write to a `notification_log` for capping.

---

## 1. Global rules (the discipline layer)

### 1.1 Priority tiers (arbitration)
| Tier | Meaning | Examples | Cap behaviour |
|---|---|---|---|
| **P0 — Transactional / time-sensitive** | User asked for it / will miss value | Pick settled, match kickoff reminder, fantasy deadline, premium payment failed | Always delivered. Exempt from marketing cap but **digested** when bursty. |
| **P1 — High-value engagement** | Drives the core habit loop | Today's matches, streak-at-risk, results recap, live drama, new live game | Subject to global cap; preempts P2. |
| **P2 — Marketing / growth** | Promo / upsell / winback | Sportime+ offer, reactivation, feature discovery | Strictest caps; never sent if a P0/P1 already used the day's slot. |

**Rule:** at most **one P2 per day**, and only if it doesn't collide with a P0/P1 already queued.

### 1.2 Frequency caps (per user, rolling)
- **Marketing (P1+P2 combined): max 2/day, 5/week.** Hard cap.
- **P2 alone: max 1/day, max 3/week.**
- **Per category sub-caps:** Social ≤1/day · Premium ≤2/week · Reactivation ≤1 per dormancy stage · Rewards ≤1/day.
- **Transactional (P0):** uncapped in principle but **bundled**: multiple settlements within 15 min collapse into ONE digest ("3 picks settled · +1,240 coins").
- **New-user ramp:** week 1 capped at **1 marketing push/day** to avoid early fatigue.

### 1.3 Quiet hours & timing
- **Quiet hours 22:00–08:00 local.** Anything generated in that window is held to ~08:30 local (except P0 that is itself time-critical AND user-initiated, e.g. live result the user is watching).
- **Timezone-local delivery** for all scheduled/broadcast sends (OneSignal `delayed_option: "timezone"` + per-user `tz` tag fallback).
- **Send-time optimization:** enable OneSignal **Intelligent Delivery** for non-time-sensitive P1/P2.
- **Anchor windows (local):** Morning brief 08:30–09:30 · Lunch 12:30–13:30 · Pre-prime 18:00–19:30 · Evening 20:30–21:30. Match-relative beats anchors when a fixture is involved.

### 1.4 Anti-spam guarantees
- Respect `notification_preferences` (category + `push_enabled` + `in_app_enabled`) — already enforced by `send-notification`.
- **Dedup:** never repeat the same `(type, entity_id)` within its cooldown (default 12h).
- **Engagement throttle:** if a user ignores **3 consecutive marketing pushes** → drop them to "best-performing only" cadence (≤2/week) until next open.
- **Holdout:** keep a **10% global holdout** (no marketing push) to measure true incremental retention/LTV.
- **Kill-switch:** every campaign has an `enabled` flag + a `notification_log` for audit.

---

## 2. Exhaustive notification catalog

Legend — **Pri**: 🔴 critique / 🟠 importante / 🔵 secondaire. **MVP**: ✅ ship for launch. **Evt**: ✅ trigger exists / 🛠 to build.
Deep links use the proposed router (§4). Default OneSignal type maps to `notification_preferences` category.

### 2.1 Onboarding
| ID | Notification | Pri | MVP | Trigger | Deep link | Evt |
|---|---|---|---|---|---|---|
| ON-1 | Welcome | 🔴 | ✅ | Account created (signup) | `sportime://matches` | 🛠 onboarding drip |
| ON-2 | Make your first pick | 🔴 | ✅ | D0 +2h, no pick yet | `sportime://match/{nextBigFixture}` | 🛠 |
| ON-3 | Claim your welcome coins | 🟠 | ✅ | D0, coins granted & unspent | `sportime://shop` | 🛠 |
| ON-4 | Join your first game | 🔴 | ✅ | D1, no `game_joined` | `sportime://games` | ✅ `game_joined` |
| ON-5 | Set your favourite club / driver | 🔵 | – | D2, no favourite set | `sportime://fanpulse` | 🛠 |
| ON-6 | Invite / join a squad | 🟠 | – | D3, not in a squad | `sportime://squads` | 🛠 |
| ON-7 | Onboarding complete / first reward | 🔵 | – | All activation steps done | `sportime://profile` | 🛠 |

### 2.2 Activation
| ID | Notification | Pri | MVP | Trigger | Deep link | Evt |
|---|---|---|---|---|---|---|
| AC-1 | First pick confirmed | 🟠 | ✅ | First `match_bet` placed | `sportime://picks` | 🛠 hook on bet insert |
| AC-2 | First win celebration | 🔴 | ✅ | First settled pick = won | `sportime://finished` | 🛠 settle hook |
| AC-3 | Aha: results are in | 🟠 | ✅ | First settlement (won/lost) | `sportime://finished` | 🛠 settle hook |
| AC-4 | Try another game type | 🔵 | – | Played 1 type only, D2–D5 | `sportime://games` | 🛠 |
| AC-5 | Complete your profile | 🔵 | – | Profile <60% complete D2 | `sportime://profile` | 🛠 |

### 2.3 Daily engagement (the habit loop)
| ID | Notification | Pri | MVP | Trigger | Deep link | Evt |
|---|---|---|---|---|---|---|
| DE-1 | Today's matches are live to pick | 🟠 | ✅ | Daily AM, fixtures exist for followed sport | `sportime://matches` | ✅ `sync-fixtures-daily` 05:00 |
| DE-2 | You have N matches un-picked | 🟠 | ✅ | Pre-prime, ≥1 today fixture not picked | `sportime://matches` | 🛠 daily scan |
| DE-3 | Daily spin ready | 🟠 | ✅ | Free spin available, unused | `sportime://spin/free` | 🛠 spin-state scan |
| DE-4 | Streak at risk | 🔴 | ✅ | Streak>0, no action by 20:00 local | `sportime://matches` | 🛠 streak engine |
| DE-5 | Streak milestone (7/30/100) | 🔵 | – | Streak crosses milestone | `sportime://profile` | 🛠 streak engine |
| DE-6 | Daily puzzle / FunZone ready | 🔵 | – | `funzone-puzzle-generate` done | `sportime://fanpulse` | ✅ cron 03:17 |
| DE-7 | Leaderboard movement (you climbed/dropped) | 🔵 | – | Rank change in a joined game | `sportime://leaderboard/{gameId}` | 🛠 |

### 2.4 Matches & competitions
| ID | Notification | Pri | MVP | Trigger | Deep link | Evt |
|---|---|---|---|---|---|---|
| MC-1 | Kickoff reminder (your pick) | 🔴 | ✅ | T-60min on a fixture the user picked | `sportime://match/{fixtureId}` | 🛠 scheduler |
| MC-2 | Last call to pick (T-30) | 🟠 | ✅ | T-30min, big fixture, user not picked | `sportime://match/{fixtureId}` | 🛠 scheduler |
| MC-3 | Pick settled (win/lose) | 🔴 | ✅ | `settle-match-bets` resolves user bet | `sportime://finished` | ✅ cron 🛠 hook |
| MC-4 | Daily results digest | 🟠 | ✅ | EOD, ≥1 settlement that day | `sportime://finished` | 🛠 digest |
| MC-5 | Competition starts soon | 🟠 | – | Joined challenge starts T-3h | `sportime://challenge/{id}` | 🛠 |
| MC-6 | Competition results / final standing | 🔴 | ✅ | `finalize-challenges` | `sportime://leaderboard/{id}` | ✅ cron 🛠 hook |
| MC-7 | Live drama (your match) | 🔵 | – | Goal/red card in a fixture user is on | `sportime://match/{fixtureId}` | ✅ `capture-fixture-events` (opt-in) |
| MC-8 | New live game available (MR/LF) | 🟠 | – | `match-royale/live-fantasy-autocreate` | `sportime://live/{id}` | ✅ cron 🛠 hook |
| MC-9 | Tournament Quest: daily picks open | 🟠 | – | TQ has predictable matches today | `sportime://tq/{id}` | ✅ `tq-resolve-running` |

### 2.5 Fantasy
| ID | Notification | Pri | MVP | Trigger | Deep link | Evt |
|---|---|---|---|---|---|---|
| FA-1 | Set your lineup (deadline T-24h) | 🟠 | ✅ | Gameweek deadline -24h, lineup empty/dirty | `sportime://fantasy/{gameId}` | 🛠 deadline scheduler |
| FA-2 | Deadline T-3h / T-1h | 🔴 | ✅ | Deadline approaching, lineup not set | `sportime://fantasy/{gameId}` | 🛠 scheduler |
| FA-3 | Captain not set | 🟠 | – | Deadline -3h, no captain | `sportime://fantasy/{gameId}` | 🛠 |
| FA-4 | Gameweek live: your team is scoring | 🔵 | – | First points event during GW | `sportime://fantasy/{gameId}` | ✅ live-tick (opt-in) |
| FA-5 | Gameweek results | 🔴 | ✅ | `settle-fantasy-gameweeks` | `sportime://fantasy/{gameId}` | ✅ cron 🛠 hook |
| FA-6 | Transfer/price/injury alert | 🔵 | – | Injury to a player user owns | `sportime://fantasy/{gameId}` | ✅ `sync-injuries` 🛠 hook |
| FA-7 | F1: lineups published (Live Fantasy) | 🟠 | – | `lf-autocreate` (user opted `lf_notify`) | `sportime://live/{id}` | ✅ cron 🛠 hook |

### 2.6 Social (squads / leagues)
| ID | Notification | Pri | MVP | Trigger | Deep link | Evt |
|---|---|---|---|---|---|---|
| SO-1 | Squad invite received | 🔴 | ✅ | Invite created for user | `sportime://league/join/{code}` | 🛠 (masterpass exists) |
| SO-2 | Friend joined your squad/league | 🟠 | – | New member in user's squad | `sportime://squad/{id}` | 🛠 |
| SO-3 | Someone overtook you (rival) | 🟠 | – | Rank drop vs squadmate | `sportime://leaderboard/{gameId}` | 🛠 |
| SO-4 | Squad activity digest | 🔵 | – | Weekly, active squad | `sportime://squad/{id}` | 🛠 |
| SO-5 | You were challenged (Masterpass +1) | 🟠 | ✅ | Masterpass invite | `sportime://masterpass/{token}` | ✅ |
| SO-6 | Head-to-head result vs friend | 🔵 | – | Settlement where squadmate also played | `sportime://leaderboard/{gameId}` | 🛠 |

### 2.7 Rewards
| ID | Notification | Pri | MVP | Trigger | Deep link | Evt |
|---|---|---|---|---|---|---|
| RW-1 | Coins earned (milestone) | 🔵 | – | Coin balance crosses threshold | `sportime://shop` | 🛠 |
| RW-2 | Level up / new tier | 🟠 | ✅ | XP level increases | `sportime://profile` | ✅ `calculate-weekly-xp` 🛠 hook |
| RW-3 | Badge unlocked | 🔵 | – | `check-badge-awards` | `sportime://profile` | ✅ fn 🛠 hook |
| RW-4 | Free ticket / spin granted | 🟠 | – | Ticket/spin credited | `sportime://wallet` | 🛠 |
| RW-5 | Gift card available / redeemable | 🟠 | – | Reward fulfillment ready | `sportime://wallet` | 🛠 |
| RW-6 | Weekly recap (your week in numbers) | 🟠 | – | Weekly, active users | `sportime://profile/stats` | 🛠 recap generator |

### 2.8 Premium (Sportime+)
| ID | Notification | Pri | MVP | Trigger | Deep link | Evt |
|---|---|---|---|---|---|---|
| PR-1 | Premium offer at engagement peak | 🟠 | – | High-engagement non-sub (tag) hits value moment | `sportime://premium` | 🛠 |
| PR-2 | You hit a paywall feature | 🟠 | – | Non-sub taps a premium-gated action | `sportime://premium` | 🛠 (client) |
| PR-3 | Trial ending in 48h | 🔴 | – | RevenueCat trial expiry -48h | `sportime://premium` | ✅ `revenuecat-webhook` 🛠 |
| PR-4 | Payment failed (dunning) | 🔴 | – | RevenueCat billing issue | `sportime://premium` | ✅ webhook 🛠 |
| PR-5 | Subscription renewed (thanks) | 🔵 | – | Renewal | `sportime://profile` | ✅ webhook 🛠 |
| PR-6 | Win-back expired premium | 🟠 | – | Churned subscriber, +14d | `sportime://premium` | 🛠 |
| PR-7 | Premium perk reminder (use it) | 🔵 | – | Sub hasn't used a perk in 14d | varies | 🛠 |

### 2.9 Reactivation (dormant)
| ID | Notification | Pri | MVP | Trigger | Deep link | Evt |
|---|---|---|---|---|---|---|
| RE-1 | Day-3 nudge ("matches you'll like") | 🟠 | ✅ | No open 3d | `sportime://matches` | 🛠 dormancy cron |
| RE-2 | Day-7 win-back + incentive (free spin/coins) | 🔴 | ✅ | No open 7d | `sportime://spin/free` | 🛠 |
| RE-3 | Day-14 "your squad misses you / leaderboard moved" | 🟠 | – | No open 14d | `sportime://squads` | 🛠 |
| RE-4 | Day-30 big-event hook | 🟠 | – | No open 30d + marquee fixture | `sportime://matches` | 🛠 |
| RE-5 | Day-60/90 last-chance + reward | 🔵 | – | No open 60–90d | `sportime://matches` | 🛠 |

### 2.10 Churn prevention
| ID | Notification | Pri | MVP | Trigger | Deep link | Evt |
|---|---|---|---|---|---|---|
| CH-1 | Streak about to break | 🔴 | ✅ | (= DE-4) streak>0, idle, 20:00 local | `sportime://matches` | 🛠 streak engine |
| CH-2 | Unfinished pick / abandoned game | 🟠 | – | Started but didn't submit, T-90min | `sportime://game/{id}` | 🛠 |
| CH-3 | Engagement dip detected | 🟠 | – | Active→sliding (e.g. 5/7→1/7 days) | `sportime://matches` | 🛠 |
| CH-4 | Lapsed favourite event | 🔵 | – | Favourite club/driver plays, user idle 2d | `sportime://match/{fixtureId}` | 🛠 |
| CH-5 | We changed something for you (feature/winback) | 🔵 | – | Post-update, at-risk segment | `sportime://matches` | 🛠 |

---

## 3. MVP scope (launch set)

Ship these **15** first — they cover activation + the daily loop + the highest-LTV moments, and most reuse existing crons:

**Onboarding:** ON-1, ON-2, ON-3, ON-4
**Activation:** AC-1, AC-2
**Daily:** DE-1, DE-3, DE-4
**Matches:** MC-1, MC-3, MC-4, MC-6
**Social:** SO-1
**Reactivation:** RE-1, RE-2

> Rationale: D1/D7 retention is won by (a) getting the first pick + first result loop (ON/AC), (b) a daily reason to return (DE-1/3/4, MC-1), and (c) catching the drop-off early (RE-1/RE-2). Premium/Fantasy/Social depth come in iteration 2 once the loop measures positive.

---

## 4. Deep-link router (proposed scheme) — 🛠 to build

Single scheme `sportime://` (+ universal `https://sportime.app/...` mirror). Notification payload carries `data.route` = a `sportime://...` URL; the OneSignal open-handler parses it → sets `page` + drill-in state. Today only `masterpass` is handled.

| Route | Resolves to |
|---|---|
| `sportime://matches` · `…/picks` · `…/finished` | Matches page (tab) |
| `sportime://match/{fixtureId}` | Match → BetModal/stats |
| `sportime://games` · `sportime://game/{id}` | Games (Browse / room, type-aware) |
| `sportime://challenge/{id}` `…/swipe/{id}` `…/fantasy/{id}` `…/tq/{id}` `…/live/{id}` | Specific game room |
| `sportime://leaderboard/{gameId}` | Game leaderboard |
| `sportime://squads` · `sportime://squad/{id}` · `sportime://league/join/{code}` | Squads / league |
| `sportime://fanpulse` · `sportime://f1` | Fan Pulse / F1 universe |
| `sportime://shop` · `sportime://wallet` · `sportime://spin/{tier}` | Coin shop / wallet / spin |
| `sportime://premium` | Sportime+ modal |
| `sportime://profile` · `…/stats` · `…/history` | Profile / Stats / Pick History |
| `sportime://masterpass/{token}` | Masterpass claim ✅ (exists) |

**Action:** implement `resolveRoute(url)` in App + wire OneSignal `notificationOpened` handler to it. Store the route in `notifications.action_link` (already a column).

---

## 5. OneSignal **tags** (user attributes for segmentation) — 🛠 tag-sync job

Set via `OneSignal.User.addTags()` on the client at key moments + a nightly server reconcile (`sync-onesignal-tags` cron pushing from DB via REST `PATCH /users/by/external_id/{id}`).

| Tag | Type | Source | Used by |
|---|---|---|---|
| `tz` | string | device | all scheduled sends |
| `locale` | string | device | localization |
| `lifecycle_stage` | new\|activated\|core\|at_risk\|dormant\|churned | computed | segments, journeys |
| `install_date` / `days_since_install` | date/int | profile.created_at | onboarding drip |
| `last_active_date` / `dormant_days` | date/int | last_active_at | reactivation |
| `d1_activated` / `d7_retained` | bool | computed | activation analysis |
| `level` | string | profile.current_level | rewards, tier copy |
| `coins_bucket` | low\|mid\|high | coins_balance | rewards, premium |
| `is_premium` / `premium_status` | bool / active\|trial\|expired\|none | revenuecat | premium journeys, suppress upsell |
| `follows_football` / `follows_f1` | bool | users.sports | sport-relevant sends |
| `favorite_club` / `favorite_f1_driver` / `favorite_f1_constructor` | string | profile | favourite-event hooks |
| `has_pending_pick` / `pending_picks_count` | bool/int | match_bets | reminders, suppression |
| `streak_count` / `streak_at_risk` | int/bool | streak engine | DE-4/CH-1 |
| `in_squad` / `squad_count` | bool/int | squad_members | social journeys |
| `games_played_total` / `games_7d` | int | aggregates | core vs casual |
| `last_game_type` | string | activity | cross-sell |
| `fantasy_active` / `fantasy_deadline_pending` | bool | rosters | fantasy reminders |
| `spins_available` / `tickets_total` | bool/int | spin/ticket state | rewards |
| `push_optin` | bool | OneSignal subscription | base gate |
| `ignored_streak` | int | engagement throttle | anti-spam |

---

## 6. OneSignal **segments** (built from tags)

| Segment | Definition | Drives |
|---|---|---|
| **Push Opted-In** | `push_optin = true` | base for all marketing |
| **New Users** | `days_since_install ≤ 1` AND `lifecycle_stage = new` | onboarding |
| **Activated** | `d1_activated = true` | post-activation loop |
| **Core Daily** | `games_7d ≥ 5` | habit reinforcement, premium upsell |
| **Casual** | `1 ≤ games_7d ≤ 4` | frequency-building |
| **At Risk** | `dormant_days 3–6` | early winback (RE-1) |
| **Dormant** | `dormant_days 7–29` | RE-2/RE-3 |
| **Deep Dormant** | `dormant_days 30–89` | RE-4 |
| **Churned** | `dormant_days ≥ 90` | RE-5 / holdout |
| **Streak At Risk** | `streak_at_risk = true` | DE-4/CH-1 |
| **Football Followers** / **F1 Followers** | `follows_football` / `follows_f1` | sport-targeted match/fantasy |
| **Squad Members** / **Solo Players** | `in_squad` true/false | social vs invite-to-squad |
| **No Pick Today** | `has_pending_pick = false` AND fixtures exist | DE-2 |
| **Fantasy Managers** | `fantasy_active = true` | fantasy journeys |
| **Premium Subscribers** | `is_premium = true` | suppress upsell, perk reminders |
| **Premium Trial** | `premium_status = trial` | PR-3 |
| **Premium Expired** | `premium_status = expired` | PR-6 win-back |
| **Premium Eligible** | `Core Daily` AND `is_premium = false` | PR-1 upsell |
| **Spin Available** | `spins_available = true` | DE-3 |
| **Marketing Holdout (10%)** | random bucket | incrementality |

---

## 7. Backend events / jobs to create

| # | Component | Pri | Notes |
|---|---|---|---|
| B1 | **Deep-link router** (app) | 🔴 | §4. Unblocks every actionable notif. |
| B2 | **Notification orchestrator** (edge fn `notify`) | 🔴 | Wraps `send-notification`: priority arbitration, frequency cap, quiet-hours hold, dedup/digest, `notification_log` write, external_id targeting. All triggers call THIS, not `send-notification` directly. |
| B3 | **`notification_log` table** | 🔴 | `(user_id, key, category, priority, sent_at, opened_at)` — powers caps + holdout + analytics. |
| B4 | **`send-notification` v2** | 🔴 | Target `include_aliases.external_id`; support `send_after` + `delayed_option:"timezone"`; segment sends; IAM. |
| B5 | **Tag-sync job** `sync-onesignal-tags` (cron, ~15min + on-event) | 🔴 | §5. DB → OneSignal tags via REST. |
| B6 | **Settlement notify hooks** in `settle-match-bets/-swipe/-challenge/-fantasy/-live` + `finalize-challenges` | 🔴 | Emit MC-3/MC-6/FA-5/AC-2 → orchestrator (digested). |
| B7 | **Kickoff/deadline scheduler** | 🔴 | Per fixture/gameweek, fan-out reminders to users with picks/lineups (MC-1/2, FA-1/2). |
| B8 | **Streak engine** (`user_streaks` already exists) + at-risk scan | 🟠 | DE-4/DE-5/CH-1. |
| B9 | **Onboarding drip scheduler** (D0–D7 state machine) | 🔴 | ON-1..7 / AC-*. |
| B10 | **Dormancy cron** `detect-dormant` | 🟠 | Updates `lifecycle_stage`, fires RE-1..5. |
| B11 | **Premium lifecycle hooks** in `revenuecat-webhook` | 🟠 | PR-3/4/5/6. |
| B12 | **Badge / level / reward hooks** in `check-badge-awards`, `calculate-weekly-xp` | 🔵 | RW-2/3, weekly recap RW-6. |
| B13 | **Live-event opt-in pipe** from `capture-fixture-events` | 🔵 | MC-7/FA-4, strictly opt-in + capped. |

---

## 8. Automated journeys

### J1 — Onboarding (D0→D7) 🔴 MVP
`signup` → ON-1 (instant) → ON-2 (D0+2h if no pick) → ON-3 (D0 eve if coins unspent) → ON-4 (D1 AM if no game) → [first pick → AC-1 → first result → AC-2/AC-3] → ON-6 (D3 if solo) → exit to Daily loop when `activated`.
*Exit on:* user becomes `core`. *Suppress:* once next step's goal met.

### J2 — Daily habit loop 🔴 MVP
Morning DE-1 (followed sport, fixtures exist) → pre-kickoff MC-1 (picks) / DE-2 (un-picked) → settlement MC-3 → EOD digest MC-4 → streak guard DE-4 (20:00). Spin DE-3 slotted when nothing else fired.

### J3 — Reactivation ladder 🟠 MVP (RE-1/2)
D3 RE-1 (relevant matches) → D7 RE-2 (incentive: free spin/coins) → D14 RE-3 (social/leaderboard) → D30 RE-4 (marquee event) → D60–90 RE-5 (last chance). Stop on any open. Escalating incentive, decreasing frequency.

### J4 — Churn prevention 🟠
Streak-at-risk CH-1 · engagement-dip CH-3 · abandoned-game CH-2 · favourite-event CH-4. Pre-emptive, before the user goes dormant.

### J5 — Premium 🟠
PR-1 (Premium Eligible at value peak) / PR-2 (paywall hit) → trial: PR-3 (T-48h) → dunning PR-4 → PR-6 win-back (+14d churned). Hard-suppress all upsell for `is_premium`.

### J6 — Fantasy 🟠
FA-1 (deadline-24h) → FA-2 (T-3h/T-1h if unset) → FA-4 (live, opt-in) → FA-5 (results) → FA-6 (injury). Gated to `Fantasy Managers`.

### J7 — Social 🔵
SO-1 invite → SO-2 friend joined → SO-3 overtaken (rivalry) → SO-4 weekly squad digest. Caps: ≤1 social/day.

---

## 9. Measurement
- **Primary:** incremental D1/D7/D30 retention & D30 game-participation vs the **10% holdout**.
- **Per-notification:** sent → delivered → opened → **downstream action** (pick/game-join/purchase) within attribution window, not just CTR.
- **Guardrails:** push opt-out rate, marketing-push mute rate, uninstall rate. If a campaign lifts CTR but raises opt-out/uninstall → kill it.
- **Fatigue monitor:** rolling opt-out & ignore-streak by cohort; auto-throttle (§1.4).

---

## 10. Build order (recommended)
1. **B1 router + B2 orchestrator + B3 log + B4 v2 + B5 tags** (the rails — nothing ships without these).
2. **MVP-15** (§3): J1 onboarding + J2 daily loop + settlement hooks B6 + scheduler B7.
3. **B10 dormancy + J3 reactivation.**
4. Iterate: Fantasy J6, Premium J5, Social J7, live/opt-in B13.

> Everything above maps to real Sportime entities, pages and crons. `🛠` = backlog item; `✅` = trigger already runs. Per-notification full specs (copy variants, A/B, OneSignal payload JSON) are produced category-by-category in follow-up docs under `docs/notifications/`.
