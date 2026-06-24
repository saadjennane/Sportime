// Journey hook — runs after settle-match-bets. Finds newly-settled, un-notified bets,
// groups per user, and pushes via the `notify` orchestrator:
//   • AC-2 "first win" if the user has never been notified of a win before
//   • MC-3 single win/loss, or a digest when several settled together
// Marks bets notified_at so each result is pushed exactly once.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' }
const profit = (b: any) => b.status === 'won' ? ((b.potential_win ?? 0) - b.amount) : -b.amount
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)]

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const URL = Deno.env.get('SUPABASE_URL') ?? ''
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const sb = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })

    const { data: bets, error } = await sb.from('match_bets')
      .select('id, user_id, status, amount, potential_win, settled_at')
      .in('status', ['won', 'lost'])
      .is('notified_at', null)
      .gte('settled_at', new Date(Date.now() - 24 * 3600_000).toISOString())
      .limit(2000)
    if (error) throw error
    if (!bets?.length) return new Response(JSON.stringify({ ok: true, users: 0, bets: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const byUser = new Map<string, any[]>()
    for (const b of bets) { const a = byUser.get(b.user_id) ?? []; a.push(b); byUser.set(b.user_id, a) }

    let users = 0
    for (const [userId, ub] of byUser) {
      const won = ub.filter(b => b.status === 'won')
      const net = ub.reduce((t, b) => t + profit(b), 0)

      let firstWin = false
      if (won.length > 0) {
        const { count } = await sb.from('match_bets').select('id', { count: 'exact', head: true })
          .eq('user_id', userId).eq('status', 'won').not('notified_at', 'is', null)
        firstWin = (count ?? 0) === 0
      }

      let notifKey = 'MC-3', title = '', message = ''
      const wonGain = won.reduce((t, b) => t + profit(b), 0)
      if (firstWin) {
        notifKey = 'AC-2'; title = '🎉 First win — you nailed it!'
        message = `+${wonGain.toLocaleString()} coins in the bag. You've got the touch — stack another 🔥`
      } else if (ub.length === 1) {
        if (ub[0].status === 'won') {
          title = pick(['🤑 Winner! Your pick cashed', '💰 Boom — that\'s a winner', '🔥 You called it!'])
          message = `+${profit(ub[0]).toLocaleString()} coins just landed. Ride the momentum and go again.`
        } else {
          title = pick(['😬 So close, not this time', 'Ahh — that one got away', 'Tough one'])
          message = pick(['Shake it off — fresh matches are live 💪', "Bounce back on tonight's games 🔁"])
        }
      } else if (won.length > 0 && net >= 0) {
        title = `🔥 ${won.length}/${ub.length} picks cashed`
        message = `+${net.toLocaleString()} coins today. You're cooking 👨‍🍳 — see the damage.`
      } else if (won.length > 0) {
        title = `${won.length}/${ub.length} picks landed`
        message = `Mixed bag today (${net >= 0 ? '+' : ''}${net.toLocaleString()} coins). Run it back tonight 💪`
      } else {
        title = '😤 Rough round'
        message = 'No winners this time. New matches are up — time for redemption 🔁'
      }

      // Unique dedupKey per batch so the orchestrator's 12h dedup never blocks a later
      // settlement the same day (notified_at already guarantees once-only).
      const dedupKey = `MC-3:${userId}:${[...ub.map(b => b.id)].sort()[0]}`
      await fetch(`${URL}/functions/v1/notify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE}` },
        body: JSON.stringify({ userId, notifKey, category: 'matches', priority: 0, title, message, route: 'sportime://finished', dedupKey }),
      }).catch((e) => console.error('[notify-settlements] notify failed', userId, e))

      await sb.from('match_bets').update({ notified_at: new Date().toISOString() }).in('id', ub.map(b => b.id))
      users++
    }

    return new Response(JSON.stringify({ ok: true, users, bets: bets.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('[notify-settlements] error:', e)
    return new Response(JSON.stringify({ ok: false, error: String((e as any)?.message ?? e) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})
