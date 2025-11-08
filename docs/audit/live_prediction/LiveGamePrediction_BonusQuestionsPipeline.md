# Audit Report: Live Game Prediction - Bonus Questions Pipeline

**Date:** July 31, 2025
**Auditor:** Dualite Alpha
**Objective:** Identify the failure point in the bonus questions system, which currently displays one question instead of the intended four.

---

### Summary of Findings

The investigation confirms that the `generateBonusQuestions` function in the backend logic (`useMockStore.ts`) correctly creates an array of **four** distinct bonus questions. However, the frontend component responsible for displaying them (`LiveGameSetupPage.tsx`) contains its own separate, simplified logic that overrides the centralized function, resulting in only one question being shown to the user.

### Root Cause

The primary issue is a **logic duplication and override** on the frontend. The `LiveGameSetupPage.tsx` component does not use the `generateBonusQuestions` function from the store. Instead, it uses a `useMemo` hook that manually constructs a single bonus question and assigns it a point value of 40.

### Affected Files and Lines

1.  **`src/pages/live-game/LiveGameSetupPage.tsx`**:
    -   The `useMemo` hook responsible for creating `bonusQuestions` is the point of failure. It contains hardcoded logic to generate a single question object.
    -   **Incorrect Logic:**
        ```typescript
        const bonusQuestions: BonusQuestion[] = useMemo(() => {
          // ... simplified logic that returns a single question array ...
          return [{ id: 'q1', question: 'Who will score first?', ..., points: 40 }];
        }, [homeScore, awayScore]);
        ```

2.  **`src/store/useMockStore.ts`**:
    -   The `generateBonusQuestions` function is correctly implemented and produces an array of four questions, but it is not being utilized by the setup page.
    -   The `submitLiveGamePrediction` action correctly stores whatever questions are passed to it, which in this case is the single question from the faulty frontend logic.

### Suggested Fix

The `LiveGameSetupPage.tsx` component must be refactored to remove its internal question-generation logic. It should instead:
1.  Import the `generateBonusQuestions` function from `src/store/useMockStore.ts`.
2.  Call this function within its `useMemo` hook to get the correct array of four questions.
3.  Ensure its JSX correctly iterates over the `bonusQuestions` array using `.map()` to render all four questions.

### Expected Behavior (4 × 10 pts)

-   `generateBonusQuestions` creates an array of 4 `BonusQuestion` objects.
-   `LiveGameSetupPage` receives and renders all 4 questions.
-   The user answers all 4 questions.
-   `calculateLiveGameScores` iterates through the 4 answers, awarding 10 points for each correct one, for a maximum of 40 bonus points.

### Conclusion

-   **Status:** **Partially functional.**
-   The backend generation logic is correct, but the frontend rendering pipeline is broken due to localized, incorrect logic overriding the central system. The fix requires removing the faulty code from the frontend component and connecting it to the correct store function.
