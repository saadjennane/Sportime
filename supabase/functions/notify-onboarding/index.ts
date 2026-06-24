// Journey ON-2/3/4 — onboarding push scheduler (runs every 30 min). Targets recent signups
// based on time-since-registration + local time-of-day + state. Orchestrator dedup makes each
// step once-only; the new-user marketing cap (1/day) keeps week-1 gentle.
//   ON-2 first pick   (no pick, 2–30h after signup, 09:00–21:00 local)        P1
//   ON-3 coins        (no pick, 6–30h, 18:00–21:00 local)                      P2
//   ON-4 join a game  (no game, 20–52h, 09:00–11:00 local morning)            P1
// ?testUser=<id> sends ON-2 to that user immediately (bypasses windows/state) for testing.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' }
const localHour = (tz: string): number => {
  try { return parseInt(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(new Date()), 10) % 24 }
  catch { return -1 }
}

const STEPS = {
  'ON-2': { priority: 1, route: 'sportime://matches', title: 'Ready for your first pick? 🎯', message: 'Pick a match before kickoff and start your run.' },
  'ON-3': { priority: 2, route: 'sportime://matches', title: "You've got coins to play 🪙", message: 'Spend them on your first prediction — best place to start.' },
  'ON-4': { priority: 1, route: 'sportime://games', title: 'Join your first game 🏆', message: "Pick'em, Fantasy, Predictions & Tournament Quests — play with your free tickets." },
} as const

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: s })
  try {
    const SUPA_URL = Deno.env.get('SUPABASE_URL') ?? ''
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const sb = createClient(SUPA_URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })
    const testUser = new URL(req.url).searchParams.get('testUser')

    const send = (userId: string, key: keyof typeof STEPS) => {
      const s = STEPS[key]
      return fetch(`${SUPA_URL}/functions/v1/notify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE}` },
        body: JSON.stringify({ userId, notifKey: key, category: 'onboarding', priority: s.priority, prefType: 'system', title: s.title, message: s.message, route: s.route, dedupKey: `${key}:${userId}` }),
      }).then(x => x.json()).catch(() => null)
    }

    if (testUser) { const r = await send(testUser, 'ON-2'); return json({ ok: true, test: true, result: r?.status }) }

    const { data: rows, error } = await sb.rpc('onboarding_candidates')
    if (error) throw error

    let sent = 0
    for (const r of (rows ?? []) as any[]) {
      const h = Number(r.hours_since_reg), lh = localHour(r.timezone)
      const due: (keyof typeof STEPS)[] = []
      if (!r.has_pick && h >= 2 && h <= 30 && lh >= 9 && lh <= 21) due.push('ON-2')
      if (!r.has_pick && h >= 6 && h <= 30 && lh >= 18 && lh <= 21) due.push('ON-3')
      if (!r.has_game && h >= 20 && h <= 52 && lh >= 9 && lh <= 11) due.push('ON-4')
      for (const key of due) {
        const res = await send(r.user_id, key)
        if (res?.status === 'sent' || res?.status === 'held') sent++
      }
    }
    return json({ ok: true, candidates: (rows ?? []).length, sent })
  } catch (e) {
    console.error('[notify-onboarding] error:', e)
    return json({ ok: false, error: String((e as any)?.message ?? e) }, 400)
  }
})
