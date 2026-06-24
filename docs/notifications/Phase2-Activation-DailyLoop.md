# Phase 2 — ACTIVATION + DAILY LOOP (full spec)

> Copy: **English only**. This is the **core habit loop** — the engine of D7/D30 retention.
> Channel rule unchanged: **in-session = in-app**, **bring-back = push**. Everything routes through the `notify` orchestrator (caps, quiet hours, digest).
> Streak notifications are **removed** (no streak concept in product).

## The daily loop at a glance (one user's day, local time)

| Slot | Notif | Channel | Fires if |
|---|---|---|---|
| 08:30–09:30 | DE-1 Today's matches | push | fixtures exist in followed sport |
| T-60 before fav club KO | MC-1 Kickoff (fav club) | push | favourite club plays |
| on settle | MC-3 Pick settled / AC-2 first win | push | a bet resolves |
| 18:00–19:30 | DE-2 Haven't picked | push | **0 picks today** & fixtures exist |
| midday/eve (spare slot) | DE-3 Free spin | push | free spin unused |
| ~21:00 | MC-4 Results (wins) | push | **won ≥1 today** & **no tomorrow pick** |

**Daily marketing cap = 2** (P1+P2). P0 (MC-1 picked / MC-3 / AC-2) are exempt but digested. Arbitration (orchestrator): DE-1 takes the morning slot; the evening slot goes to **DE-2 → MC-4 → DE-3** in that order; the rest yield to next day.

---

## ACTIVATION

### AC-1 — First pick confirmed (in-app)
- **Objective:** close the loop on the very first action, set the expectation that results will be notified (primes the value of push).
- **Channel:** **In-app** (confirmation / IAM) — the user is in session when they place it. No push.
- **Trigger:** first ever pick placed (`match_bet` insert where user has exactly 1 bet).
- **Audience:** new users, first bet.
- **Priority / cap:** n/a, once.
- **Copy:** **"Pick locked in ✅"** — *"You're on {Pick} for {TeamA} vs {TeamB}. We'll let you know the moment it settles."*
- **Deep link / CTA:** `sportime://picks`
- **Backend:** 🛠 client detects "first bet" → in-app confirmation. Sets tag `has_pending_pick=true`.

### AC-2 — First win (push)
- **Objective:** the dopamine milestone — convert the first result into a second pick.
- **Channel:** **Push** (+ in-app feed). **Supersedes MC-3** for the first settled win (don't double-send).
- **Trigger:** first settled pick = **won** (settlement hook).
- **Audience:** users with exactly 1 settled win.
- **Priority:** P0. **Cap:** once.
- **Copy:** **"You won your first pick! 🎉 +{amount} coins"** — *"Big start. Line up your next prediction and keep it rolling."*
- **Deep link:** `sportime://finished`
- **Backend:** 🛠 settlement hook flags first-win → `notify(AC-2)`; orchestrator skips MC-3 for that bet.

---

## DAILY ENGAGEMENT

### DE-1 — Today's matches (push) — *Copy B*
- **Objective:** the daily reason to open — lead with the marquee fixture.
- **Channel:** **Push.**
- **Trigger:** morning **08:30–09:30 local**, ≥1 fixture today in a **followed sport**.
- **Audience:** activated users; suppress if no fixtures in followed sports today.
- **Priority:** P1. **Cap:** 1/day (owns the morning slot).
- **Personalization:** `marqueeFixture` = biggest fixture today (favourite club fixture first, else top league/club).
- **Copy (B):** **"{marqueeFixture} headlines today's card"** — *"Make your picks now before kickoff."*
- **Deep link:** `sportime://matches`
- **Backend:** ✅ `sync-fixtures-daily`. 🛠 per-user AM scan + marquee picker. **`notify`:** `notifKey:"DE-1", category:"daily", priority:1, type:"reminder"`.

### DE-2 — Haven't picked yet (push)
- **Objective:** catch the user who opened nothing today, before lines lock.
- **Channel:** **Push.**
- **Trigger:** **18:00–19:30 local**, fixtures today exist **AND user has 0 picks today**. *(Skip entirely if they've already picked anything today.)*
- **Audience:** activated users, 0 picks today.
- **Priority:** P1. **Cap:** uses the evening slot (counts in daily cap).
- **Copy:** **"Matches kick off soon ⏳"** — *"You haven't made a pick today. Get your predictions in before the lines lock."*
- **Deep link:** `sportime://matches`
- **Backend:** 🛠 evening scan: `pending_picks_today == 0` & fixtures exist. **`notify`:** `notifKey:"DE-2", priority:1, type:"reminder"`.

### DE-3 — Free spin ready (push)
- **Objective:** light reward hook to pull a return visit.
- **Channel:** **Push.**
- **Trigger:** free daily spin available & unused.
- **Audience:** users with `spins_available=true`.
- **Priority:** P1 (low). **Cap:** 1/day, **yields** to DE-1/DE-2/MC-4 (only fills a spare slot).
- **Copy:** **"Your free spin is ready 🎡"** — *"Spin for coins and tickets. Resets every day."*
- **Deep link:** `sportime://spin/free`
- **Backend:** 🛠 spin-state scan. **`notify`:** `notifKey:"DE-3", category:"rewards", priority:1, type:"gameplay"`.

---

## MATCH TOUCHPOINTS

### MC-1 — Kickoff reminder — **favourite club only** (push)
- **Objective:** high-relevance reminder around the team the user cares about (kept narrow to avoid fatigue).
- **Channel:** **Push.**
- **Trigger:** **T-60min** before a fixture involving the user's **favourite club** (`favorite_club` set). Per-fixture dedup.
- **Audience:** users with a favourite club playing.
- **Priority:** **P0 if they've picked** that match (stake reminder), **P1 if not** (pick nudge).
- **Copy (not picked):** **"{FavClub} kick off in 1 hour ⚽"** — *"Make your pick before the whistle."*
- **Copy (picked):** **"{FavClub} vs {Opp} in 1 hour ⏰"** — *"Your pick: {Pick}. Tap to follow it live."*
- **Deep link:** `sportime://match/{fixtureId}`
- **Backend:** 🛠 fixture scheduler keyed on `favorite_club` (uses `sync-fixture-schedules`). **`notify`:** `notifKey:"MC-1", category:"matches", priority:0|1, type:"gameplay", dedupKey:"MC-1:fixture:{id}"`.

### MC-3 — Pick settled (push, digested)
- **Objective:** the result payoff — the heartbeat of the loop.
- **Channel:** **Push** (+ in-app feed). **Digested** when several settle together.
- **Trigger:** `settle-match-bets` resolves a user bet (win/lose). *(First win → AC-2 instead.)*
- **Audience:** users with a freshly settled bet.
- **Priority:** P0. **Bundle:** `settle:{userId}:{date}`.
- **Copy (win):** **"Your pick won 🎉 +{amount} coins"** — *"{Pick} came through. See your results."*
- **Copy (loss):** **"Your pick didn't land this time"** — *"{TeamA} {scoreA}–{scoreB} {TeamB}. New matches are up — bounce back."*
- **Copy (digest ≥2):** **"3 of your picks settled · +1,240 coins 🎉"**
- **Deep link:** `sportime://finished`
- **Backend:** ✅ `settle-match-bets`. 🛠 notify hook + digest. **`notify`:** `notifKey:"MC-3", priority:0, type:"gameplay", bundleKey:"settle:{userId}:{date}"`.

### MC-4 — Results digest — **wins only, no tomorrow pick** (push)
- **Objective:** end the day on a high **and** pull the user to pick tomorrow (only when there's a reason to bring them back).
- **Channel:** **Push.**
- **Trigger:** **~21:00 local**, the day had **≥1 win**, **AND** the user has **not picked any of tomorrow's matches**.
- **Audience:** users who won today & have no tomorrow picks. *(Skip if no wins, or if tomorrow already picked.)*
- **Priority:** P1. **Cap:** 1/day (evening slot, after DE-2).
- **Copy:** **"You won {wonCount} pick{s} today 🎉 +{net} coins"** — *"Tomorrow's matches are up — line up your next picks."*
- **Deep link:** `sportime://matches`
- **Backend:** 🛠 EOD scan: `wins_today ≥ 1` & `tomorrow_picks == 0`. **`notify`:** `notifKey:"MC-4", category:"matches", priority:1, type:"gameplay"`.

---

## Backend work for Phase 2
| # | Item | Reuses |
|---|---|---|
| P2-1 | First-pick in-app confirmation (client) | — |
| P2-2 | Settlement notify hook + **first-win detection** (AC-2 supersedes MC-3) | B6, settle-match-bets |
| P2-3 | Daily per-user scan job (AM DE-1 / eve DE-2 / spin DE-3 / EOD MC-4) | tags B5 |
| P2-4 | Marquee-fixture picker (DE-1) | favourite_club + leagues |
| P2-5 | Favourite-club kickoff scheduler (MC-1) | B7 scheduler + sync-fixture-schedules |
| P2-6 | Settlement digest (bundleKey) | B2 orchestrator |
| P2-7 | "tomorrow_picks == 0" + "wins_today" computation (MC-4) | match_bets |

## Suppression & arbitration summary
- **DE-2** never fires if the user picked anything today.
- **MC-4** never fires without a win, or if tomorrow is already picked.
- **DE-3** only fills a spare slot (lowest of the P1 group).
- **AC-2** replaces **MC-3** on the first win.
- **MC-1** is the *only* per-match kickoff push, and only for the favourite club.
- Global: **max 2 marketing pushes/day**, quiet hours 22:00–08:00 local, all settlements digested.

---

## Validated decisions carried in (from Phase 1 review)
DE-1 = Copy B ✅ · DE-2 = only if 0 picks today ✅ · DE-4 streak = removed ✅ · MC-1 = favourite club only ✅ · MC-4 = wins only + no tomorrow pick ✅ · AC-1/AC-2/DE-3/MC-3 = as specified ✅
