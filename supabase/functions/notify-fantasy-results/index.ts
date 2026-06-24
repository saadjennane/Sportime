// Journey FA-5 — fantasy gameweek results. Runs after settle-fantasy-gameweeks.
// A fantasy_leaderboard row = a settled result (points + rank) for a user in a gameweek.
// Notify each newly-ranked user once with their score + finishing position.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const URL = Deno.env.get('SUPABASE_URL') ?? ''
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const sb = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })

    const { data: rows, error } = await sb.from('fantasy_leaderboard')
      .select('id, user_id, game_id, game_week_id, total_points, rank')
      .is('notified_at', null)
      .gte('created_at', new Date(Date.now() - 24 * 3600_000).toISOString())
      .limit(5000)
    if (error) throw error
    if (!rows?.length) return new Response(JSON.stringify({ ok: true, sent: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    let sent = 0
    for (const r of rows as any[]) {
      const rankPart = r.rank ? ` · finished #${r.rank}` : ''
      await fetch(`${URL}/functions/v1/notify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE}` },
        body: JSON.stringify({
          userId: r.user_id, notifKey: 'FA-5', category: 'fantasy', priority: 0,
          title: 'Gameweek results are in 📊',
          message: `You scored ${(r.total_points ?? 0).toLocaleString()} pts${rankPart}. See the breakdown.`,
          route: `sportime://fantasy/${r.game_id}`, dedupKey: `FA-5:${r.user_id}:${r.game_week_id}`,
        }),
      }).catch((e) => console.error('[notify-fantasy-results] notify failed', r.user_id, e))
      await sb.from('fantasy_leaderboard').update({ notified_at: new Date().toISOString() }).eq('id', r.id)
      sent++
    }

    return new Response(JSON.stringify({ ok: true, sent }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('[notify-fantasy-results] error:', e)
    return new Response(JSON.stringify({ ok: false, error: String((e as any)?.message ?? e) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})
