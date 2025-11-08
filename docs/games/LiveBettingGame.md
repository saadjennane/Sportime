# 🎯 Game Documentation: Live Game – Betting Mode

**Version:** 1.5 (Market Engine V1.5)  
**Last Updated:** July 31, 2025  
**Author:** Saad Jennane / Dualite Alpha  
**Status:** ✅ MVP-Complete

---

## 🧠 Concept Overview

The **Live Game – Betting Mode** is a real-time competitive game mode where players simulate the thrill of live betting using **virtual coins**, without monetary risk.  
Players receive separate coin balances for **pre-match** and **live** phases and must maximize their total gains by betting on dynamic markets triggered during the match.

The goal is to finish the match with the **highest total gain** across all participants.  
Unspent coins are lost at the end of each phase, making timing and decision-making crucial.

---

## ⚙️ Core Game Rules

### 1. Game Creation
- Only **league admins** can create a Live Game.
- Admin selects:
  - The match to link (must be upcoming).
  - The mode: **Betting** (vs. Prediction).
- Once created, the game appears in the league’s Live section.

### 2. Player Flow

| Phase | Description |
|--------|--------------|
| **Pre-Match Phase** | Players receive **1000 pre-match coins**. They can bet on predefined markets before kickoff (e.g., “First Goal Scorer”). |
| **Kick-off** | Pre-match markets close automatically. Each player receives **1000 live coins** for in-play betting. |
| **Live Phase** | The match enters simulation or real data feed mode. A scheduler triggers **dynamic markets** (e.g., “Will Team A equalize?”). |
| **Market Expiration** | Each market remains open for a short time before closing and being resolved automatically. |
| **Results** | At full-time, all markets are resolved. The leaderboard ranks players by total gain. Unspent coins are lost. |
| **Celebrate Winners** | Admin can publish a celebration post in the league feed, announcing the top 3 players. |

---

## 💰 Balances & Payout Logic

| Phase | Balance | Description |
|--------|-----------|-------------|
| **Pre-Match** | 1000 coins | Used before kickoff. Cannot be transferred to live phase. |
| **Live** | 1000 coins | Used for in-match markets. Unused coins are lost after full-time. |
| **Unspent Coins** | — | Discarded automatically after each phase. |

---

## 🧮 Scoring Logic

### Points = Total Gains

- For each winning bet:  
  `Gain = bet_amount × adjusted_odds`
- For losing bets:  
  `Gain = 0`
- Total gain accumulates over all markets during the game.

There are **no negative scores** or losses beyond the wagered coins.  
Leaderboard ranks players based on **total gain**.

**Example:**
| Bet | Odds | Result | Gain |
|-----|------|---------|------|
| 200 | 2.0 | Win | 400 |
| 300 | 1.8 | Lose | 0 |
| 500 | 3.0 | Win | 1500 |
| **Total** |  |  | **1900** |

---

## ⚙️ Market Engine (V1.5)

The **Market Engine** dynamically generates, displays, and resolves betting markets during the match.  
All players see **the same markets at the same time**, ensuring fairness and synchronization.

### 🧩 Market Lifecycle
1. **Trigger:** Market is created based on a match event or minute mark.  
2. **Active Phase:** Players can bet until the `expires_at` timestamp.  
3. **Resolution:** Once expired, outcomes are determined, and gains are distributed.  
4. **Cooldown:** No new markets are generated until the previous one is resolved.

### ⏱️ Market Types (Examples)
| Trigger | Example Market | Duration |
|----------|----------------|-----------|
| Kick-off | Who scores first? | 5 minutes |
| Goal Scored | Will the losing team equalize? | 10 minutes |
| 60th Minute | Will there be a goal in the next 10 minutes? | 10 minutes |
| 80th Minute | Will there be another goal before full-time? | 5 minutes |

---

## 🔢 Odds Calculation

### Base Formula:
`Adjusted Odds = Base Odds × EmotionFactor`

The **EmotionFactor** is a dynamic multiplier that adjusts odds based on the match narrative:
- **High EmotionFactor (e.g., 1.5):** Increases odds during tense moments (late goals, comebacks).
- **Low EmotionFactor (e.g., 0.8):** Reduces odds for likely outcomes (e.g., a dominant team scoring again).

This system creates more rewarding opportunities during exciting match phases.
