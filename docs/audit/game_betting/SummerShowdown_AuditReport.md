# Audit Report: Game (Challenge Betting Mode)
**Audit Date:** July 31, 2025
**Game Audited:** Summer Showdown (`challenge-new`)
**Auditor:** Dualite Alpha

---

## 🧠 Functional Summary
The "GameBetting" mode, referred to in the codebase as a **Challenge (Betting Mode)**, is a multi-day betting tournament. Users pay a one-time coin entry fee to join. Once in, they receive a separate, fixed "challenge balance" for each day of the competition.

The core objective is to allocate this daily balance across various match predictions. The system calculates points based on the profit from winning bets, with optional "Boosters" to multiply gains on specific bets. The final leaderboard ranks players based on the cumulative points earned across all days of the challenge.

**Key User Flow:**
1.  **Join:** User pays an entry fee from their main coin balance.
2.  **Play:** User navigates to the `ChallengeRoomPage`, which is divided into "Days."
3.  **Bet:** For each day, the user must allocate their entire daily challenge balance across different match outcomes.
4.  **Boost:** The user can apply one of two available boosters (x2 or x3) to a single bet per day to amplify the outcome.
5.  **Lock-in:** Once the challenge begins (`Ongoing`), all bets are locked and cannot be changed.
6.  **Results:** As matches conclude, points are awarded based on winnings. The final ranking is determined by the total points accumulated.

---

## 🏗️ Architecture Overview
The feature is implemented entirely on the client side using a **Zustand global store** (`useMockStore`) for state management and mock data.

-   **State Management:** `useMockStore` holds the state for all challenges (`challenges`) and user entries (`userChallengeEntries`). Actions like placing a bet (`onUpdateDailyBets`) or applying a booster (`onSetDailyBooster`) update this central store.
-   **Component Structure:**
    -   `GamesListPage.tsx`: Displays all available games, including the "Summer Showdown" challenge, and handles the joining process.
    -   `ChallengeRoomPage.tsx`: The main hub for the game. It manages the daily view, calculates the remaining daily balance, and orchestrates the betting and booster logic.
    -   `ChallengeBetController.tsx`: A reusable component that renders a single match, its odds, and the input for placing a bet.
    -   `BoosterSelector.tsx`: A UI component that allows the user to arm a booster for the day.
-   **Data Flow:** All data is sourced from mock files (e.g., `mockChallenges.ts`). There is no backend interaction; all logic, including scoring and state changes, occurs within the client and is managed by Zustand.

---

## 🧮 Scoring & Payout Logic
The scoring is based on **points derived from profit**, not a direct coin-to-coin payout.

-   **Base Points:**
    -   If a bet is correct: `Points = (Bet_Amount × Odds) - Bet_Amount`
    -   If a bet is incorrect: `Points = 0`

-   **Booster Effects:**
    -   **x2 Profit Booster:** If applied to a winning bet, the calculated profit is doubled. `Points = Profit × 2`. There is no penalty for a loss.
    -   **x3 High-Risk Booster:** If applied to a winning bet, the profit is tripled. `Points = Profit × 3`. If the bet is lost, a **-200 point penalty** is applied.

-   **Final Score:** A player's total score is the sum of all points (including booster effects and penalties) accumulated across all days of the challenge.

This logic is primarily implemented in the `calculateChallengePoints` function, which is found in both `ChallengeRoomPage.tsx` and `LeaderboardPage.tsx`.

---

## 💰 Coin & Balance Management
The system uses two distinct balance types:

1.  **Main Coin Balance:** The user's global currency. The entry fee for the challenge is deducted from this balance. Winnings from the challenge are awarded as **points**, not coins, and do not affect this balance.
2.  **Daily Challenge Balance:** A separate, non-persistent balance (e.g., 1000) granted to the player for each day of the challenge. This balance **must be fully allocated** across the bets for that day. The UI calculates and displays the remaining daily balance to guide the user.

**Discrepancy:** While the design implies the full daily balance must be used, the current UI does not enforce this. A user can proceed without allocating their entire daily balance, effectively forfeiting the unspent amount.

---

## ⚙️ Frontend Behavior & User Flow
-   **Joining:** The `JoinChallengeConfirmationModal` correctly checks if the user's main coin balance is sufficient for the entry fee.
-   **Betting Interface (`ChallengeRoomPage`):**
    -   A `MatchDaySwitcher` allows navigation between the days of the competition.
    -   For the selected day, the UI displays the remaining "challenge balance."
    -   Each `ChallengeBetController` allows a user to select an outcome (Team A, Draw, Team B) and input a bet amount. The maximum bettable amount is dynamically calculated based on the remaining daily balance.
-   **Booster Application:**
    1.  The user clicks a booster (x2 or x3) in the `BoosterSelector`.
    2.  This "arms" the booster. The UI then prompts the user to select a match to apply it to.
    3.  Clicking "Apply Booster" on a `ChallengeBetController` finalizes the choice for that day.
-   **Locking:** Once a challenge status is `Ongoing` or `Finished`, the `disabled` prop is passed down to `ChallengeBetController`, preventing any further interaction with bets or boosters.

---

## 🧩 Edge Cases & Discrepancies

-   **Full Balance Allocation (Discrepancy):** The system does not enforce the rule that the entire daily challenge balance must be allocated. There is no validation or warning if a user leaves a balance unspent.
-   **Postponed/Cancelled Matches:** There is no specific logic to handle matches that do not conclude. Bets placed on such matches will simply yield 0 points as they are never marked "played" with a "result."
-   **Booster on a Losing Bet:** The logic correctly handles the x3 booster penalty (-200 points) and the lack of penalty for the x2 booster.
-   **Data Source:** The entire feature runs on mock data. There is no connection to a live API for match results or a backend to persist user entries, making it a client-side-only experience.

---

## 📋 Conclusion

**Status: Partially Functional**

The "GameBetting" (Challenge Betting Mode) is functional in its core loop: users can join, place bets across multiple days, use boosters, and see a final score. The UI is clear and guides the user through most actions.

However, it is "Partially Functional" due to a key discrepancy: the system **fails to enforce the rule requiring players to allocate their entire daily challenge balance**. This allows users to proceed with an incomplete betting strategy, which deviates from the intended game design. The lack of handling for postponed matches is another minor gap.

The architecture is sound for a mock-driven MVP, but these functional gaps need to be addressed for it to be considered complete.
