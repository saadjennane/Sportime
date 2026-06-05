# Audit Report: Live Game (Prediction Mode)

**Date:** July 30, 2025
**Auditor:** Dualite Alpha

## 🧠 Functional Summary

The user flow for the "Live Game (Prediction Mode)" is implemented as follows:
1.  An admin creates a "Live Game" from within a league, selecting the "Prediction" mode and an upcoming match.
2.  League members can then navigate to the game's setup page.
3.  On the setup page, the user inputs their final score prediction (e.g., 2-1).
4.  **Discrepancy:** Based on the predicted score, the system currently generates only **one** bonus question, not four.
5.  After submitting, the predictions are locked.
6.  During the match, a live play page shows the real-time score and a live-updating leaderboard. A halftime edit button is present.
7.  After the match, a results page displays the final leaderboard and a breakdown of points.

## 🧮 Scoring Logic (as coded)

The scoring is calculated in `src/lib/liveGameEngine.ts` inside the `calculateLiveGameScores` function. The logic matches the documented rules for the final score portion.

-   **Correct Result (W/D/L):** 15 points.
-   **Goal Difference:**
    -   0 difference: 15 points.
    -   1 difference: 8 points.
    -   2 difference: 4 points.
    -   ≥3 difference: 0 points.
-   **Per-Team Accuracy:** `max(0, 15 - 4 * (|P_H - A_H| + |P_A - A_A|))`.
-   **Exact Score Bonus:** 15 points.
-   **Halftime Edit Malus:** If `midtime_edit` is true, the final `score_final` is multiplied by 0.6.

**Bonus Question Scoring:**
-   **Discrepancy:** The system generates only one bonus question. If the user's answer is correct, they receive **40 points**. This does not match the specification of four questions worth 10 points each.

## ⚙️ Backend & Trigger Flow

-   The system is currently based on mock data within a Zustand store (`src/store/useMockStore.ts`).
-   There is no automatic trigger for match status changes. The game's status (`Upcoming`, `Ongoing`, `Finished`) is manually managed within the mock data (`src/data/mockLiveGames.ts`).
-   Score recalculation is not happening automatically in real-time. It is calculated on-demand when the `LiveGamePlayPage` or `LiveGameResultsPage` renders.

## 🧾 Data Model References

The primary data structures are defined in `src/types/index.ts`:
-   `LiveGame`: Contains the overall game state, including the match details, mode, status, and an array of player entries.
-   `LiveGamePlayerEntry`: Stores an individual player's prediction, bonus answers, and calculated points.
-   `BonusQuestion`: Defines the structure for a bonus question. The `players` array in `LiveGame` currently stores only one question object.

## 🧱 Frontend Behavior

-   **Creation:** An admin can create a game via the "Create Live Game" button in the league's "Live" tab, which opens `LiveGameSetupModal`.
-   **Setup:** `LiveGameSetupPage.tsx` handles prediction input. It correctly shows input fields for the score. **Discrepancy:** It only renders a single bonus question.
-   **Live Play:** `LiveGamePlayPage.tsx` displays the live score and a leaderboard. It includes a button for the halftime edit.
-   **Results:** `LiveGameResultsPage.tsx` shows the final breakdown.

## 🧩 Edge Cases

-   **Tie-Breaks:** No tie-breaking logic is currently implemented in the leaderboard sorting. Players with equal scores are sorted based on their array order.
-   **Postponed Matches:** There is no specific logic to handle postponed or canceled matches. The game would remain in an "Upcoming" or "Ongoing" state indefinitely.

## 🚨 Conclusion: Discrepancies vs. Documentation

The core scoring logic for the final score prediction is correctly implemented. However, there are significant deviations from the documented design:

1.  **Bonus Questions:** The system only generates and scores **one question for 40 points**, not four questions for 10 points each.
2.  **Tie-Breaking:** The specified tie-breaking rules (goal difference error, submission time) are **not implemented**.
3.  **Live Updates:** The leaderboard does not refresh automatically. It relies on component re-renders.

The feature is **partially functional** but requires corrections to meet the full MVP specification.
