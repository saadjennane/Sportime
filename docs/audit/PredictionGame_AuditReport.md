# Audit Report: Live Game (Prediction Mode)

**Date:** 2025-07-30  
**Auditor:** Dualite Alpha

This document provides a detailed audit of the current implementation of the **Live Game (Prediction Mode)**, also known as "Pronostic Éphémère," based on the existing codebase.

---

### 🧠 Functional Summary

The user flow for the Prediction Game is as follows:

1.  **Creation (Admin):** A league admin navigates to the "Live" tab within their league and clicks "Create Live Game." They select "Prediction Mode" and choose an upcoming real-world match. This creates a `LiveGame` instance linked to the league.
2.  **Prediction (Player):** League members see the upcoming game and can enter the "setup" screen. Here, they predict the final score (e.g., 2-1). Based on their score input, a set of four contextual bonus questions is dynamically generated. The user must answer all questions and submit their prediction before the match kicks off.
3.  **Live View (Player):** Once the match is "Ongoing," players can view a live leaderboard that calculates and updates points based on the real-time (mocked) score of the match.
4.  **Halftime Edit (Player):** At halftime (a state currently determined by the match status), a player has one opportunity to edit their final score prediction. This action incurs a penalty on the final score portion of their points. The bonus questions cannot be changed.
5.  **Results:** After the match is "Finished," players can view the final leaderboard and a detailed breakdown of how their points were calculated.

---

### 🧮 Scoring Logic (as coded)

The scoring is calculated in the `calculateLiveGameScores` function located in `src/lib/liveGameEngine.ts`. A player's total score is the sum of a **Final Score** component (max 60 points) and a **Bonus Questions** component (max 40 points).

#### Final Score (Max 60 points)

This score is composed of four parts, each worth 15 points:

1.  **Correct Result (+15 pts):** 15 points are awarded if the player correctly predicts the winner or a draw (e.g., predicting 2-1 when the final score is 3-1).
2.  **Goal Difference (+15 pts):** Points are awarded based on the absolute difference between the predicted goal difference and the actual goal difference (`diffGD`).
    - `diffGD = 0`: **15 pts**
    - `diffGD = 1`: **8 pts**
    - `diffGD = 2`: **4 pts**
    - `diffGD ≥ 3`: **0 pts**
3.  **Per-Team Accuracy (+15 pts):** Points are awarded based on how close the predicted goals for each team are to the actual goals. The formula is `max(0, 15 - 4 * deltaTeams)`, where `deltaTeams` is the sum of the absolute differences for each team's score.
4.  **Exact Score Bonus (+15 pts):** 15 points are awarded only if the final score is predicted exactly.

**Halftime Malus:** If a player edits their score at halftime (`midtime_edit: true`), their total `ScoreFinal` is multiplied by **0.6** (a -40% penalty).

#### Bonus Questions (Max 40 points)

-   The system generates **4 bonus questions**, each worth **10 points**.
-   A correct answer awards 10 points; an incorrect answer awards 0.
-   The questions are generated dynamically in `useMockStore.ts` based on the user's predicted score:
    -   **If predicted 0-0:** A single question about possession is generated.
    -   **If predicted total goals < 3:** A single question about the first team to score is generated.
    -   **If predicted total goals ≥ 3:** A single question about the first team to score is generated.
    *(Note: This is a simplified implementation, see Discrepancies section).*

---

### ⚙️ Backend & Trigger Flow

The entire system currently runs on mock data managed by a **Zustand global store** (`src/store/useMockStore.ts`).

-   **State Management:** All `LiveGame` objects and player entries are held in the `liveGames` array within the store.
-   **Triggers:** There is no automated cron job or real-time event listener. The "live" aspect is simulated:
    -   The match status (`Upcoming`, `Ongoing`, `Finished`) is controlled by the `activeLiveGame` state in `App.tsx`, which is set when a user clicks to view a game.
    -   The live score of the match is updated via a `tickLiveGame` function in the store, which is called by a `setInterval` in the `LiveGameBettingPlayPage.tsx`. **This ticking logic is not currently active for Prediction Mode.**
-   **Scoring Application:** Points are not stored permanently after each event. Instead, the `calculateLiveGameScores` function is called on-demand whenever a component requiring scores (like `LiveGamePlayPage` or `LiveGameResultsPage`) is rendered.

---

### 🧾 Data Model References

The core data structures are defined in `src/types/index.ts`:

-   `LiveGame`: The main object for the game, containing the match details, status, mode, players, and bonus questions.
-   `LiveGamePlayerEntry`: Stores an individual player's predictions, answers, and calculated points.
-   `BonusQuestion`: Defines the structure for a bonus question with its options and correct answer.

---

### 🧱 Frontend Behavior

-   **`LiveGameSetupPage.tsx`:** Handles the initial prediction input. It dynamically calls `generateBonusQuestions` from the store to display contextual questions. UI elements are disabled once a prediction is submitted (`playerEntry` exists).
-   **`LiveGamePlayPage.tsx`:** Displays the live (mock) match score and a leaderboard. It calculates scores on each render. It contains the logic to show an "Edit" button at halftime, which triggers the `editLiveGamePrediction` action.
-   **`LiveGameResultsPage.tsx`:** Shows the final score and a detailed leaderboard with a breakdown of points for each player.

---

### 🧩 Edge Cases & Discrepancies

#### Implemented Edge Cases:
-   The scoring function `calculateLiveGameScores` safely handles cases where a match has not finished by returning the game object without calculating scores.

#### Discrepancies vs. Original Specification:

1.  **Simplified Bonus Questions:** The original specification called for rich, varied sets of 4 bonus questions for each score pattern (e.g., including "Man of the Match," "period of first goal"). The current implementation in `useMockStore.ts` only generates a single, simple placeholder question for each pattern.
2.  **Missing Tie-Breaks:** The specification required a 3-tier tie-breaking logic (goal delta, GD difference, submission time). The current leaderboards in `LiveGamePlayPage` and `LiveGameResultsPage` only sort by `total_points`, with no tie-breaking implemented.
3.  **No "Celebrate Winners" Feature:** The "Celebrate Winners" button, intended for the results page to create a feed post, has not been implemented for this game mode.
4.  **Passive "Live" Updates:** The live leaderboard for Prediction Mode does not update in real-time via a ticking scheduler. It only recalculates when the component re-renders, unlike the Betting Mode which has an active `tick` function.
