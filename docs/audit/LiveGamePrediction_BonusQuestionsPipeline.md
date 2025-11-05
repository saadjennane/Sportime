# Audit Report: Live Game (Prediction Mode) - Bonus Questions Pipeline

**Date:** 2025-07-30
**Auditor:** Dualite Alpha
**Objective:** To investigate the discrepancy where the "Live Game (Prediction Mode)" displays only one bonus question instead of the intended four.

---

### 🧠 Summary of Findings

The "Bonus Questions" system is **partially functional**.

The investigation confirms that the backend logic, including the question generation in the data store (`useMockStore.ts`) and the score calculation engine (`liveGameEngine.ts`), is **correctly implemented** to handle a set of four distinct bonus questions, each worth 10 points.

The failure point is isolated entirely within the frontend rendering component, specifically the **`LiveGameSetupPage.tsx`**. This component fails to use the correct generation logic, leading to only one question being displayed to the user.

---

### 💣 Root Cause

The primary issue is a **logic duplication error**. The `LiveGameSetupPage.tsx` component contains its own hardcoded, simplified version of the bonus question generation logic within a `useMemo` hook. This local logic is incorrect and only ever returns an array containing a single question.

As a result, the `BonusQuestionSet` component, which is designed to render an array of questions, only ever receives an array with one item, thus only displaying one question to the user.

---

### 📂 Affected Files and Lines

- **File:** `src/pages/live-game/LiveGameSetupPage.tsx`
- **Lines:** The `useMemo` hook responsible for defining the `bonusQuestions` constant.

```typescript
// Problematic code block in LiveGameSetupPage.tsx

const bonusQuestions: BonusQuestion[] = useMemo(() => {
    if (hasSubmitted) {
      return game.bonus_questions;
    }
    // This logic is incorrect and only generates one question.
    const predictedScore = { home: Number(homeScore), away: Number(awayScore) };
    const totalGoals = predictedScore.home + predictedScore.away;
    if (totalGoals === 0) {
      return [{ id: 'q1', question: 'Team with highest possession?', options: [game.match_details.teamA.name, game.match_details.teamB.name], answer: '' }];
    } else if (totalGoals < 3) {
      return [{ id: 'q1', question: 'Which team scores first?', options: [game.match_details.teamA.name, game.match_details.teamB.name, 'No Goal'], answer: '' }];
    } else {
      return [{ id: 'q1', question: 'Which team opens the score?', options: [game.match_details.teamA.name, game.match_details.teamB.name], answer: '' }];
    }
  }, [homeScore, awayScore, hasSubmitted, game.bonus_questions, game.match_details]);
```

---

### 🛠️ Suggested Fix

The `useMemo` hook in `LiveGameSetupPage.tsx` should be refactored to call the centralized `generateBonusQuestions` function (which should be exported from `useMockStore.ts` or a shared utility file). This will eliminate the logic duplication and ensure the frontend uses the same correct, 4-question generation logic as the backend.

**Example Correction:**

```typescript
// In src/store/useMockStore.ts, export the function:
// export const generateBonusQuestions = (...) => { ... };

// In src/pages/live-game/LiveGameSetupPage.tsx:
import { generateBonusQuestions } from '../../store/useMockStore'; // Adjust path as needed

// ...

const bonusQuestions: BonusQuestion[] = useMemo(() => {
    if (hasSubmitted) {
      return game.bonus_questions;
    }
    // Correctly call the centralized function
    const predictedScore = { home: Number(homeScore), away: Number(awayScore) };
    return generateBonusQuestions(predictedScore);
}, [homeScore, awayScore, hasSubmitted, game.bonus_questions]);
```

---

### ✅ Expected Behavior (4 × 10 pts)

- **Generation:** The system should generate an array of 4 contextual bonus questions based on the predicted score.
- **Storage:** The `LiveGame` object in the state should contain this array of 4 questions.
- **Display:** The `LiveGameSetupPage` should render all 4 questions, allowing the user to answer each one.
- **Scoring:** The `calculateLiveGameScores` function should award 10 points for each correct answer, up to a maximum of 40 bonus points.

---

### 🏁 Conclusion

**Status: Partially Functional**

The core backend logic for handling multiple bonus questions is sound. The feature is undermined by a critical but isolated bug in the frontend presentation layer. Implementing the suggested fix will resolve the discrepancy and align the feature with its intended design.
