/**
 * Diagnostic script for spin system issues
 * Run this in the browser console to check the system status
 */

import { supabase } from '../config/supabase';

export async function diagnoseSpin() {
  console.log('🔍 Running Spin System Diagnostic...\n');

  const results: Record<string, { status: 'OK' | 'ERROR'; message: string }> = {};

  // 1. Check Supabase connection
  console.log('1️⃣ Checking Supabase connection...');
  try {
    if (!supabase) {
      results['Supabase Connection'] = {
        status: 'ERROR',
        message: 'Supabase client is null. Check .env file.'
      };
    } else {
      const { data, error } = await supabase.from('users').select('id').limit(1);
      if (error) {
        results['Supabase Connection'] = {
          status: 'ERROR',
          message: `Connection failed: ${error.message}`
        };
      } else {
        results['Supabase Connection'] = {
          status: 'OK',
          message: 'Connected successfully'
        };
      }
    }
  } catch (error: any) {
    results['Supabase Connection'] = {
      status: 'ERROR',
      message: error.message
    };
  }

  // 2. Check if tables exist
  console.log('2️⃣ Checking if tables exist...');
  try {
    const { data: spinStates, error: spinStatesError } = await supabase!
      .from('user_spin_states')
      .select('user_id')
      .limit(1);

    if (spinStatesError) {
      results['Table: user_spin_states'] = {
        status: 'ERROR',
        message: `Table missing or inaccessible: ${spinStatesError.message}`
      };
    } else {
      results['Table: user_spin_states'] = {
        status: 'OK',
        message: 'Table exists and accessible'
      };
    }

    const { data: spinHistory, error: spinHistoryError } = await supabase!
      .from('spin_history')
      .select('id')
      .limit(1);

    if (spinHistoryError) {
      results['Table: spin_history'] = {
        status: 'ERROR',
        message: `Table missing or inaccessible: ${spinHistoryError.message}`
      };
    } else {
      results['Table: spin_history'] = {
        status: 'OK',
        message: 'Table exists and accessible'
      };
    }
  } catch (error: any) {
    results['Tables Check'] = {
      status: 'ERROR',
      message: error.message
    };
  }

  // 3. Check if ENUM type exists
  console.log('3️⃣ Checking if spin_tier ENUM exists...');
  try {
    const { data, error } = await supabase!.rpc('get_user_spin_state', {
      p_user_id: '00000000-0000-0000-0000-000000000000' // Dummy UUID
    });

    // If error is "function does not exist", ENUM is missing
    if (error && error.message.includes('does not exist')) {
      results['ENUM: spin_tier'] = {
        status: 'ERROR',
        message: 'ENUM type or RPC function missing. Migration not applied?'
      };
    } else {
      results['ENUM: spin_tier'] = {
        status: 'OK',
        message: 'ENUM type exists'
      };
    }
  } catch (error: any) {
    results['ENUM Check'] = {
      status: 'ERROR',
      message: error.message
    };
  }

  // 4. Check RPC functions
  console.log('4️⃣ Checking RPC functions...');
  const rpcFunctions = [
    'get_user_spin_state',
    'get_spin_history',
    'update_pity_counter',
    'update_adaptive_multipliers',
    'clean_expired_multipliers',
    'update_available_spins',
    'record_spin',
    'claim_daily_free_spin'
  ];

  for (const funcName of rpcFunctions) {
    try {
      // Try to call each function with dummy params
      let testResult;

      switch (funcName) {
        case 'get_user_spin_state':
        case 'clean_expired_multipliers':
          testResult = await supabase!.rpc(funcName, {
            p_user_id: '00000000-0000-0000-0000-000000000000'
          });
          break;

        case 'get_spin_history':
          testResult = await supabase!.rpc(funcName, {
            p_user_id: '00000000-0000-0000-0000-000000000000',
            p_limit: 1
          });
          break;

        case 'update_pity_counter':
          testResult = await supabase!.rpc(funcName, {
            p_user_id: '00000000-0000-0000-0000-000000000000',
            p_reset: false
          });
          break;

        case 'update_adaptive_multipliers':
          testResult = await supabase!.rpc(funcName, {
            p_user_id: '00000000-0000-0000-0000-000000000000',
            p_category: 'test',
            p_expires_at: new Date().toISOString()
          });
          break;

        case 'update_available_spins':
          testResult = await supabase!.rpc(funcName, {
            p_user_id: '00000000-0000-0000-0000-000000000000',
            p_tier: 'amateur',
            p_delta: 0
          });
          break;

        case 'record_spin':
          testResult = await supabase!.rpc(funcName, {
            p_user_id: '00000000-0000-0000-0000-000000000000',
            p_tier: 'amateur',
            p_reward_id: 'test',
            p_reward_label: 'test',
            p_reward_category: 'test',
            p_reward_value: null,
            p_was_pity: false,
            p_final_chances: null
          });
          break;

        case 'claim_daily_free_spin':
          testResult = await supabase!.rpc(funcName, {
            p_user_id: '00000000-0000-0000-0000-000000000000'
          });
          break;

        default:
          continue;
      }

      if (testResult.error) {
        // Check if it's just a "user not found" error (which is OK for dummy UUID)
        if (testResult.error.message.includes('violates foreign key')) {
          results[`RPC: ${funcName}`] = {
            status: 'OK',
            message: 'Function exists (FK constraint expected with dummy UUID)'
          };
        } else {
          results[`RPC: ${funcName}`] = {
            status: 'ERROR',
            message: testResult.error.message
          };
        }
      } else {
        results[`RPC: ${funcName}`] = {
          status: 'OK',
          message: 'Function callable'
        };
      }
    } catch (error: any) {
      results[`RPC: ${funcName}`] = {
        status: 'ERROR',
        message: error.message
      };
    }
  }

  // 5. Check RLS policies
  console.log('5️⃣ Checking RLS policies...');
  try {
    const { data: user } = await supabase!.auth.getUser();

    if (!user.user) {
      results['RLS Policies'] = {
        status: 'ERROR',
        message: 'Not authenticated. Cannot test RLS policies.'
      };
    } else {
      // Try to access own data
      const { data: ownState, error: ownError } = await supabase!
        .from('user_spin_states')
        .select('*')
        .eq('user_id', user.user.id)
        .limit(1);

      if (ownError) {
        results['RLS Policies'] = {
          status: 'ERROR',
          message: `Cannot access own data: ${ownError.message}`
        };
      } else {
        results['RLS Policies'] = {
          status: 'OK',
          message: 'Can access own data'
        };
      }
    }
  } catch (error: any) {
    results['RLS Policies'] = {
      status: 'ERROR',
      message: error.message
    };
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 DIAGNOSTIC SUMMARY');
  console.log('='.repeat(60));

  let errorCount = 0;
  let okCount = 0;

  Object.entries(results).forEach(([check, result]) => {
    const icon = result.status === 'OK' ? '✅' : '❌';
    console.log(`${icon} ${check}`);
    console.log(`   ${result.message}`);

    if (result.status === 'OK') {
      okCount++;
    } else {
      errorCount++;
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log(`Total: ${okCount} OK, ${errorCount} errors`);
  console.log('='.repeat(60));

  if (errorCount > 0) {
    console.log('\n⚠️ NEXT STEPS:');

    if (results['Supabase Connection']?.status === 'ERROR') {
      console.log('1. Check .env file has VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
      console.log('2. Restart dev server after updating .env');
    }

    if (results['Table: user_spin_states']?.status === 'ERROR' ||
        results['Table: spin_history']?.status === 'ERROR') {
      console.log('1. Go to Supabase Dashboard → SQL Editor');
      console.log('2. Run the migration: supabase/migrations/20250630000000_spin_system.sql');
      console.log('3. Or copy/paste the entire file content and execute it');
    }

    if (Object.keys(results).some(k => k.startsWith('RPC:') && results[k].status === 'ERROR')) {
      console.log('1. Check if migration was fully applied');
      console.log('2. Check Supabase logs for errors');
      console.log('3. Try re-running the migration');
    }
  } else {
    console.log('\n✅ All checks passed! Spin system should be working.');
  }

  return results;
}

// Auto-run in dev mode
if (import.meta.env.DEV) {
  (window as any).diagnoseSpin = diagnoseSpin;
  console.log('🔍 Diagnostic tool loaded! Run: diagnoseSpin()');
}
