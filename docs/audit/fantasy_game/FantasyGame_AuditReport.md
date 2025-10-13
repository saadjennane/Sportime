# 🎮 Game Audit: Fantasy Game (Sportime Fantasy Mode)

**Version:** 1.3  
**Last Audited:** July 31, 2025  
**Author:** Dualite Alpha  
**Status:** 🟡 Partially Functional (Core logic implemented, but key rules missing)

---

## 🧠 Functional Summary

The **Fantasy Game** is a season-long competition where users build a team of real-world football players and compete based on their players' live performance.

**Current User Flow:**
1.  **Game Selection:** User selects the "Sportime Fantasy" game from the main games list.
2.  **Game Week View:** The user lands on the `FantasyGameWeekPage`, which defaults to the current or next upcoming GameWeek.
3.  **Team Management:**
    -   The user can view their starting lineup and bench for the selected GameWeek.
    -   Players can be substituted between the pitch and the bench by clicking on them.
    -   A captain can be selected, which is visually indicated.
    -   Boosters can be selected from a modal, and the active booster is displayed.
4.  **Live/Finished View:** For GameWeeks that are live or finished, the view switches to a "live" mode, showing player points instead of stats and disabling editing.
5.  **Leaderboard:** A leaderboard is accessible, showing rankings based on total accumulated points.

---

## 🏗️ Architecture Overview

The Fantasy Game logic is primarily managed on the client-side using a combination of React components and a Zustand store.

-   **State Management (`src/store/useMockStore.ts`):** The Zustand store holds the `fantasyGames` and `userFantasyTeams` data. However, most of the complex state management (like player swaps, captain selection) is handled locally within the `FantasyGameWeekPage` component via `useState`.
-   **Core Engine (`src/lib/fantasy/engine.ts`):** This file contains the pure functions for calculating player scores (`computePlayerPoints`), team totals (`computeTeamTotal`), player game scores (`computePGS`), and fatigue. It also holds the `FANTASY_CONFIG` constants.
-   **Service Layer (`src/services/fantasyService.ts`):** A `processGameWeek` function orchestrates the scoring simulation for a finished or live GameWeek, using functions from the `engine`.
-   **Main UI Component (`src/pages/FantasyGameWeekPage.tsx`):** This is a large, stateful component that manages the entire user experience for a GameWeek, including team display, player selection modals, and switching between setup and live views.
-   **Sub-components (`src/components/fantasy/*`):** The UI is broken down into smaller components like `FantasyPitch`, `Bench`, `PlayerCircle`, and `GameWeekConditions` for better organization.

---

## 🧮 Scoring Logic

The scoring system is well-defined in `engine.ts` and functions as follows:

1.  **Base Player Points:** Calculated in `computePlayerPoints` based on a weighted sum of various in-game actions (goals, assists, cards, etc.). Each action's point value is determined by the player's position (e.g., a defender's goal is worth more than an attacker's).
2.  **Fatigue Multiplier:** A player's base points are multiplied by their fatigue level (a value between 0 and 1). A tired player (e.g., 70% fatigue) will earn fewer points.
3.  **Captain Bonus:** The designated captain receives a **1.1x passive multiplier** on their final points.
4.  **Boosters:**
    -   **Double Impact:** If active, the captain's points are multiplied by **2.2x** (this includes the base 1.1x, so it's effectively a 2x on top of the passive bonus).
    -   **Golden Game:** If active, the **entire team's final score** is multiplied by **1.2x**.
    -   **Recovery Boost:** **Not implemented.** The booster exists in the mock data, but there is no logic in `processGameWeek` to handle it.
5.  **Team Bonuses:** `computeTeamTotal` applies exclusive bonuses based on the team composition (e.g., "No Star Bonus," "Vintage Boost").

---

##  STATUS: Player Status & Fatigue System

-   **Player Game Score (PGS):** The `computePGS` function calculates a player's intrinsic score based on their last 10 stats (rating, impact, consistency).
    -   **DISCREPANCY:** The formula is **incomplete**. It correctly calculates the weighted average but **does not include the playtime ratio adjustment** as specified in the design docs.
-   **Player Status (Star/Key/Wild):** `getPlayerCategoryFromPGS` correctly assigns a status based on the calculated PGS. This is used to determine fatigue reduction.
-   **Fatigue Calculation:** `calculateFatigue` correctly reduces a player's fatigue if they played and increases it if they rested.
    -   **DISCREPANCY:** The fatigue value is allowed to drop indefinitely. There is **no lower limit clamp (e.g., 70%)**, which could lead to unrealistic negative multipliers if not handled carefully.

---

## 🔄 Rotation & Restriction Logic

-   **Team Composition:** The UI correctly displays players in their formation slots on the `FantasyPitch`.
-   **Player Swaps:** The logic for swapping players between the starting lineup and the bench, or for selecting a new player, is handled within `FantasyGameWeekPage.tsx`.
-   **GameWeek Conditions:** The `GameWeekConditions` component visually indicates whether team-building rules (e.g., "Max 2 players from same club") are met.
    -   **DISCREPANCY / INCOMPLETE:** This is **purely a visual indicator**. There is **no enforcement logic** to prevent a user from confirming an invalid team. The "Confirm Team" button remains active regardless of whether the conditions are met.

---

## 🗂️ File References

-   **Main Logic:** `src/pages/FantasyGameWeekPage.tsx`
-   **Scoring Engine:** `src/lib/fantasy/engine.ts`
-   **Simulation Service:** `src/services/fantasyService.ts`
-   **Data Models:** `src/types/index.ts`
-   **Mock Data:** `src/data/mockFantasy.tsx`, `src/data/mockPlayerStats.ts`
-   **UI Components:** `src/components/fantasy/*`

---

## ⚠️ Edge Cases & Discrepancies

1.  **Incomplete PGS Formula:** The playtime adjustment is missing, making the PGS less accurate than designed.
2.  **Missing Recovery Boost Logic:** The "Recovery Boost" can be selected, but it has no functional effect on player fatigue.
3.  **No Team Validation:** Users can confirm teams that violate the GameWeek rules.
4.  **No Fatigue Floor:** Player fatigue can drop to very low levels, which may not be the intended behavior.
5.  **Captain on DNP:** The logic correctly assigns captaincy to a substitute if the original captain does not play (DNP), which is a well-handled edge case.

---

## 🏁 Conclusion

**Status:** 🟡 **Partially Functional**

The Fantasy Game has a solid foundation with a well-structured scoring engine and a functional UI for team management. However, it is not "MVP-complete" due to several critical missing pieces of logic: the incomplete PGS formula, the lack of team validation enforcement, and the non-functional "Recovery Boost". These discrepancies prevent the game from being fully compliant with its intended rule set and could lead to an unbalanced or exploitable gameplay experience.
