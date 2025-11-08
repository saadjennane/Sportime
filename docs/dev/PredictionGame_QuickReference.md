# ⚙️ Prediction Game – Developer Quick Reference

**Version:** 2.0  
**Last Update:** July 31, 2025  
**Scope:** Backend / API / QA  
**Status:** ✅ Fully Functional (Multi-Day Ready)

---

## 🧩 Core Concepts

| Concept | Description |
|---|---|
| **Match Day** | Single prediction event covering multiple matches. User predicts all outcomes before kickoff. |
| **Prediction Challenge** | Group of multiple Match Days. Aggregates scores for a multi-day leaderboard. |
| **Entry** | A user’s set of predictions for a given Match Day. |

---

## 🧱 Data Models

#### SwipeMatchDay
```ts
type SwipeMatchDay = {
  id: string;
  title: string;
  date: string;
  matches: SwipeMatch[];
  challengeId?: string;
  status: 'upcoming' | 'ongoing' | 'finished';
};
```

#### PredictionChallenge
```ts
type PredictionChallenge = {
  id: string;
  title: string;
  season?: string;
  leagueId?: string;
  matchDayIds: string[];
  createdAt: string;
};
```

#### UserSwipeEntry
```ts
type UserSwipeEntry = {
  id: string;
  userId: string;
  matchDayId: string;
  predictions: SwipePrediction[];
  total_points: number;
  nb_correct_picks: number;
  submitted_at: string | null;
};
```

---

## 🧮 Scoring Logic

#### Per Match
```
if (prediction === result)
  points = odds * 100;
else
  points = 0;
```

#### Per Match Day
- **total_points** = Σ (points from correct matches);
- **nb_correct_picks** = count(correct predictions);

#### Per Challenge (multi-day)
- **challenge_total_points** = Σ (total_points for all linked matchdays);
- **challenge_nb_correct_picks** = Σ (nb_correct_picks for all linked matchdays);
- **first_submission_ts** = earliest(submitted_at among all entries);

---

## 🏆 Leaderboard Sorting

**Function:** `sortByPredictionRanking(a, b)`  
**File:** `src/lib/sorters.ts`

**Priority order:**
1. `total_points` desc
2. `nb_correct_picks` desc
3. `first_submission_ts` asc
4. `player_name` asc

---

## 🧰 Store / Actions

**File:** `src/store/useMockStore.ts`

| Function | Description |
|---|---|
| `createPredictionChallenge(title, season, leagueId, matchDayIds)` | Creates a new challenge |
| `attachMatchDayToChallenge(matchDayId, challengeId)` | Links Match Day to a challenge |
| `detachMatchDayFromChallenge(matchDayId, challengeId)` | Removes Match Day from a challenge |
| `selectChallengeLeaderboard(challengeId)` | Aggregates results per player |
| `selectPlayerChallengeBreakdown(challengeId, playerId)` | Returns per-day performance for a given player |

---

## 📊 UI Pages

| Component | Description |
|---|---|
| `SwipeGamePage.tsx` | Swipe-based prediction input |
| `SwipeRecapPage.tsx` | Prediction review & result display |
| `SwipeLeaderboardPage.tsx` | Daily leaderboard |
| `PredictionChallengeOverviewPage.tsx` | Aggregated leaderboard for multi-day challenges |

---

## ⚠️ Edge Case Behavior

| Case | System Behavior |
|---|---|
| Unpredicted match | No points |
| Cancelled match | Ignored (no gain/loss) |
| Missing odds | Excluded from scoring |
| Identical scores | Sorted via tie-breakers |
| Empty challenge | Displays “No Match Days available” |

---

## 🧾 Example (Challenge Aggregation)

- **Day 1:** 480 pts, 3 correct
- **Day 2:** 370 pts, 2 correct
- **Total Challenge Score:** 850 pts, 5 correct

---

## 🚀 Integration Notes

- The logic is fully client-side for now (mock data).
- For backend implementation, replicate aggregation logic via SQL or API endpoints:
  - `/leaderboard/day/:matchDayId`
  - `/leaderboard/challenge/:challengeId`
- Ensure the backend respects the same tie-breaking hierarchy and timestamp precision.
