/**
 * Helper functions for testing the spin system
 * Import this in your browser console or React component to run tests
 */

import {
  getUserSpinState,
  performSpin,
  claimDailyFreeSpin,
  updateAvailableSpins,
  getSpinHistory,
  addSpinsForTesting,
  resetSpinState,
} from '../services/spinService';
import { SpinTier } from '../types';

export class SpinTestHelper {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
    console.log(`[SpinTestHelper] Initialized for user: ${userId}`);
  }

  // =====================================================
  // BASIC TESTS
  // =====================================================

  async testGetState() {
    console.log('\n📋 Test: Get User Spin State');
    try {
      const state = await getUserSpinState(this.userId);
      console.log('✅ State retrieved:', state);
      return state;
    } catch (error) {
      console.error('❌ Failed:', error);
      throw error;
    }
  }

  async testClaimFreeSpin() {
    console.log('\n🎁 Test: Claim Daily Free Spin');
    try {
      const result = await claimDailyFreeSpin(this.userId);
      console.log('✅ Claim result:', result);

      const state = await getUserSpinState(this.userId);
      console.log('Available spins after claim:', state.availableSpins);

      return result;
    } catch (error) {
      console.error('❌ Failed:', error);
      throw error;
    }
  }

  async testClaimCooldown() {
    console.log('\n⏰ Test: Claim Cooldown (should fail)');
    try {
      const result = await claimDailyFreeSpin(this.userId);

      if (result.success) {
        console.error('❌ Should have failed due to cooldown!');
      } else {
        console.log('✅ Cooldown working:', result.message);
        console.log('Next available at:', result.nextAvailableAt);
      }

      return result;
    } catch (error) {
      console.error('❌ Unexpected error:', error);
      throw error;
    }
  }

  async testAddSpins(tier: SpinTier, count: number) {
    console.log(`\n➕ Test: Add ${count} ${tier} spins`);
    try {
      await updateAvailableSpins(this.userId, tier, count);
      const state = await getUserSpinState(this.userId);
      console.log('✅ Spins added. Available:', state.availableSpins);
      return state;
    } catch (error) {
      console.error('❌ Failed:', error);
      throw error;
    }
  }

  // =====================================================
  // SPIN TESTS
  // =====================================================

  async testSpin(tier: SpinTier) {
    console.log(`\n🎰 Test: Perform ${tier} spin`);
    try {
      const stateBefore = await getUserSpinState(this.userId);
      console.log(`Spins before: ${stateBefore.availableSpins[tier]}`);
      console.log(`Pity counter before: ${stateBefore.pityCounter}`);

      const result = await performSpin(this.userId, tier);
      console.log('✅ Spin result:', {
        reward: result.rewardLabel,
        category: result.rewardCategory,
        wasPity: result.wasPity,
      });

      const stateAfter = await getUserSpinState(this.userId);
      console.log(`Spins after: ${stateAfter.availableSpins[tier]}`);
      console.log(`Pity counter after: ${stateAfter.pityCounter}`);
      console.log('Adaptive multipliers:', stateAfter.adaptiveMultipliers);

      return result;
    } catch (error) {
      console.error('❌ Failed:', error);
      throw error;
    }
  }

  async testMultipleSpins(tier: SpinTier, count: number) {
    console.log(`\n🎰🎰🎰 Test: Perform ${count} ${tier} spins`);

    // Add spins first
    await this.testAddSpins(tier, count);

    const results = [];
    for (let i = 0; i < count; i++) {
      const result = await performSpin(this.userId, tier);
      const state = await getUserSpinState(this.userId);

      results.push({
        spinNumber: i + 1,
        reward: result.rewardLabel,
        category: result.rewardCategory,
        wasPity: result.wasPity,
        pityCounter: state.pityCounter,
      });

      console.log(`Spin ${i + 1}/${count}:`, {
        reward: result.rewardLabel,
        pityCounter: state.pityCounter,
        wasPity: result.wasPity,
      });
    }

    console.log('\n📊 Summary:');
    console.log('Total spins:', results.length);
    console.log('Pity spins:', results.filter(r => r.wasPity).length);
    console.log('Final pity counter:', results[results.length - 1].pityCounter);

    // Count rewards by category
    const rewardCounts: Record<string, number> = {};
    results.forEach(r => {
      rewardCounts[r.category] = (rewardCounts[r.category] || 0) + 1;
    });
    console.log('Rewards by category:', rewardCounts);

    return results;
  }

  async testPityTimer() {
    console.log('\n⏱️ Test: Pity Timer (10+ spins to trigger)');

    // Reset first
    await resetSpinState(this.userId);

    // Add 15 spins
    await this.testAddSpins('amateur', 15);

    let pityTriggered = false;
    let spinCount = 0;

    for (let i = 0; i < 15; i++) {
      const result = await performSpin(this.userId, 'amateur');
      const state = await getUserSpinState(this.userId);
      spinCount++;

      console.log(`Spin ${spinCount}:`, {
        reward: result.rewardLabel,
        pityCounter: state.pityCounter,
        wasPity: result.wasPity,
      });

      if (result.wasPity) {
        console.log(`✅ Pity timer triggered at spin ${spinCount}!`);
        pityTriggered = true;
        break;
      }
    }

    if (!pityTriggered) {
      console.log('⚠️ Pity timer did not trigger in 15 spins (this can happen due to RNG)');
    }

    return { pityTriggered, spinCount };
  }

  // =====================================================
  // HISTORY TESTS
  // =====================================================

  async testHistory(limit: number = 10) {
    console.log(`\n📜 Test: Get Spin History (limit: ${limit})`);
    try {
      const history = await getSpinHistory(this.userId, limit);
      console.log(`✅ Retrieved ${history.length} history entries`);

      history.forEach((entry, index) => {
        console.log(`${index + 1}.`, {
          reward: entry.rewardLabel,
          category: entry.rewardCategory,
          wasPity: entry.wasPity,
          timestamp: entry.timestamp,
        });
      });

      return history;
    } catch (error) {
      console.error('❌ Failed:', error);
      throw error;
    }
  }

  // =====================================================
  // EDGE CASE TESTS
  // =====================================================

  async testSpinWithoutAvailable(tier: SpinTier) {
    console.log(`\n🚫 Test: Spin without available ${tier} spins (should fail)`);
    try {
      // Remove all spins
      const state = await getUserSpinState(this.userId);
      const currentSpins = state.availableSpins[tier];
      if (currentSpins > 0) {
        await updateAvailableSpins(this.userId, tier, -currentSpins);
      }

      // Try to spin
      const result = await performSpin(this.userId, tier);

      if (result) {
        console.error('❌ Should have failed! Got result:', result);
      } else {
        console.log('✅ Correctly rejected spin without available spins');
      }

      return result;
    } catch (error) {
      console.log('✅ Correctly threw error:', error.message);
      return null;
    }
  }

  async testExtraSpinReward() {
    console.log('\n♻️ Test: Extra Spin Reward (keep spinning until we get one)');

    // Add many spins to increase chances
    await this.testAddSpins('amateur', 20);

    let gotExtraSpin = false;
    let attempts = 0;
    const maxAttempts = 20;

    while (!gotExtraSpin && attempts < maxAttempts) {
      const stateBefore = await getUserSpinState(this.userId);
      const spinsBefore = stateBefore.availableSpins.amateur;

      const result = await performSpin(this.userId, 'amateur');
      attempts++;

      if (result.rewardId.includes('extra_spin')) {
        const stateAfter = await getUserSpinState(this.userId);
        const spinsAfter = stateAfter.availableSpins.amateur;

        console.log('✅ Got extra spin reward!');
        console.log(`Spins before: ${spinsBefore}`);
        console.log(`Spins after: ${spinsAfter}`);
        console.log(`Change: ${spinsAfter - spinsBefore} (should be 0: -1 consumed, +1 granted)`);

        gotExtraSpin = true;
      }
    }

    if (!gotExtraSpin) {
      console.log(`⚠️ Did not get extra spin in ${maxAttempts} attempts`);
    }

    return gotExtraSpin;
  }

  // =====================================================
  // COMPREHENSIVE TESTS
  // =====================================================

  async runAllTests() {
    console.log('\n' + '='.repeat(60));
    console.log('🧪 RUNNING ALL SPIN TESTS');
    console.log('='.repeat(60));

    const results: Record<string, boolean> = {};

    try {
      // Test 1: Get state
      await this.testGetState();
      results['Get State'] = true;
    } catch {
      results['Get State'] = false;
    }

    try {
      // Test 2: Add spins
      await this.testAddSpins('amateur', 5);
      results['Add Spins'] = true;
    } catch {
      results['Add Spins'] = false;
    }

    try {
      // Test 3: Perform spin
      await this.testSpin('amateur');
      results['Perform Spin'] = true;
    } catch {
      results['Perform Spin'] = false;
    }

    try {
      // Test 4: History
      await this.testHistory(10);
      results['Get History'] = true;
    } catch {
      results['Get History'] = false;
    }

    try {
      // Test 5: Multiple spins
      await this.testMultipleSpins('amateur', 5);
      results['Multiple Spins'] = true;
    } catch {
      results['Multiple Spins'] = false;
    }

    try {
      // Test 6: Spin without available
      await this.testSpinWithoutAvailable('premium');
      results['Reject Without Spins'] = true;
    } catch {
      results['Reject Without Spins'] = false;
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(60));

    Object.entries(results).forEach(([test, passed]) => {
      console.log(`${passed ? '✅' : '❌'} ${test}`);
    });

    const passedCount = Object.values(results).filter(Boolean).length;
    const totalCount = Object.keys(results).length;
    console.log(`\nPassed: ${passedCount}/${totalCount}`);

    return results;
  }

  // =====================================================
  // RESET & CLEANUP
  // =====================================================

  async reset() {
    console.log('\n🔄 Resetting spin state...');
    try {
      await resetSpinState(this.userId);
      const state = await getUserSpinState(this.userId);
      console.log('✅ Reset complete:', state);
      return state;
    } catch (error) {
      console.error('❌ Reset failed:', error);
      throw error;
    }
  }
}

// =====================================================
// QUICK ACCESS FUNCTIONS
// =====================================================

/**
 * Create a test helper instance
 * Usage: const tester = createSpinTester('user-id-here')
 */
export function createSpinTester(userId: string): SpinTestHelper {
  return new SpinTestHelper(userId);
}

/**
 * Quick test for browser console
 * Usage: await quickSpinTest('user-id-here')
 */
export async function quickSpinTest(userId: string) {
  const tester = new SpinTestHelper(userId);
  return await tester.runAllTests();
}

// Make it available globally in development
if (import.meta.env.DEV) {
  (window as any).SpinTestHelper = SpinTestHelper;
  (window as any).createSpinTester = createSpinTester;
  (window as any).quickSpinTest = quickSpinTest;
  console.log('🧪 Spin test helpers loaded! Use:');
  console.log('  - createSpinTester(userId)');
  console.log('  - quickSpinTest(userId)');
}
