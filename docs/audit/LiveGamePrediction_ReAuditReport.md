# Live Game (Prediction Mode) - Corrective Implementation Audit

**Audit Date:** 2025-07-30

This report verifies the implementation of the "Live Game (Prediction Mode)" following the corrective tasks assigned. The analysis is based on the current codebase to ensure functional and structural integrity.

---

### 🧠 Functional Summary

The user flow for the Prediction Game is as follows:

1.  **Prediction Phase (Pre-match):** The user accesses the game via the league's "Live" tab. They are presented with a screen (`LiveGameSetupPage`) to predict the final score of the match.
2.  **Dynamic Bonus Questions:** Based on the score pattern the user enters (e.g., 0-0, low-scoring, high-scoring), a set of **four contextual bonus questions** is generated.
3.  **Submission:** The user submits their final score prediction and answers to the four bonus questions. This is locked at kickoff.
4.  **Live Phase:** During the match (`LiveGamePlayPage`), a live leaderboard is displayed, which refreshes periodically. A one-time option to edit the final score prediction (with a penalty) is available at halftime.
5.  **Results Phase:** After the match (`LiveGameResultsPage`), the final leaderboard is shown with a detailed point breakdown. League admins have an option to "Celebrate the Winners," which creates a post in the league's feed.

---

### 🧮 Scoring Logic (as coded)

The scoring logic is implemented in `src/lib/liveGameEngine.ts` within the `calculateLiveGameScores` function. It correctly follows the specified rules.

**1. Final Score Points (Max 60 pts):**
-   **Correct Result:** **15 points** if the win/draw/loss outcome is correct.
-   **Goal Difference:** **15 points** for the exact goal difference, **8 pts** for a difference of 1, **4 pts** for a difference of 2.
-   **Per-Team Accuracy:** A maximum of **15 points**, reduced by 4 for each goal of difference between the predicted and actual goals for each team.
-   **Exact Score Bonus:** **15 points** for predicting the exact final score.

**2. Bonus Questions Points (Max 40 pts):**
-   The system generates **four unique bonus questions** based on the predicted score pattern.
-   Each correctly answered bonus question awards **10 points**.
-   The total possible points from bonus questions is correctly capped at **40**.

**3. Halftime Edit Malus:**
-   If a user edits their score at halftime (`midtime_edit: true`), their `score_final` portion is correctly multiplied by **0.6 (-40% malus)**. The bonus question points are unaffected.

---

### ⚙️ Backend & Trigger Flow

-   **Live Refresh:** The `LiveGamePlayPage.tsx` component correctly implements a `setInterval` timer that triggers every **15 seconds**.
-   **Trigger Action:** This interval calls the `onTick` prop, which is wired to the `tickLiveGame` action in the `useMockStore`.
-   **Score Calculation:** The `tickLiveGame` function in the store simulates match progress (minute and score changes). **However, it does not re-calculate and persist player scores in the state.** The scores are calculated on-the-fly within the `LiveGamePlayPage` component for display purposes.
-   **Match End:** The `setInterval` cleanup function correctly stops the timer when the game `status` is no longer "Ongoing".

---

### 🧾 Data Model References

The system primarily uses the following types from `src/types/index.ts`:

-   `LiveGame`: Contains the match details, status, mode, and the array of all player entries.
-   `LiveGamePlayerEntry`: Stores an individual player's prediction, bonus answers, submission time, and all calculated point components (`result_points`, `gd_points`, `total_points`, etc.).
-   `BonusQuestion`: Defines the structure for the four contextual questions.

---

### 🧱 Frontend Behavior

-   **Dynamic Questions:** The `LiveGameSetupPage.tsx` correctly generates four bonus questions that change based on the user's input in the score fields.
-   **Halftime Edit:** The edit button in `LiveGamePlayPage.tsx` is correctly shown only during the simulated halftime (minutes 45-60) and is disabled after one use by checking the `midtime_edit` flag.
-   **Celebrate Winners:** The `LiveGameResultsPage.tsx` correctly displays the "Celebrate the Winners" button only for league admins, which triggers the `celebrateWinners` action.

---

### 🧩 Tie-Breaking Logic

The tie-breaking logic **has been correctly implemented** in the leaderboard sorting function found in both `LiveGamePlayPage.tsx` and `LiveGameResultsPage.tsx`. The sorting order is:

1.  **Total Points** (descending)
2.  **Goal Difference Error** (ascending)
3.  **Submission Time** (ascending, earlier is better)

---

### ⚠️ Discrepancies vs. Intended Logic

The implementation successfully addresses most of the corrective requirements. However, one key discrepancy remains:

-   **Score Persistence:** The corrective prompt requested that "computed points [be written] persistently to player entries in the store" during the live refresh. The current `tickLiveGame` function only updates the match's simulated state (minute, score). It **does not** re-calculate and save the updated scores for each player back into the `game.players` array in the store. The scores are instead recalculated inside the UI components during each render. While functionally similar for the UI, this is less efficient and does not match the specified architecture.

### ✅ Conclusion

The "Live Game (Prediction Mode)" is now functionally complete and aligns with the core requirements of the corrective prompt. The dynamic bonus question system (4 x 10 pts), scoring formula, and tie-breaking logic have all been implemented as specified.

The only remaining deviation is the lack of score persistence in the store during the live `tick` event. This is a structural difference rather than a functional bug, but it should be addressed in a future refactor to optimize performance and adhere to a single source of truth for calculated data.
