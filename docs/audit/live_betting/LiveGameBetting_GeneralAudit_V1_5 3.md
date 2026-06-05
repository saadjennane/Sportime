# Live Game (Betting Mode) – General Audit V1.5

**Audit Date:** 2025-07-31  
**Auditor:** Dualite Alpha  
**Objective:** To perform a complete technical and functional audit of the "Live Game (Betting Mode)" feature after the Market Engine V1.5 upgrade, verifying its core mechanics, scoring, and synchronization logic.

---

### Functional Summary

**Status: Fully Functional**

The user flow for the Betting Mode is complete and logical:
1.  An **admin** creates a "Live Game" from within a league, selecting the **Betting Mode** and an upcoming match.
2.  League members can join the game before it starts, receiving an initial **1000 pre-match coins**. They can place bets on a set of pre-match markets.
3.  Once the match kicks off (simulated), the game transitions to **live mode**. Players receive a separate **1000 live coins**.
4.  During the match, a **scheduler** automatically generates and expires a series of dynamic, time-limited markets. All players see the same market at the same time.
5.  Players can bet their live coins on these markets. When a market is resolved, gains are calculated and added to their `total_gain`.
6.  At the end of the match, the player with the highest `total_gain` wins. The final leaderboard is displayed, and the admin has the option to **"Celebrate Winners"**, which creates a post in the league feed.

---

### Architecture Overview

**Status: Fully Functional**

The architecture is centralized within a **Zustand global store (`useMockStore.ts`)**, which is an excellent approach for this mock-data MVP as it ensures state consistency across all components.

-   **State Management:** All game states, including player balances, active markets, and match progress, are held within the `liveGames` array in the store.
-   **Scheduler:** The `tickLiveGame` action in the store functions as the central scheduler. It is called by the frontend (`LiveGameBettingPlayPage.tsx`) via a `setInterval` every 5 seconds. This function is responsible for all state changes during a live game.
-   **Engine Logic:** The logic for market generation, EmotionFactor calculation, and payout is currently implemented directly within the `tickLiveGame` function. While a separate `marketEngine.ts` was proposed, the current implementation is self-contained and clear.
-   **Data Models:** The types defined in `src/types/index.ts` (e.g., `LiveGame`, `LiveGameMarket`, `LiveBet`, `LiveGamePlayerEntry`) are consistent and correctly support the feature's logic, including properties for tie-breaking (`last_gain_time`).

---

### Market Engine Dynamics

**Status: Fully Functional**

The market engine correctly implements the dynamic and narrative-driven logic specified.

-   **Market Generation:** The `tickLiveGame` function successfully simulates match progression (minute and score). At each tick, it evaluates a set of time-based and event-based triggers.
-   **Template Usage:** When a trigger condition is met and no other market is active, it selects a suitable template from `src/data/marketTemplates.ts` and instantiates a new `LiveGameMarket`.
-   **Synchronization:** Because all logic is centralized in the store, all players are guaranteed to see the same market at the same time, with the same expiration.
-   **Market Rotation:** Markets are correctly generated one at a time. Expired markets are resolved, and the system waits for the next trigger, preventing market overlap.

---

### EmotionFactor Evaluation

**Status: Fully Functional**

The EmotionFactor logic is implemented correctly within the `tickLiveGame` function and influences the odds as designed.

-   **Contextual Calculation:** The `emotionFactor` variable is recalculated on each tick based on the current `simulated_minute` and score difference.
-   **Validation:** The logic matches the specified rules:
    -   `> 70'` and draw score: `emotionFactor = 1.3`
    -   `> 80'`: `emotionFactor = 1.4`
    -   Losing by 2+ goals: `emotionFactor = 0.8`
-   **Odds Application:** The generated market odds are correctly calculated as `adjusted = base_odd * emotion_factor`, creating dynamic and contextually relevant betting opportunities.

---

### Leaderboard & Results

**Status: Fully Functional**

The leaderboard and results pages function correctly and include all required features.

-   **Scoring:** Player gains are correctly calculated as `bet.amount * adjustedOdds` upon market resolution. The `total_gain` is accurately accumulated in the player's state.
-   **Ranking & Tie-Breaking:** The leaderboards on both the live play page and the results page correctly sort players using the specified criteria:
    1.  `total_gain` (descending)
    2.  `last_gain_time` (ascending)
    3.  `player_name` (alphabetical as a final fallback)
-   **Celebrate Winners:** The "Celebrate Winners" button is correctly displayed **only to admins** on the `LiveGameBettingResultsPage.tsx`. It successfully triggers the celebration flow, creating a post in the league's feed.

---

### Edge Cases & Discrepancies

**Status: Fully Functional**

The system handles expected edge cases gracefully.

-   **No Available Templates:** If no trigger conditions are met, no new market is generated, and the system correctly waits for the next tick. This is the expected behavior.
-   **Market Expiration:** The scheduler correctly identifies expired markets, resolves them, and updates player gains before attempting to generate a new market.
-   **Discrepancy:** The only minor discrepancy from the original design prompts is architectural. The `marketEngine` and `emotionEngine` logic reside within `useMockStore.ts` instead of separate files. For an MVP of this scale, this is an acceptable and even pragmatic choice, as it keeps related logic co-located. It does not affect functionality.

---

### Conclusion

**Live Game (Betting Mode) – Market Engine V1.5 is Fully Functional.**

The implementation successfully meets all the requirements of the V1.5 upgrade. The market engine is dynamic, the EmotionFactor adjusts odds contextually, player synchronization is stable, and the scoring and leaderboard logic, including tie-breakers, are correctly implemented. The feature is now MVP-complete and ready for formal documentation and future integration with live APIs.
