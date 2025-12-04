/**
 * Calculate Weekly XP Edge Function
 *
 * This function is called weekly (via cron or GitHub Actions) to calculate
 * and update XP for all users based on their activity in the past week.
 *
 * Endpoint: POST /functions/v1/calculate-weekly-xp
 * Auth: Requires service role key or specific API key
 *
 * Response:
 *   {
 *     success: boolean,
 *     usersUpdated: number,
 *     results: Array<{ user_id, xp_gained, new_level, leveled_up }>
 *   }
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[calculate-weekly-xp] Starting weekly XP calculation...');

    // Call the SQL function to update all users
    const { data, error } = await supabase.rpc('update_all_weekly_xp');

    if (error) {
      console.error('[calculate-weekly-xp] Error:', error);
      throw error;
    }

    const results = data || [];
    const usersUpdated = results.length;
    const usersLeveledUp = results.filter((r: any) => r.leveled_up).length;
    const totalXPAwarded = results.reduce((sum: number, r: any) => sum + r.xp_gained, 0);

    console.log(`[calculate-weekly-xp] Complete! ${usersUpdated} users updated, ${usersLeveledUp} leveled up`);
    console.log(`[calculate-weekly-xp] Total XP awarded: ${totalXPAwarded}`);

    return new Response(
      JSON.stringify({
        success: true,
        usersUpdated,
        usersLeveledUp,
        totalXPAwarded,
        results: results.map((r: any) => ({
          user_id: r.user_id,
          xp_gained: r.xp_gained,
          new_xp_total: r.new_xp_total,
          new_level: r.new_level,
          new_level_name: r.new_level_name,
          leveled_up: r.leveled_up,
        })),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('[calculate-weekly-xp] Exception:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error occurred',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
