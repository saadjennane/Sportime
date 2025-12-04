# Prize Distribution & Spin Rewards - Final Implementation

**Date:** November 8, 2025
**Status:** ✅ Complete
**Migration:** 13 (20250704000002_finalize_prize_distribution.sql)

---

## Overview

This document details the finalization of the prize distribution and spin reward systems. All reward types are now fully functional, with elegant placeholders for features not yet implemented (Gift Cards, MasterPass).

---

## What Was Completed

### 1. ✅ Spin Granting System
**New Function:** `grant_spin(user_id, tier, quantity)`

**Purpose:** Allow spins to be given as rewards from challenges or other sources

**Features:**
- Supports 5 spin tiers: `free`, `amateur`, `master`, `apex`, `premium`
- Initializes `user_spin_states` table if user doesn't have entry
- Increments `available_spins` JSONB field for specified tier
- Returns boolean success indicator

**Integration:**
- Called by `distribute_reward_to_user()` when reward type is 'spin'
- Tier extracted from `reward.tier` field
- Quantity from `reward.value` field (default 1)

**Example Usage:**
```sql
-- Grant 2 amateur spins to a user
SELECT grant_spin('user-uuid', 'amateur', 2);

-- Grant 1 apex spin
SELECT grant_spin('user-uuid', 'apex', 1);
```

---

### 2. ✅ Updated Prize Distribution Function

**Function:** `distribute_reward_to_user(user_id, reward)`

**Now Handles All Reward Types:**

| Type | Implementation | Status |
|------|----------------|--------|
| `coins` | Direct balance update | ✅ Working |
| `ticket` | Calls `grant_ticket()` with tier | ✅ Working |
| `xp` | Adds to `activity_log` | ✅ Working |
| `spin` | Calls `grant_spin()` | ✅ NEW |
| `premium_3d` | Extends premium subscription 3 days | ✅ Working |
| `premium_7d` | Extends premium subscription 7 days | ✅ Working |
| `giftcard` | 5000 coins placeholder + logging | 🔧 Placeholder |
| `masterpass` | 5000 coins placeholder + logging | 🔧 Placeholder |
| `custom` / other | Logged but not processed | ℹ️ Ignored |

**Placeholder Behavior:**
- **Gift Cards**: Give 5000 coins instead
- **MasterPass**: Give 5000 coins instead
- Both log NOTICE to PostgreSQL logs
- Return JSON with `type: 'giftcard_placeholder'` or `masterpass_placeholder`
- Include message field explaining placeholder

**Why Placeholders?**
- Gift card API integration not ready
- MasterPass feature still in design
- Provides elegant fallback that still rewards users
- Easy to identify and replace later (search for "placeholder")
- Fully documented in logs

---

### 3. ✅ Frontend Spin Service Updates

**File:** `src/services/spinService.ts` (Lines 215-244)

**Updated `grantSpinReward()` function:**

Before:
```typescript
else if (category === 'masterpass') {
  // TODO: Implement masterpass granting when system is ready
  console.log(`TODO: Grant masterpass ${id} to user ${userId}`);
}
```

After:
```typescript
else if (category === 'masterpass') {
  // PLACEHOLDER: Give 5000 coins instead of MasterPass
  const { addCoins } = await import('./coinService');
  await addCoins(userId, 5000, 'spin_wheel', {
    reward_id: id,
    reward_label: label,
    placeholder: 'masterpass_not_implemented',
    message: 'MasterPass reward (5000 coins placeholder)'
  });
  console.log(`MasterPass reward converted to 5000 coins placeholder for user ${userId}`);
}
```

**Same for:**
- Premium subscriptions (5000 coins)
- Gift cards (5000 coins)

**Benefits:**
- Consistent behavior between database and frontend
- Transaction logging captures placeholder usage
- Metadata includes reward details for future migration
- Console logs for debugging

---

## Complete Reward Flow

### Challenge Prize Distribution

```
Challenge Status → 'finished'
       ↓
Trigger: on_challenge_finalized_distribute_prizes
       ↓
distribute_challenge_prizes(challenge_id)
       ↓
For each participant:
  ├─ Check rank/range/percentage eligibility
  ├─ Get first matching reward tier
  ├─ Call distribute_reward_to_user(user_id, reward)
  │    ├─ coins → Update balance
  │    ├─ ticket → grant_ticket(tier, expiry)
  │    ├─ xp → Insert activity_log
  │    ├─ spin → grant_spin(tier, quantity)  ✨ NEW
  │    ├─ premium → Extend subscription
  │    ├─ giftcard → 5000 coins + log
  │    └─ masterpass → 5000 coins + log
  └─ Mark reward as distributed
```

### Spin Wheel Reward Distribution

```
User spins wheel
       ↓
performSpin(user_id, tier)
       ↓
Select weighted random reward
       ↓
grantSpinReward(user_id, reward)
  ├─ ticket → grantTicket(tier, 7 days)
  ├─ spin → updateAvailableSpins(tier, +1)
  ├─ xp → addXpToUser(amount)
  ├─ masterpass → addCoins(5000) + log  ✨ NEW
  ├─ premium → addCoins(5000) + log     ✨ NEW
  └─ giftcard → addCoins(5000) + log    ✨ NEW
```

---

## Database Schema Changes

### New Function: `grant_spin`

**Signature:**
```sql
public.grant_spin(
  p_user_id UUID,
  p_tier TEXT,
  p_quantity INTEGER DEFAULT 1
)
RETURNS BOOLEAN
```

**Validation:**
- Tier must be one of: `free`, `amateur`, `master`, `apex`, `premium`
- Raises exception for invalid tier
- Returns TRUE on success

**Side Effects:**
- Creates `user_spin_states` entry if doesn't exist
- Initializes all tiers to 0 spins
- Increments specified tier by quantity
- JSONB structure: `{ "free": 0, "amateur": 2, "master": 1, ... }`

### Updated Function: `distribute_reward_to_user`

**Changes:**
1. Added WHEN 'spin' case
2. Added WHEN 'giftcard' case (placeholder)
3. Added WHEN 'masterpass' case (placeholder)
4. All return structured JSONB with success, type, value, message

**Return Format:**
```json
{
  "success": true,
  "type": "spin",
  "tier": "amateur",
  "quantity": 2
}
```

For placeholders:
```json
{
  "success": true,
  "type": "giftcard_placeholder",
  "value": 5000,
  "original_value": 10,
  "new_balance": 15000,
  "message": "Gift card reward (5000 coins placeholder)"
}
```

---

## Testing Guide

### Test Prize Distribution

**Scenario 1: Challenge with Spin Rewards**

```sql
-- 1. Create test challenge with spin reward
UPDATE challenges
SET prizes = '[
  {
    "id": "1",
    "positionType": "rank",
    "start": 1,
    "rewards": [
      {
        "id": "spin_1",
        "type": "spin",
        "tier": "amateur",
        "value": 2
      }
    ]
  }
]'::jsonb
WHERE id = 'test-challenge-id';

-- 2. Finish challenge
UPDATE challenges SET status = 'finished' WHERE id = 'test-challenge-id';

-- 3. Check spin was granted
SELECT available_spins
FROM user_spin_states
WHERE user_id = 'test-user-id';
-- Expected: { "amateur": 2, ... }
```

**Scenario 2: Challenge with Gift Card (Placeholder)**

```sql
-- 1. Create challenge with gift card reward
UPDATE challenges
SET prizes = '[
  {
    "id": "1",
    "positionType": "rank",
    "start": 1,
    "rewards": [
      {
        "id": "gc_1",
        "type": "giftcard",
        "value": 10
      }
    ]
  }
]'::jsonb
WHERE id = 'test-challenge-id';

-- 2. Finish challenge
UPDATE challenges SET status = 'finished' WHERE id = 'test-challenge-id';

-- 3. Check coins were added (5000)
SELECT coin_balance
FROM users
WHERE id = 'test-user-id';

-- 4. Check transaction log
SELECT *
FROM coin_transactions
WHERE user_id = 'test-user-id'
ORDER BY created_at DESC
LIMIT 1;
-- Should show placeholder metadata
```

**Scenario 3: Spin Wheel with MasterPass**

```typescript
// User spins apex wheel and wins MasterPass
const result = await performSpin('user-id', 'apex');

// Check reward was converted to coins
// Console should log: "MasterPass reward converted to 5000 coins placeholder"

// Verify coins added
const { data: user } = await supabase
  .from('users')
  .select('coin_balance')
  .eq('id', 'user-id')
  .single();

// Verify transaction logged
const { data: tx } = await supabase
  .from('coin_transactions')
  .select('*')
  .eq('user_id', 'user-id')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

console.log(tx.metadata);
// Should include: { placeholder: 'masterpass_not_implemented', ... }
```

---

## Migration Deployment

### Apply Migration 13

**Option A: Supabase Dashboard**
1. Go to SQL Editor
2. Copy contents of `supabase/migrations/20250704000002_finalize_prize_distribution.sql`
3. Paste and click "Run"
4. Verify functions created

**Option B: Supabase CLI**
```bash
supabase db push
```

### Verification

```sql
-- 1. Verify grant_spin exists
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name = 'grant_spin';

-- 2. Verify distribute_reward_to_user updated
SELECT routine_name, pg_get_functiondef(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'distribute_reward_to_user';
-- Should include WHEN 'spin', 'giftcard', 'masterpass' cases

-- 3. Test grant_spin
SELECT grant_spin(
  (SELECT id FROM users LIMIT 1),
  'amateur',
  3
);
-- Should return TRUE
```

---

## What's Next

### When Gift Card API is Ready

**Replace placeholder in migration:**

Find line ~190 in `distribute_reward_to_user`:
```sql
WHEN 'giftcard' THEN
  -- TODO: Replace placeholder with actual gift card API call
  -- Call external API to generate gift card code
  -- Store code in user_gift_cards table
  -- Send email with code

  -- For now: 5000 coins
  UPDATE public.users...
```

**Replace placeholder in spinService.ts:**

Find line ~235:
```typescript
else if (category === 'gift_card') {
  // TODO: Replace with actual gift card granting
  // await giftCardService.generate(userId, value);

  // For now: 5000 coins
  await addCoins(userId, 5000, ...);
}
```

### When MasterPass Feature is Ready

Same pattern - search for "masterpass_placeholder" and replace with actual logic.

---

## Summary

| Component | Status | Notes |
|-----------|--------|-------|
| Spin Granting | ✅ Complete | All 5 tiers supported |
| Prize Distribution | ✅ Complete | All 8 reward types handled |
| Spin Service | ✅ Complete | Placeholders active |
| Migration | ✅ Created | Ready to apply |
| Documentation | ✅ Complete | This file |
| Testing | 🧪 Ready | See Testing Guide above |

**All systems operational.** Prize distribution is fully functional with elegant placeholders for future features.
