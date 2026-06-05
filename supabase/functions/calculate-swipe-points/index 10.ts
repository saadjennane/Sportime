/**
 * Calculate Swipe Points Edge Function
 *
 * This function is triggered when a fixture finishes.
 * It calculates points for all predictions on that fixture and updates the leaderboard.
 *
 * Can be called:
 * 1. Via webhook when fixture status changes to 'FT'
 * 2. Manually via cron job
 * 3. Manually via API call
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CalculatePointsRequest {
  fixtureId?: string; // Specific fixture to calculate
  matchdayId?: string; // All fixtures in a matchday
  challengeId?: string; // All fixtures in a challenge
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role key (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { fixtureId, matchdayId, challengeId }: CalculatePointsRequest = await req.json();

    let processedFixtures = 0;
    let updatedPredictions = 0;

    // Get fixtures to process
    let fixtures: any[] = [];

    if (fixtureId) {
      // Process single fixture
      const { data, error } = await supabase
        .from('fixtures')
        .select('id, status, goals_home, goals_away')
        .eq('id', fixtureId)
        .single();

      if (error) throw error;
      fixtures = [data];
    } else if (matchdayId) {
      // Process all fixtures in matchday
      const { data, error } = await supabase
        .from('matchday_fixtures')
        .select('fixture:fixtures(id, status, goals_home, goals_away)')
        .eq('matchday_id', matchdayId);

      if (error) throw error;
      fixtures = data.map((mf: any) => mf.fixture);
    } else if (challengeId) {
      // Process all fixtures in challenge
      const { data, error } = await supabase
        .from('challenge_matchdays')
        .select(`
          matchday_fixtures!inner(
            fixture:fixtures(id, status, goals_home, goals_away)
          )
        `)
        .eq('challenge_id', challengeId);

      if (error) throw error;
      fixtures = data.flatMap((md: any) =>
        md.matchday_fixtures.map((mf: any) => mf.fixture)
      );
    } else {
      return new Response(
        JSON.stringify({ error: 'Must provide fixtureId, matchdayId, or challengeId' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Process each fixture
    for (const fixture of fixtures) {
      if (fixture.status !== 'FT' && fixture.status !== 'finished') {
        console.log(`Skipping fixture ${fixture.id} - not finished (status: ${fixture.status})`);
        continue;
      }

      // Determine result
      let result: 'home' | 'draw' | 'away';
      if (fixture.goals_home > fixture.goals_away) {
        result = 'home';
      } else if (fixture.goals_home < fixture.goals_away) {
        result = 'away';
      } else {
        result = 'draw';
      }

      console.log(
        `Processing fixture ${fixture.id}: ${fixture.goals_home}-${fixture.goals_away} (${result})`
      );

      // Get all predictions for this fixture
      const { data: predictions, error: predError } = await supabase
        .from('swipe_predictions')
        .select('*')
        .eq('fixture_id', fixture.id);

      if (predError) {
        console.error(`Error fetching predictions for ${fixture.id}:`, predError);
        continue;
      }

      // Update each prediction
      for (const pred of predictions || []) {
        const isCorrect = pred.prediction === result;
        const points = isCorrect
          ? Math.round(pred.odds_at_prediction[pred.prediction] * 100)
          : 0;

        const { error: updateError } = await supabase
          .from('swipe_predictions')
          .update({
            is_correct: isCorrect,
            points_earned: points,
          })
          .eq('id', pred.id);

        if (updateError) {
          console.error(`Error updating prediction ${pred.id}:`, updateError);
        } else {
          updatedPredictions++;
        }
      }

      processedFixtures++;

      // The database triggers will automatically update:
      // - matchday_participants stats
      // - challenge_participants points
    }

    // Update leaderboard ranks if we processed any fixtures
    if (processedFixtures > 0 && challengeId) {
      await updateChallengeRanks(supabase, challengeId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        processedFixtures,
        updatedPredictions,
        message: `Successfully calculated points for ${updatedPredictions} predictions across ${processedFixtures} fixtures`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error calculating points:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

/**
 * Update ranks for all participants in a challenge
 */
async function updateChallengeRanks(supabase: any, challengeId: string) {
  const { data: participants, error } = await supabase
    .from('challenge_participants')
    .select('id, user_id, points, created_at')
    .eq('challenge_id', challengeId)
    .order('points', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching participants for rank update:', error);
    return;
  }

  // Update ranks
  for (let i = 0; i < participants.length; i++) {
    await supabase
      .from('challenge_participants')
      .update({ rank: i + 1 })
      .eq('id', participants[i].id);
  }

  console.log(`Updated ranks for ${participants.length} participants`);
}
