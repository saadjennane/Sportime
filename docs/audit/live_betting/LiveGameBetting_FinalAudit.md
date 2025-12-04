# Live Game (Betting Mode) – Final MVP Audit Report

**Date:** July 31, 2025  
**Auditor:** Dualite Alpha

## 1. Functional Summary

The Live Game (Betting Mode) is now fully functional at an MVP level. The system allows a league admin to create a live betting game for a specific match. Players can join and are allocated separate coin balances for pre-match and live phases.

The game progresses automatically via a mock scheduler (`tickLiveGame`), which introduces new markets and resolves old ones based on simulated match events. The leaderboard ranks players based on their total coin gains, incorporates a fair tie-breaking system, and updates in near real-time. Admins can celebrate the winners post-match, creating a social post in the league's feed.

## 2. Architecture Overview

- **State Management:** `zustand` (`useMockStore`) serves as the central store for all game states, including player balances, bets, and market status.
- **Game Engine:** The `tickLiveGame` function in the store acts as the core scheduler. It simulates match time, triggers market generation/resolution, and calculates player gains.
- **Market Generation:** A mock engine uses predefined `marketTemplates` to create new betting opportunities based on simulated time and score events.
- **Frontend:** The UI is composed of three distinct pages for the different game phases (Setup, Play, Results), ensuring a clear and separated user experience.

## 3. Scoring & Payout Logic

- **Winnings Calculation:** Correctly implemented as `gain = bet_amount × odds` for winning bets.
- **Losses:** Incorrect bets result in a gain of 0, and the wagered amount is lost from the respective balance (pre-match or live).
- **Unspent Balance:** Unused coins from both phases expire at the end of the match and do not contribute to the final score.
- **Ranking:** The leaderboard correctly ranks players based on `total_gain` (descending).

## 4. Tie-Breaker Mechanism

- **Implementation:** A multi-level tie-breaker system has been successfully implemented.
- **Logic:** The leaderboard sorts players based on the following criteria in order:
  1.  **Total Gain** (descending)
  2.  **Last Gain Time** (ascending - the player who achieved their score earliest wins the tie)
  3.  **Player Name** (alphabetical - as a final deterministic fallback)
- **Status:** This ensures a fair and consistent ranking, even when multiple players have the same score.

## 5. Frontend Behavior

- **Admin Controls:** The "Celebrate Winners" button now correctly appears on the results screen, but only for league administrators.
- **Celebration Flow:** Clicking the button opens the `CelebrationModal`, pre-filled with the top 3 players from the betting leaderboard. Confirming the action successfully creates a new post in the league's feed.
- **Real-time Updates:** The live play screen leaderboard correctly reflects changes in rank and score as the mock scheduler resolves markets and updates player gains.

## 6. Edge Cases & Discrepancies

- **Market Resolution:** The mock resolution logic is basic and tied to hardcoded minutes in the `tickLiveGame` function. This is sufficient for the MVP but will need to be replaced with a system that reacts to a real-time event feed from an external API.
- **API Readiness:** The architecture is prepared for an API switch, but the `apiAdapter.ts` functions are currently placeholders.

## 7. Conclusion

**Status: Fully Functional (MVP-complete)**

The Live Game (Betting Mode) now meets all specified MVP requirements. The core gameplay loop is complete, the scoring and ranking logic is fair and robust, and the key social feature ("Celebrate Winners") is integrated. The system is stable and ready for documentation and further development, such as integration with a live sports data API.
