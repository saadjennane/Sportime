# Live Game (Betting Mode) – Technical & Functional Audit Report

**Audit Date:** 2025-07-31

**Objective:** This document provides a comprehensive audit of the "Live Game (Betting Mode)" feature as implemented in the current codebase. The goal is to verify that its core mechanics, scoring logic, and architecture are consistent with the intended design.

---

### 🧠 Functional Summary

The user flow for the Betting Mode is as follows:

1.  **Game Creation:** A league admin initiates the creation of a "Live Game" from within a league and selects "Betting Mode" from the setup modal.
2.  **Pre-Match Phase:** Before the match starts, players can access the game's setup page. They are allocated an initial **1,000 coins** for this phase and can place bets on a set of pre-match markets (e.g., "First Goal Scorer").
3.  **Live Phase:** Once the match begins (simulated by the scheduler), the pre-match markets close. Players are allocated a separate **1,000 coins** for the live phase.
4.  **Live Betting:** During the match, a centralized scheduler triggers new, time-limited markets based on simulated match events (time elapsed, goals scored). All players see the same market at the same time and can place bets using their live balance.
5.  **Scoring & Ranking:** When a bet is won, the gain (`amount * odds`) is added to the player's `total_gain`. The leaderboard ranks players based on this cumulative gain. Unspent coins from either phase are lost.
6.  **Results:** After the match finishes, a final leaderboard is displayed, showing the total gains for each participant.

---

### 🏛️ Architecture Overview

The feature is architecturally consistent with the rest of the application, relying on a centralized state management pattern.

-   **State Management (`useMockStore.ts`):** The Zustand store is the single source of truth. It holds the `liveGames` array and contains all the core actions:
    -   `createLiveGame`: Correctly instantiates a game with `mode: 'betting'`.
    -   `placeLiveBet`: Handles the logic for placing a bet, deducting from the correct balance (`pre_match_balance` or `live_balance`) based on the game's status.
    -   `tickLiveGame`: Acts as the **centralized backend scheduler**. It simulates match progress, triggers new markets, and resolves expired ones.

-   **Frontend Components (`/pages/live-game/betting/`):** The UI is composed of three main pages that react to changes in the store:
    -   `LiveGameBettingSetupPage.tsx`: Displays pre-match markets.
    -   `LiveGameBettingPlayPage.tsx`: Displays the live score, player balances, and the currently active market.
    -   `LiveGameBettingResultsPage.tsx`: Displays the final results and leaderboard.

-   **Data Structures (`/types/index.ts`):** The data model is well-defined, with distinct types for `LiveGame`, `LiveGameMarket`, `LiveBet`, and a `betting_state` object within `LiveGamePlayerEntry` to manage balances and bets.

---

### 🧮 Scoring & Payout Logic

The scoring system is based purely on coin gain.

-   **Coin Balances:** Each player has two separate, non-transferable balances stored in `player.betting_state`:
    -   `pre_match_balance`: 1,000 coins, used for markets where `minute === 0`.
    -   `live_balance`: 1,000 coins, used for all markets where `minute > 0`.
-   **Bet Placement:** The `placeLiveBet` action correctly identifies the phase (`pre-match` or `live`) and deducts the bet amount from the corresponding balance.
-   **Payout Calculation:** Winnings are calculated within the `tickLiveGame` function when a market is resolved. The logic correctly calculates `gain = bet.amount * bet.odds` for winning bets. This gain is added to the player's `total_gain`. For losing bets, the gain is 0.
-   **Unspent Coins:** There is no logic to refund or carry over unspent coins. They are implicitly lost at the end of each phase, which matches the specification.
-   **Leaderboard Ranking:** The leaderboard is correctly sorted in descending order based on `player.betting_state.total_gain`.

---

### ⚙️ Market Triggering Mechanism

The system uses a mock scheduler (`tickLiveGame`) that simulates a live match environment.

-   **Scheduler:** The `tickLiveGame` function increments a `simulated_minute` counter. This function is designed to be called periodically (e.g., by a `setInterval` in the UI) to drive the game forward.
-   **Triggers:** The scheduler uses a combination of time-based and event-based triggers that are currently hardcoded within the simulation:
    -   **Time-based:** Markets are generated at specific minutes (e.g., `if (newMinute === 10)`).
    -   **Event-based:** The simulation includes hardcoded score changes (e.g., a goal at minute 25), which then trigger corresponding markets (e.g., "Will the losing team equalize?").
-   **Synchronization:** Because all logic resides within the central store, all players are guaranteed to see the same market at the same time.
-   **EmotionFactor:** The `EmotionFactor` is calculated at each tick based on the current match state (score, minute) and is correctly applied to the base odds when a new market is generated, creating dynamic odds.
-   **Market Expiration:** Each market is created with an `expires_at` timestamp. The scheduler is responsible for checking this timestamp and closing expired markets.

---

### 🧱 Frontend Behavior

The UI components correctly reflect the state of the game engine.

-   **Mode Selection:** The `LiveGameSetupModal` correctly offers "Prediction" and "Betting" modes, and the choice is passed to the creation logic.
-   **Balance Display:** The `LiveBettingPlayerStatus` component accurately displays the separate pre-match and live balances, as well as the total gain.
-   **Live Markets:** The `LiveBettingMarketCard` component displays the active market with its options, odds, and an active countdown timer. Once a bet is placed, the card updates to a "Bet Placed" state.
-   **Leaderboard:** The leaderboard on the `LiveGameBettingPlayPage` updates reactively as market results are processed and player gains change.

---

### 🧩 Edge Cases & Discrepancies

The core functionality is well-implemented, but some edge cases and minor features are not yet addressed.

-   **Missing Tie-Breaks:** The leaderboard sorting logic does not currently implement any tie-breaking rules. If two players have the same `total_gain`, their relative order is not guaranteed.
-   **No "Celebrate Winners" Button:** The "Celebrate Winners" functionality, which exists for other game modes, has not yet been added to the `LiveGameBettingResultsPage`.
-   **Limited Market Variety:** The number and variety of markets are currently limited to the hardcoded scenarios within the `tickLiveGame` simulation. The system is extensible via `marketTemplates.ts`, but the trigger logic is not yet fully dynamic.
-   **No API Error Handling:** As the system runs entirely on mock data, there is no error handling for failed API calls, which will be necessary for production. The `apiAdapter.ts` is in place but not yet utilized.

---

### 🏁 Conclusion

The "Live Game (Betting Mode)" is **Partially Functional**.

The core architecture is solid, and the primary user flow—from game creation to live betting and final results—is implemented correctly. The separation of balances, the market generation engine, and the live leaderboard updates all function as intended within the mock environment.

However, the feature lacks robustness in a few key areas, most notably the absence of tie-breaking logic and the "Celebrate Winners" feature. The market triggering system, while functional, is based on a simple simulation and will need to be connected to a more advanced event feed for production use.

The implementation is well-structured and ready for the final features to be added.
