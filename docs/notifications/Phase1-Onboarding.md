# Phase 1 — ONBOARDING (full spec)

> Copy: **English only** (for now). Goal: get the user to **first pick → first game** fast, without a cold push at signup.
> Channel rule: **in-session = in-app (IAM)**, **bring-back = push**. Push lifecycle only starts once the user has left the app.

## Onboarding journey (D0 → D1)

| Step | Channel | When | Purpose |
|---|---|---|---|
| ON-1 Welcome + push primer | **In-app (IAM)** | Signup, in session | Orient + earn the push opt-in |
| **ON-SP Sports you follow** | **In-app step** | Signup, after ON-1 | Seed `follows_football/f1` → powers DE-1 + gates ON-FAV |
| **ON-FAV Favourites (by sport)** | **In-app step** | Signup, after ON-SP | Football→club · F1→pilot+team → powers MC-1 + DE-1 |
| ON-T Free amateur tickets | **In-app card** (+ backend grant) | Signup | Remove the "I have nothing to play with" barrier |
| ON-LG Live Games intro | **In-app (IAM)** | First Games view / D0 in session | Showcase the live formats |
| ON-2 First pick | **Push** | D0 +2–3h, no pick | First bring-back → first pick |
| ON-3 Welcome coins | **Push** | D0 evening, coins unspent | Reinforce currency value |
| ON-4 Join first game | **Push** | D1 morning, no game joined | Move from picks → games |

---

## ON-1 — Welcome (in-app) + push permission primer
- **Objective:** orient the new user and **convert the push opt-in** at the right moment.
- **Channel:** In-app (OneSignal IAM or native welcome modal). **No push.**
- **Trigger:** first authenticated session after signup (`auth = authenticated` & `days_since_install = 0`, once).
- **Audience:** new users.
- **Priority / cap:** n/a (in-app, once).
- **Flow:** Welcome message → CTA "Make a pick" → **only after** a value beat, show the **push primer** ("Get match reminders & instant results?") → on Yes, fire `OneSignal.Notifications.requestPermission()`.
- **Copy:** **"Welcome to Sportime ⚽"** — *"Predict matches, join games, climb leaderboards. Let's make your first pick."*
- **Primer copy:** **"Never miss kickoff or a result"** — *"Turn on notifications for match reminders and instant pick results."* [Allow] [Not now]
- **Deep link / CTA:** `sportime://matches`
- **Backend:** none. **OneSignal:** IAM triggered by tag `onboarding_step = welcome`; permission requested from the primer, not cold.

## ON-SP — Sports you follow (in-app)
- **Objective:** capture which universes the user follows → personalizes the whole lifecycle (DE-1 only fires for followed sports) and gates the favourites step.
- **Channel:** In-app onboarding step. **No push.**
- **Trigger:** right after ON-1 welcome (once). Default both pre-selected; user can deselect.
- **Audience:** new users.
- **Copy:** **"Which sports do you follow?"** — *"We'll tailor your matches, games and reminders to what you love."* → **[⚽ Football] [🏎️ Formula 1]** (multi-select, ≥1 required).
- **Writes:** `users.sports` → tags `follows_football`, `follows_f1`.
- **Backend:** reuse the existing `sports` column + settings selector logic (already built). UI: onboarding step.

## ON-FAV — Favourites, by selected sport (in-app)
- **Objective:** seed favourites early → unlocks high-relevance **MC-1** (fav-club kickoff) and personalizes **DE-1** marquee. Also pre-fills Fan Pulse.
- **Channel:** In-app onboarding step. **No push.** Skippable.
- **Trigger:** after ON-SP. **Shown conditionally on the sports selected:**
  - Football selected → **Favourite club** picker.
  - F1 selected → **Favourite pilot + Favourite team** pickers.
  - Both → both blocks.
- **Audience:** new users (per followed sport).
- **Copy (football):** **"Who's your club?"** — *"Pick your team for personalized match reminders and a daily brief built around them."* [Search club] [Skip]
- **Copy (F1):** **"Your F1 favourites"** — *"Pick your driver and team to follow them all season."* [Pick pilot] [Pick team] [Skip]
- **Writes:** `users.favorite_club` (tag `favorite_club`); `users.favorite_f1_driver` / `favorite_f1_constructor` (tags). 
- **Backend:** reuse `fanPulseService.setFavoriteClub` + `f1FanService.setFavouriteDriver/Constructor` (already built) + their club/driver/constructor pickers. UI: onboarding step(s).
- **Why it matters:** MC-1 reach was previously gated on Fan Pulse adoption; seeding it here lifts coverage of MC-1 **and** DE-1 marquee relevance.

## ON-T — Free amateur tickets (in-app + grant)
- **Objective:** remove the entry barrier — give something to play games with immediately.
- **Channel:** In-app card in the welcome flow (and visible in Wallet). Optional D0 push only if unused.
- **Trigger:** account created → **backend grants N amateur tickets** (reco **3**).
- **Audience:** new users (once).
- **Copy:** **"3 free amateur tickets, on us 🎟️"** — *"Use them to try Pick'em, Fantasy, Predictions and Tournament Quests — no coins needed."*
- **Deep link / CTA:** `sportime://games`
- **Backend:** 🛠 grant 3 amateur tickets on signup (in the user-creation / first-auth path; idempotent, once per user). **OneSignal:** none (in-app); optional push variant via `notify` if `tickets_total>0` & not used by D0 eve.

## ON-LG — Live Games intro (in-app)
- **Objective:** showcase the **Live Games** formats (Match Royale, Live Fantasy, Live Score) — the most engaging, real-time hook.
- **Channel:** In-app (IAM). **No push.**
- **Trigger:** first time the user opens **Games**, OR D0 in-session if not seen (once).
- **Audience:** new users.
- **Copy:** **"Try Live Games ⚡"** — *"Play along while the match is on — Match Royale & Live Fantasy update in real time. Jump into one tonight."*
- **Deep link / CTA:** `sportime://games` (Live tab)
- **Backend:** none. **OneSignal:** IAM triggered by tag `onboarding_step = games_seen` or event `viewed_games`.

## ON-2 — Make your first pick (push)
- **Objective:** first bring-back → first pick (the #1 activation milestone).
- **Channel:** **Push.**
- **Trigger:** D0 **+2–3h** after signup **if no pick placed** (suppress if `has_pending_pick`). Respect quiet hours → hold to next active window.
- **Audience:** new users, 0 picks.
- **Priority:** P1. **Cap:** once. **Pref type:** `system`.
- **Personalization — fixture choice (in order):** ① user's **favourite club**'s next fixture if set → ② else a fixture featuring a **popular team** (top European clubs / marquee league) kicking off soon → ③ else today's highest-profile fixture.
- **Copy (B, validated):** **"Don't miss out 🎯"** — *"Pick {PopularTeamA} vs {TeamB} before kickoff and start your run."*
- **Deep link:** `sportime://match/{fixtureId}`
- **Backend:** 🛠 onboarding scheduler + **popular-team fixture picker** (favourite_club → marquee fixture fallback). **OneSignal `notify` payload:**
```json
{ "userId":"{id}", "notifKey":"ON-2", "category":"onboarding", "priority":1,
  "title":"Don't miss out 🎯",
  "message":"Pick {PopularTeamA} vs {TeamB} before kickoff and start your run.",
  "route":"sportime://match/{fixtureId}", "dedupKey":"ON-2:{id}" }
```

## ON-3 — Welcome coins (push)
- **Objective:** reinforce the coin economy and nudge a first spend.
- **Channel:** **Push.**
- **Trigger:** D0 **evening** if welcome coins **still unspent**.
- **Audience:** new users, coins unspent.
- **Priority:** P2. **Cap:** once. **Pref type:** `gameplay`.
- **Copy:** **"You've got {N} coins to play 🪙"** — *"Spend them on picks, games and competitions. Your first prediction is the best place to start."*
- **Deep link:** `sportime://matches`
- **Backend:** 🛠 check welcome coins unspent (coins_balance == starting grant & no bets). **`notify` payload:** `notifKey:"ON-3", priority:2, type:"gameplay"`.

## ON-4 — Join your first game (push)
- **Objective:** move from single picks → joining a **game** (deeper retention surface).
- **Channel:** **Push.**
- **Trigger:** D1 **morning** if **no game joined** (no `game_joined`).
- **Audience:** new users, 0 games joined.
- **Priority:** P1. **Cap:** once. **Pref type:** `gameplay`.
- **Games (correct list):** **Pick'em, Fantasy, Predictions, Tournament Quests.**
- **Copy:** **"Join your first game 🏆"** — *"Pick'em, Fantasy, Predictions & Tournament Quests — play with your free tickets and climb the leaderboard."*
- **Deep link:** `sportime://games`
- **Backend:** ✅ `game_joined` exists (suppression). 🛠 scheduler. **`notify` payload:** `notifKey:"ON-4", priority:1, type:"gameplay"`.

---

## Backend work for Onboarding
| # | Item | Notes |
|---|---|---|
| O1 | **Signup grant: welcome coins + 1000 bonus coins + 3 amateur tickets** | idempotent, once/user; in user-creation path. (No premium trial — this is the new-user value package.) |
| O2 | **Onboarding scheduler** (D0+2h, D0 eve, D1 AM state machine) | drives ON-2/3/4 with suppression checks |
| O3 | **Popular-team fixture picker** | favourite_club → marquee fixture fallback (for ON-2) |
| O4 | **3 IAMs in OneSignal** | ON-1 welcome+primer, ON-T tickets (optional), ON-LG live games |
| O5 | Suppression signals | `has_pending_pick`, coins-unspent, `game_joined` (tags from B5) |
| O6 | **Onboarding steps: sports (ON-SP) + favourites (ON-FAV)** | reuse `sports` selector, `setFavoriteClub`, `f1FanService` pickers; conditional on sports chosen |

---

## Decisions locked for LATER phases (captured, not built yet)
- **DE-1** → use **Copy B**.
- **DE-2** → only if the user has **0 picks today** (skip entirely if they've already picked).
- **DE-4 Streak at risk** → **REMOVED** (no streak concept in product). Drops streak engine (B8) + `streak_*` tags from scope.
- **MC-1 Kickoff reminder** → **favourite club only** (not every picked match — avoids fatigue).
- **MC-4 Daily results digest** → **wins only**, and **only if the user has not picked any of tomorrow's matches** (re-engagement toward tomorrow).
- **AC-1, AC-2, DE-3, MC-3** → as specified.
