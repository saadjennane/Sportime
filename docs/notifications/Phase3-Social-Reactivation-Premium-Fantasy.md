# Phase 3 — SOCIAL · REACTIVATION · PREMIUM · FANTASY (full spec)

> Copy: **English only**. All routed through the `notify` orchestrator.
> Gating: Fantasy → `fantasy_active` only · Premium upsell → **suppressed for `is_premium`** · Reactivation → dormant segments (outside the daily cap since the user is inactive) · Social → ≤1/day.

---

## 6 — SOCIAL (squads / leagues)

### SO-1 — Squad invite received (push) · P0 · ✅ MVP
- **Objective:** convert an invite into a join (network effect = retention multiplier).
- **Trigger:** invite created for the user. **Audience:** invited user. **Cap:** per-invite.
- **Copy:** **"{Inviter} invited you to {Squad} 🤝"** — *"Join the squad and battle on a private leaderboard."*
- **Deep link:** `sportime://league/join/{code}` · **Backend:** 🛠 invite hook (masterpass path exists).

### SO-5 — Masterpass challenge (push) · P1 · ✅ exists
- **Objective:** friend-to-friend challenge (the +1 invite).
- **Trigger:** masterpass invite. **Copy:** **"{Friend} challenged you 🎯"** — *"Accept the Masterpass and play together."*
- **Deep link:** `sportime://masterpass/{token}` · **Backend:** ✅ (claim flow exists).

### SO-2 — Friend joined your squad (push) · P1
- **Objective:** social proof + reciprocity.
- **Trigger:** new member joins a squad the user is in. **Cap:** ≤1/day (batched if several).
- **Copy:** **"{Friend} joined {Squad} 👀"** — *"Your squad's growing. See who's in."*
- **Deep link:** `sportime://squad/{id}` · **Backend:** 🛠 membership hook.

### SO-3 — Someone overtook you (push) · P1
- **Objective:** rivalry = the strongest league retention lever (FPL playbook).
- **Trigger:** a squadmate passes the user on a leaderboard of any **squad-linkable game** — the **4 formats: Pick'em, Fantasy, Predictions, Tournament Quests.** **Cap:** ≤1/day.
- **Copy:** **"{Rival} just passed you 📉"** — *"You dropped to #{rank} in {Game}. Take it back."*
- **Deep link:** `sportime://leaderboard/{gameId}` · **Backend:** 🛠 rank-snapshot diff per joined game (all 4 squad-linkable formats).

### SO-4 — Squad weekly digest (push) · P2
- **Objective:** keep the squad alive between events.
- **Trigger:** weekly (active squad). **Cap:** 1/week.
- **Copy:** **"Your squad this week 📊"** — *"{topMember} leads {Squad} · {N} games played. Where do you rank?"*
- **Deep link:** `sportime://squad/{id}` · **Backend:** 🛠 weekly squad aggregate.

### SO-6 — Head-to-head result (push) · P2
- **Objective:** settle friendly rivalries → re-engagement.
- **Trigger:** settlement where a squadmate also played (any of the 4 squad-linkable formats). **Cap:** ≤1/day.
- **Copy (win):** **"You beat {Friend} 🏆"** — *"See the head-to-head."* · **(loss):** *"{Friend} edged you this round — get them back."*
- **Deep link:** `sportime://leaderboard/{gameId}` · **Backend:** 🛠 H2H compare on settle.

---

## 9 — REACTIVATION (dormant ladder)

> Escalating incentive, **decreasing** frequency. One send per stage, stop on any open. Sent to dormant segments (B10), so outside the active daily cap.

### RE-1 — Day-3 nudge (push) · P1 · ✅ MVP
- **Trigger:** no app open for 3 days. **Copy:** **"{marqueeFixture} is coming up ⚽"** — *"Big matches on Sportime. Jump back in and pick."*
- **Deep link:** `sportime://matches` · **Backend:** 🛠 dormancy cron (B10).

### RE-2 — Day-7 win-back + incentive (push) · P0 · ✅ MVP
- **Objective:** the highest-ROI reactivation moment — lead with a **free reward**.
- **Trigger:** no open for 7 days. **Incentive:** grant a **free spin** (or coins) on send.
- **Copy:** **"We saved you a free spin 🎁"** — *"Come back and spin for coins & tickets — it's waiting."*
- **Deep link:** `sportime://spin/free` · **Backend:** 🛠 B10 + incentive grant.

### RE-3 — Day-14 social pull (push) · P1
- **Trigger:** no open 14 days. **Copy (in squad):** **"Your squad misses you 👀"** — *"{Squad} played {N} games without you. The leaderboard moved."* **(solo):** *"You've still got {N} coins waiting — come pick today's matches."*
- **Deep link:** `sportime://squads` (or `…/matches`) · **Backend:** 🛠 B10.

### RE-4 — Day-30 big-event hook (push) · P1
- **Trigger:** no open 30 days **AND** a marquee fixture/event is on. **Copy:** **"{BigEvent} is here 🔥"** — *"Don't miss {marqueeFixture}. Your account's ready."*
- **Deep link:** `sportime://matches` · **Backend:** 🛠 B10 + event calendar.

### RE-5 — Day-60/90 last chance (push) · P2
- **Trigger:** no open 60–90 days. **Copy:** **"Still {N} coins waiting for you 🪙"** — *"Come back and play — your account's ready when you are."*
- **Deep link:** `sportime://matches` · **Backend:** 🛠 B10. (Churned ≥90d → holdout / suppress.)

---

## 8 — PREMIUM (Sportime+)

> **Hard-suppress all upsell (PR-1/2/6/7) for `is_premium=true`.** Dunning/trial (PR-3/4) are P0 revenue-critical.

### PR-1 — Upsell at engagement peak (push) · P1
- **Trigger:** `Premium Eligible` (Core Daily, non-sub) hits a value moment (bet-limit reached / big win / heavy day). **Cap:** ≤2/week.
- **Copy:** **"Unlock Sportime+ ⭐"** — *"You're on a roll — bigger limits, exclusive games and more. See what's inside."*
- **Deep link:** `sportime://premium` · **Backend:** 🛠 value-moment detector.

### PR-2 — Paywall hit (in-app/push) · P1
- **Trigger:** non-sub taps a premium-gated action (client). **Channel:** in-app first, push fallback.
- **Copy:** **"That's a Sportime+ perk 🔓"** — *"Upgrade to unlock {feature}."* · **Deep link:** `sportime://premium` · **Backend:** 🛠 client hook.

### PR-3 — ~~Trial ending~~ — **REMOVED**
- **No free trial** for Sportime+. New-user value comes from the **signup grant** instead (welcome coins **+ 1000 bonus coins + 3 amateur tickets** — see Onboarding O1). No trial-expiry notification.

### PR-4 — Payment failed / dunning (push) · P0
- **Trigger:** RevenueCat billing issue. **Copy:** **"Action needed: update your payment 💳"** — *"We couldn't renew Sportime+. Fix it to keep your perks."*
- **Deep link:** `sportime://premium` · **Backend:** ✅ webhook 🛠 hook. (Send up to 3× over the grace window.)

### PR-5 — Subscription renewed (push) · P2
- **Trigger:** renewal. **Copy:** **"Sportime+ renewed ⭐ Thanks!"** — *"Your perks roll on."* · **Deep link:** `sportime://profile`.

### PR-6 — Win-back expired premium (push) · P1
- **Trigger:** churned sub +14d. **Copy:** **"Come back to Sportime+ ⭐"** — *"A special offer to reactivate your perks."* · **Deep link:** `sportime://premium`.

### PR-7 — Perk reminder (push) · P2
- **Trigger:** sub hasn't used a key perk in 14d. **Copy:** **"You're not using your Sportime+ perks"** — *"{perk} is included — make the most of it."*

---

## 5 — FANTASY (gated to `fantasy_active`)

> Deadline reminders are the #1 fantasy retention mechanic. Keep them tight: one soft (T-24h) + one hard (T-3h or T-1h).

### FA-1 — Set your lineup, deadline T-24h (push) · P1
- **Trigger:** gameweek deadline −24h, lineup empty/incomplete. **Copy:** **"Set your lineup — deadline in 24h 📋"** — *"{Gameweek} locks soon. Pick your team."*
- **Deep link:** `sportime://fantasy/{gameId}` · **Backend:** 🛠 deadline scheduler (B7).

### FA-2 — Deadline T-3h (push) · P0
- **Trigger:** deadline −3h, lineup not set. **Copy:** **"⏰ Deadline in 3 hours — lineup not set"** — *"Lock your team before {Gameweek} starts."*
- **Deep link:** `sportime://fantasy/{gameId}` · **Backend:** 🛠 scheduler. **P0** (time-critical), dedup per gameweek.

### FA-3 — Captain not set (push) · P1
- **Trigger:** deadline −3h, no captain. **Copy:** **"Pick your captain ©️"** — *"Your captain scores double. Don't leave it empty."* · **Deep link:** `sportime://fantasy/{gameId}`.

### FA-4 — Live: your team is scoring (push) · P2 · opt-in
- **Trigger:** first points event during the gameweek (opt-in only). **Copy:** **"Your team is scoring 🔥 +{pts}"** — *"{Player} just delivered. Watch it live."* · **Deep link:** `sportime://fantasy/{gameId}`. **Backend:** ✅ live-tick 🛠 hook (capped, opt-in).

### FA-5 — Gameweek results (push) · P0
- **Trigger:** `settle-fantasy-gameweeks`. **Copy:** **"{Gameweek} results are in 📊"** — *"You scored {pts} pts · finished #{rank}. See the breakdown."*
- **Deep link:** `sportime://fantasy/{gameId}` · **Backend:** ✅ cron 🛠 hook.

### FA-6 — Injury alert (push) · P2
- **Trigger:** injury to a player the user owns, before deadline. **Copy:** **"⚠️ {Player} is out"** — *"He's in your team. Make a change before the deadline."* · **Deep link:** `sportime://fantasy/{gameId}` · **Backend:** ✅ `sync-injuries` 🛠 hook.

### FA-7 — F1 Live Fantasy lineups published (push) · P1 · ✅ trigger
- **Trigger:** `lf-autocreate` fires for a GP the user opted into (`lf_notify`). **Copy:** **"F1 lineups are out 🏎️"** — *"Build your Live Fantasy team for {GP}."*
- **Deep link:** `sportime://live/{id}` · **Backend:** ✅ `lf-autocreate` + `lf_notify` 🛠 hook.

---

## Backend work for Phase 3
| # | Item | Reuses |
|---|---|---|
| P3-1 | **Dormancy cron (B10)** + reactivation incentive grant (RE-2) | last_active_at, spins |
| P3-2 | **Premium lifecycle hooks (B11)** in `revenuecat-webhook` (PR-3/4/5/6) | RevenueCat |
| P3-3 | **Leaderboard rank snapshots** (SO-3/SO-6 rivalry) | joined games |
| P3-4 | **Squad invite/join hooks** (SO-1/SO-2) + weekly digest (SO-4) | squad_members |
| P3-5 | **Fantasy deadline scheduler** (FA-1/2/3) | B7 + gameweek deadlines |
| P3-6 | **Fantasy settle/injury/LF hooks** (FA-5/6/7) | settle-fantasy-gameweeks, sync-injuries, lf-autocreate |
| P3-7 | **Premium value-moment + paywall detectors** (PR-1/2) | client + limits |

## Resolved decisions (locked)
1. **No Sportime+ free trial** → PR-3 removed. New-user value = signup grant (welcome coins **+ 1000 bonus coins + 3 amateur tickets**, Onboarding O1).
2. **RE-2 (D7) incentive = free spin.** ✅
3. **SO-3 / SO-6 rivalry = all 4 squad-linkable formats** (Pick'em, Fantasy, Predictions, Tournament Quests).
4. **FA-2 hard reminder = T-3h.** ✅
