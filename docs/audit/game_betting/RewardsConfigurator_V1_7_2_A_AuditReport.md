# Audit Report: Rewards Configurator v1.7.2-A (Auto-Population Debug)

**Objective:** To identify why the Rewards Configurator does not auto-populate rewards when the `tier` or `duration_type` is selected in the `GameCreationForm`.

---

## ✅ Confirmed Working

- **Component Structure:** The `GameCreationForm` correctly contains the `RewardsConfigurator` component.
- **State Updates:** Changing the "Tier" and "Duration" dropdowns in `GameCreationForm.tsx` successfully updates the component's local `formState`. The `useEffect` hook that watches `formState.tier` and `formState.duration_type` is correctly triggered on these changes.
- **Base Pack Data:** The `src/config/rewardPacks.ts` file is correctly structured and contains the necessary data for all tiers and formats (`matchday`, `mini-series`, `season`).

---

## ⚠️ Partially Implemented

- **Reward Population Logic:** The `useEffect` hook intended to auto-populate rewards exists in `GameCreationForm.tsx`, but its logic is flawed, preventing it from successfully loading the data.

---

## ❌ Incorrect Implementations

- **Base Pack Lookup:** The primary failure point is in the `useEffect` hook within `GameCreationForm.tsx`. The code attempts to look up the base pack using `BASE_REWARD_PACKS?.[formState.tier]?.[formState.duration_type]`. This fails because the form's `duration_type` for daily games is `'daily'`, while the key in the `BASE_REWARD_PACKS` object is `'matchday'`. This mismatch results in `basePack` being `undefined`, and the rewards are never set.
- **UI Reactivity:** Because the rewards array in the `formState` is never populated, the `RewardsConfigurator` component receives an empty array and therefore displays nothing, making it seem like the feature is not implemented at all.

---

## 🧠 Root Cause

The root cause is a **key mismatch** between the `duration_type` value from the `GameCreationForm`'s state (`'daily'`) and the corresponding key in the `BASE_REWARD_PACKS` configuration object (`'matchday'`). This causes the base pack lookup to fail, and the auto-population logic is never successfully executed.

---

## 💡 Fix Suggestion

The `useEffect` hook in `src/components/admin/GameCreationForm.tsx` must be updated to correctly map the form's `duration_type` to the keys used in `BASE_REWARD_PACKS`.

**File:** `src/components/admin/GameCreationForm.tsx`

**Suggested Change:**

```typescript
useEffect(() => {
  if (!formState.tier || !formState.duration_type) return;

  // FIX: Map 'daily' to 'matchday' for correct lookup
  const durationKey = formState.duration_type === 'daily' ? 'matchday' : formState.duration_type;
  const basePack = BASE_REWARD_PACKS?.[formState.tier]?.[durationKey];
  
  if (basePack) {
    const deepCopied = JSON.parse(JSON.stringify(basePack));
    setFormState(prev => ({ ...prev, rewards: deepCopied }));
  }
}, [formState.tier, formState.duration_type]);
```

This one-line change aligns the lookup key with the data structure, which will allow the rewards to be correctly auto-populated.

---

## 🏁 Conclusion

**Overall Status:** 🟡 **Partially Functional**

The backend logic and component structure are largely in place, but a critical data-binding error in `GameCreationForm.tsx` prevents the entire rewards configuration feature from being visible or usable. The fix is straightforward and, once applied, should make the system fully functional as intended in v1.7.2.
