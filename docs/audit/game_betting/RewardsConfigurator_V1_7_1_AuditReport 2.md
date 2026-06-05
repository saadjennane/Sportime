# Audit Report: Rewards Configurator v1.7.1 – Front Binding & Data Flow

**Objective:** This audit verifies the data binding and reactivity between the `useMockStore`, the `GameCreationForm`, and the `RewardsConfigurator` to identify why front-end changes are not visible.

---

## ✅ Confirmed Functional Elements

1.  **Base Reward Packs (`src/config/rewardPacks.ts`)**: The `BASE_REWARD_PACKS` constant is correctly structured with all tiers (rookie, pro, elite) and formats (matchday, mini-series, season). The data is available for use.
2.  **Store Actions (`src/store/useMockStore.ts`)**: The store correctly contains the `updateBasePack` and `updateGameRewards` actions. The `createGame` action also includes the logic to populate rewards from a base pack.
3.  **Internal Configurator Logic (`src/components/admin/RewardsConfigurator.tsx`)**: The component itself is well-structured. It correctly receives props and uses a local `rewardLines` state to manage persistent lines, drag-and-drop, and individual reward editing. Its "Reset to Base" button correctly fetches and applies the default pack.
4.  **Player Preview (`src/components/RewardsPreviewModal.tsx`)**: The player-facing modal is correctly wired to read the `rewards` array from the `game` object passed to it. It will accurately display whatever data is successfully saved to the store.

---

## ⚠️ Partially Implemented

1.  **"Save as Base Pack" Button**: The `updateBasePack` action exists in the store, but the "💾 Save as Base Pack" button in `RewardsConfigurator.tsx` is not wired to call this action. It is currently a placeholder.

---

## ❌ Missing or Incorrect Implementations

1.  **Root Cause: No Automatic Reward Population in Form**:
    *   **File**: `src/components/admin/GameCreationForm.tsx`
    *   **Issue**: The form's local state (`formState`) is initialized with `rewards: []`. There is **no logic** to automatically update this `rewards` array when the `tier` or `duration_type` (format) dropdowns are changed.
    *   **Impact**: The `RewardsConfigurator` receives an empty `rewards` prop and correctly displays nothing. The user is forced to manually click "Reset to Base" to see any rewards, which is not the intended auto-populating behavior.

2.  **State Management Disconnect**:
    *   **File**: `src/components/admin/GameCreationForm.tsx`
    *   **Issue**: The form relies entirely on its own local state for the rewards configuration. While it passes the final state to the `onCreate` function, it never reads from the store to get the initial base pack. This breaks the intended reactivity.

---

## 💡 Recommendations

1.  **Implement Auto-Population in `GameCreationForm.tsx`**:
    *   Add a `useEffect` hook inside `GameCreationForm.tsx` that watches for changes to `formState.tier` and `formState.duration_type`.
    *   When these values change, the effect should:
        1.  Find the corresponding base pack from `BASE_REWARD_PACKS`.
        2.  Create a deep copy of the pack to prevent mutation issues.
        3.  Update the form's state: `setFormState(prev => ({ ...prev, rewards: deepCopiedBasePack }))`.
    *   This will ensure the `RewardsConfigurator` is immediately populated with the correct default rewards as soon as the admin selects the game's tier and format.

2.  **Wire Up "Save as Base Pack" Button**:
    *   In `RewardsConfigurator.tsx`, import the `updateBasePack` action from `useMockStore`.
    *   Attach an `onClick` handler to the "Save as Base Pack" button that calls `updateBasePack(tier, format, rewardLines)`.

---

## 🏁 Conclusion

**Overall Status: 🟡 Partially Functional**

The backend logic in the store and the internal mechanics of the `RewardsConfigurator` are mostly correct and feature-complete. However, the system is unusable from an admin's perspective due to a critical data binding failure in `GameCreationForm.tsx`. The form does not react to tier/format changes to auto-load the default reward packs, making the entire feature appear broken.

Implementing the recommended `useEffect` for auto-population will fix the core issue and align the front-end behavior with the validated back-end logic.
