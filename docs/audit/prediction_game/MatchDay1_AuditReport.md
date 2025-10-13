# 🎯 Audit Report: Prediction Game ("Match Day 1")

**Version:** 1.0  
**Audit Date:** July 31, 2025  
**Author:** Dualite Alpha  
**Status:** 🟡 Partially Functional

---

## 🧠 Functional Summary

The **Prediction Game** (labeled as "Match Day 1" in the UI) is a single-day prediction challenge. The user flow is as follows:

1.  **Join Game**: From the "All Games" list, the user pays a coin-based entry fee to join the challenge.
2.  **Make Predictions**: The user is presented with a stack of match cards. They swipe left for Team A win, right for Team B win, or up for a draw. This must be done for all matches in the set.
3.  **Review & Edit**: After swiping through all matches, the user is taken to a recap screen where they can review their picks and edit them individually until the first match of the day kicks off.
4.  **View Results**: Once the match day is "Finished," the recap screen shows the final outcomes and the points awarded for each correct prediction.
5.  **Leaderboard**: A dedicated leaderboard page ranks all participants based on the total points accumulated for that specific match day.

---

## 🏗️ Architecture Overview

The game's logic is primarily managed within the `App.tsx` component, which holds the central state for user entries (`userSwipeEntries`). The UI is split across several key components:

-   **`GamesListPage.tsx`**: The entry point where users can discover and join the game.
-   **`SwipeGamePage.tsx`**: The main prediction interface, featuring a Tinder-like card-swiping mechanic for making picks. It uses the `SwipeCard.tsx` component.
-   **`SwipeRecapPage.tsx`**: A summary screen that allows users to review and edit their predictions before the deadline. It also serves as the results view post-match.
-   **`SwipeLeaderboardPage.tsx`**: A dedicated view that calculates and displays the final rankings for a single match day.

State changes, such as submitting a prediction, are handled by functions in `App.tsx` and passed down as props. There is no dedicated backend service; all logic is client-side and operates on mock data.

---

## 🧮 Scoring & Calculation Logic

The scoring mechanism is straightforward and is implemented in the `calculateSwipePoints` function within `SwipeLeaderboardPage.tsx`.

-   **Formula**: `Points = (odds of correct prediction) × 100`
-   **Winning Bets**: If a user's prediction for a match is correct (i.e., it matches the `result` field), they are awarded points calculated by multiplying the odds of their chosen outcome by 100.
-   **Losing Bets**: If the prediction is incorrect, the user receives **0 points** for that match.
-   **No Negative Scores**: The system does not penalize players for incorrect predictions. The lowest possible score is 0.
-   **Total Score**: A player's total score for the match day is the sum of points from all their correct predictions.

---

## 🖥️ Frontend Behavior

-   **Prediction Input**: The `SwipeCard` component provides an intuitive, mobile-first interface for making predictions. Visual cues (text overlays) appear during the swipe gesture to indicate the selected outcome.
-   **State Locking**: The UI correctly locks the prediction and editing features once a match day's status changes from `Upcoming` to `Ongoing` or `Finished`.
-   **Results Display**: The `SwipeRecapPage` effectively highlights correct and incorrect predictions post-match, showing the points awarded for each correct pick.
-   **Leaderboard Filtering**: The `SwipeLeaderboardPage` includes a `LeaderboardLeagueSwitcher` and a `LeaderboardPeriodFilter`. This allows a user's score *for this specific match day* to be viewed in the context of a global leaderboard or a private league leaderboard. The date filter can include or exclude this match day's results from a league's overall seasonal ranking but does not aggregate scores from multiple days.

---

## 🧩 Edge Cases & Discrepancies

1.  **No Multi-Day Aggregation (Major Discrepancy)**: The game is titled "Match Day 1," implying it is part of a larger, multi-day challenge. However, the current leaderboard logic is self-contained and only calculates scores for a **single `SwipeMatchDay`**. There is no mechanism to aggregate a user's points across multiple match days (e.g., "Match Day 1" + "Match Day 2") into a cumulative challenge leaderboard.
2.  **No Tie-Breaker Logic**: The leaderboard sorting logic in `SwipeLeaderboardPage.tsx` only sorts by `points`. In the event of a tie, the ranking is unstable and not deterministic, which is a significant omission for a competitive game.
3.  **Single-Day Structure**: The data model (`SwipeMatchDay`) and UI flow are built around a single day of matches. While this works for one-off events, it does not support a true "challenge" that spans several days or weeks with a persistent, cumulative leaderboard. The date filter in the league context is a workaround, not a solution for this.
4.  **No "Challenge" Entity**: Unlike the "Betting Challenge" mode, there is no parent "Challenge" entity that groups multiple "Match Days" together. Each `SwipeMatchDay` is treated as an independent, standalone game.

---

## 🏁 Conclusion

**Status: 🟡 Partially Functional**

The Prediction Game is fully functional as a **single, one-off event**. The user can join, predict, and view results for an individual match day without issue. The scoring is clear and correctly implemented according to the rules presented in the UI.

However, it fails to deliver on the implicit promise of a multi-day "Challenge." The core discrepancy is the lack of a cumulative leaderboard that aggregates scores across multiple match days. The absence of tie-breaker logic is another critical flaw for a competitive feature.

To be considered "Fully Functional" as a true challenge mode, the architecture would need to be updated to support the aggregation of points across multiple `SwipeMatchDay` events under a single, persistent challenge leaderboard.
