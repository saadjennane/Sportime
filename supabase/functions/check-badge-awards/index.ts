/**
 * Check Badge Awards Edge Function
 *
 * Evaluates badge conditions and awards badges to users who meet the criteria.
 * Can be called for a specific user or run for all users.
 *
 * Endpoint: POST /functions/v1/check-badge-awards
 * Body: { userId?: string } // If omitted, checks all users
 *
 * Response:
 *   {
 *     success: boolean,
 *     awarded: Array<{ user_id, badge_id, badge_name }>
 *   }
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BadgeCondition {
  type: string;
  value: any;
  query?: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const { userId } = await req.json().catch(() => ({}));

    console.log(`[check-badge-awards] Checking badges for ${userId || 'all users'}`);

    // Get active badges
    const { data: badges, error: badgesError } = await supabase
      .from('badges')
      .select('*')
      .eq('is_active', true);

    if (badgesError) throw badgesError;

    console.log(`[check-badge-awards] Found ${badges?.length || 0} active badges`);

    const awarded: any[] = [];

    // Get users to check
    let usersToCheck: string[] = [];
    if (userId) {
      usersToCheck = [userId];
    } else {
      const { data: users } = await supabase.from('users').select('id');
      usersToCheck = users?.map(u => u.id) || [];
    }

    console.log(`[check-badge-awards] Checking ${usersToCheck.length} users`);

    // Check each user against each badge
    for (const uid of usersToCheck) {
      // Get badges user already has
      const { data: userBadges } = await supabase
        .from('user_badges')
        .select('badge_id')
        .eq('user_id', uid);

      const earnedBadgeIds = new Set(userBadges?.map(ub => ub.badge_id) || []);

      for (const badge of badges || []) {
        // Skip if user already has this badge
        if (earnedBadgeIds.has(badge.id)) continue;

        // Evaluate condition
        const isEligible = await evaluateBadgeCondition(
          supabase,
          uid,
          {
            type: badge.condition_type,
            value: badge.condition_value,
            query: badge.condition_query,
          }
        );

        if (isEligible) {
          console.log(`[check-badge-awards] Awarding badge "${badge.name}" to user ${uid}`);

          // Award badge
          const { error: insertError } = await supabase
            .from('user_badges')
            .insert({
              user_id: uid,
              badge_id: badge.id,
              earned_at: new Date().toISOString(),
            });

          if (!insertError) {
            // Note: XP bonus is awarded automatically via trigger
            awarded.push({
              user_id: uid,
              badge_id: badge.id,
              badge_name: badge.name,
              xp_bonus: badge.xp_bonus,
            });
          }
        }
      }
    }

    console.log(`[check-badge-awards] Complete! ${awarded.length} badges awarded`);

    return new Response(
      JSON.stringify({
        success: true,
        badgesAwarded: awarded.length,
        awarded,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('[check-badge-awards] Exception:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

/**
 * Evaluate if a user meets a badge condition
 */
async function evaluateBadgeCondition(
  supabase: any,
  userId: string,
  condition: BadgeCondition
): Promise<boolean> {
  if (!condition.type || !condition.value) return false;

  try {
    switch (condition.type) {
      case 'win_streak':
        return await checkWinStreak(supabase, userId, condition.value);

      case 'total_wins':
        return await checkTotalWins(supabase, userId, condition.value);

      case 'accuracy_threshold':
        return await checkAccuracy(supabase, userId, condition.value);

      case 'coins_earned':
        return await checkCoinsEarned(supabase, userId, condition.value);

      case 'games_played':
        return await checkGamesPlayed(supabase, userId, condition.value);

      case 'custom_query':
        return await executeCustomQuery(supabase, userId, condition.query!, condition.value);

      default:
        console.warn(`[evaluateBadgeCondition] Unknown condition type: ${condition.type}`);
        return false;
    }
  } catch (err) {
    console.error(`[evaluateBadgeCondition] Error evaluating ${condition.type}:`, err);
    return false;
  }
}

async function checkWinStreak(supabase: any, userId: string, requiredStreak: number): Promise<boolean> {
  // TODO: Implement win streak logic based on your predictions table
  // This is a placeholder implementation
  return false;
}

async function checkTotalWins(supabase: any, userId: string, requiredWins: number): Promise<boolean> {
  // Count total correct predictions
  const { count } = await supabase
    .from('swipe_predictions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_correct', true);

  return (count || 0) >= requiredWins;
}

async function checkAccuracy(supabase: any, userId: string, requiredAccuracy: number): Promise<boolean> {
  const { data: stats } = await supabase
    .from('user_activity_logs')
    .select('predictions_made, predictions_correct')
    .eq('user_id', userId)
    .order('week_start', { ascending: false })
    .limit(4); // Last 4 weeks

  if (!stats || stats.length === 0) return false;

  const totalMade = stats.reduce((sum, s) => sum + (s.predictions_made || 0), 0);
  const totalCorrect = stats.reduce((sum, s) => sum + (s.predictions_correct || 0), 0);

  if (totalMade === 0) return false;

  const accuracy = (totalCorrect / totalMade) * 100;
  return accuracy >= requiredAccuracy;
}

async function checkCoinsEarned(supabase: any, userId: string, requiredCoins: number): Promise<boolean> {
  const { data: user } = await supabase
    .from('users')
    .select('coins_balance')
    .eq('id', userId)
    .single();

  return (user?.coins_balance || 0) >= requiredCoins;
}

async function checkGamesPlayed(supabase: any, userId: string, requiredGames: number): Promise<boolean> {
  const { count } = await supabase
    .from('swipe_predictions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  return (count || 0) >= requiredGames;
}

async function executeCustomQuery(
  supabase: any,
  userId: string,
  query: string,
  expectedValue: any
): Promise<boolean> {
  // Execute custom SQL query (sanitized)
  // This should be used carefully with admin-created queries only
  const { data, error } = await supabase.rpc('execute_badge_query', {
    p_user_id: userId,
    p_query: query,
  });

  if (error) {
    console.error('[executeCustomQuery] Error:', error);
    return false;
  }

  return data === expectedValue;
}
