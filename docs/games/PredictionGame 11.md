# ⚽ Game Documentation: Live Game – Prediction Mode (Pronostic Éphémère)

**Version:** 2.0  
**Last Updated:** July 31, 2025  
**Author:** Saad Jennane / Dualite Alpha  
**Status:** ✅ MVP-Complete

---

## 🧠 Concept Overview

The **Live Game – Prediction Mode** is a short-format, real-time prediction challenge that takes place on a **single match**.  
It is designed to simulate the thrill of a live betting experience **without monetary stakes**.  
Players earn points by correctly predicting the **final score** and answering a set of **contextual bonus questions**.

The mode can be used as a “live event” within a league, allowing all participants to compete during a specific match.

---

## ⚙️ Core Game Rules

### 1. Game Creation
- Only **league admins** can create a Live Game.
- Admin selects:
  - One upcoming real-world match.
  - The game mode: **Prediction** (vs. Betting).
- Once created, the match appears in the league’s Live tab.

### 2. Player Flow

| Phase | Description |
|--------|--------------|
| **Setup (Pre-match)** | Player predicts the final score (e.g., 2–1). Based on this prediction, 4 contextual bonus questions are generated automatically. |
| **Kick-off** | Predictions lock automatically at match start. |
| **Live Phase** | A live leaderboard updates dynamically as goals are simulated or fetched from API data. |
| **Halftime Edit** | Players have one opportunity to adjust their final score prediction at halftime, incurring a -40% penalty on the final score points. Bonus questions cannot be changed. |
| **Results** | After the match ends, all scores are finalized and displayed in a results leaderboard. The admin can celebrate winners. |

---

## 🧮 Scoring System

A player’s **Total Points** =  
**Final Score Points (Max 60)** + **Bonus Questions (Max 40)** = **100 Points Total**

---

### ⚽ Final Score Points (Max 60)

| Criteria | Description | Max Points |
|-----------|--------------|-------------|
| **1. Correct Result** | Correctly predicts the match outcome (win/draw/loss) | +15 |
| **2. Goal Difference Accuracy** | Based on the absolute difference between predicted and actual goal differences | 0–15 |
|  | `diffGD = 0 → +15`<br>`diffGD = 1 → +8`<br>`diffGD = 2 → +4`<br>`diffGD ≥ 3 → +0` |  |
| **3. Per-Team Accuracy** | Evaluates accuracy of goals per team using `max(0, 15 - 4 × deltaTeams)` | +15 |
| **4. Exact Score Bonus** | If both scores are exactly correct | +15 |

**Halftime Malus:**  
If the player edits their score at halftime → `FinalScore × 0.6` (–40% penalty).

---

### 🎯 Bonus Questions (Max 40)

- Each match generates **4 contextual questions**, each worth **10 points**.  
- Questions are determined dynamically based on the player’s predicted score.

#### Example Logic:
| Predicted Score | Example Questions |
|------------------|--------------------|
| **0–0** | 1️⃣ Who will have higher possession?<br>2️⃣ Which team will get more shots on target?<br>3️⃣ Who will be named Man of the Match?<br>4️⃣ Which team will make more substitutions? |
| **Low-Scoring (<3 total goals)** | 1️⃣ Which team will score first?<br>2️⃣ In which half will the first goal occur?<br>3️⃣ Who will have the most shots on target?<br>4️⃣ Who will be Man of the Match? |
| **High-Scoring (≥3 total goals)** | 1️⃣ Which team opens the score?<br>2️⃣ Total goals in the first half?<br>3️⃣ Who scores last?<br>4️⃣ Who will have higher possession? |

Each correct answer = **+10 points**, incorrect = **0 points**.  
All questions share the same weight regardless of match prediction.

---

## 💰 Points Summary Example

| Component | Description | Points |
|------------|--------------|--------|
| Correct Result | Predicted right team wins | 15 |
| Goal Difference | Predicted 3–1, actual 2–0 → diff = 0 | 15 |
| Per-Team Accuracy | Close prediction | 12 |
| Exact Score Bonus | Missed | 0 |
| Bonus Questions | 3/4 correct | 30 |
| **Total** |  | **72 points** |

---

## 🧱 Technical Architecture

| File / Component | Role |
|-------------------|------|
| **`useMockStore.ts`** | Central store managing game state, match progress, and player entries. Handles scoring logic and halftime edits. |
| **`liveGameEngine.ts`** | Contains the `calculateLiveGameScores()` function. Computes all scoring components. |
| **`LiveGameSetupPage.tsx`** | Handles pre-match prediction and bonus question display (now using centralized `generateBonusQuestions()` function). |
| **`LiveGamePlayPage.tsx`** | Displays live score simulation, dynamic leaderboard, and halftime edit logic. |
| **`LiveGameResultsPage.tsx`** | Shows final leaderboard and enables “Celebrate Winners” (admin-only). |

---

## ⚙️ Backend & Mock Logic

- The game currently runs on **mock data** managed by Zustand.
- Live match progression is simulated by a scheduler (`tickLiveGame`) that updates match minute and score every few seconds.
- `calculateLiveGameScores()` recalculates player points on each render tick.
- Future API integration is prepared through `apiAdapter.ts`:
  - `fetchLiveOdds()` and `fetchFixtureStatus()` placeholders are ready for real-time data.

---

## 🧩 Edge Cases & Rules Enforcement

| Scenario | Expected Behavior |
|-----------|-------------------|
| Player edits score at halftime | Applies -40% penalty on final score component only |
| Player leaves game mid-match | Score persists; live updates continue |
| Player misses kickoff | Cannot submit or modify predictions |
| Multiple ties | Leaderboard uses tie-breaks by goal diff, then submission time |
| Match not finished | Leaderboard shows partial data until full-time |
| Match cancelled | Game ends with “No Result” status; no points awarded |

---

## 🎉 Celebrate Winners

At the end of the match:
- Admin can click **“Celebrate Winners”** to generate a post in the league feed.  
- The post includes:
  - The 1st, 2nd, and 3rd place players.
  - A short auto-generated message (editable by admin).
  - Visible date range for the leaderboard snapshot.

---

## 🧾 Audit References

- [Audit Report – Live Game Prediction Mode (Initial)](../audit/live_game/prediction/LivePrediction_Audit_V1.md)  
- [Audit Report – Live Game Prediction Mode (Bonus Question Fix)](../audit/live_game/prediction/LivePrediction_Audit_V2_BonusFix.md)

---

## 🏁 Status Summary

✅ **Feature Complete (MVP-Ready)**  
💡 Bonus question system centralized and fully functional.  
🔒 Stable state management with future API hooks implemented.  
📊 Real-time leaderboard and halftime malus verified.

---
