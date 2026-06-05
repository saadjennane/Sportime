import { serve } from 'https://deno.land/std@0.210.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing Supabase environment variables for create-guest-user')
}

const adminClient = createClient(SUPABASE_URL ?? '', SERVICE_ROLE_KEY ?? '', {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

function randomPassword(length = 32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  return Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const password = randomPassword()
    const guestEmail = `guest-${crypto.randomUUID()}@guest.sportime`

    let username = `Recruit${Date.now()}`
    const { data: usernameData, error: usernameError } = await adminClient.rpc('generate_guest_username')
    if (usernameError) {
      console.warn('[create-guest-user] generate_guest_username failed, using fallback', usernameError)
    } else if (usernameData) {
      username = usernameData
    }

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email: guestEmail,
      password,
      email_confirm: true,
      user_metadata: {
        user_type: 'guest',
        username,
        generated_guest: true,
      },
    })

    if (createError || !created?.user) {
      console.error('[create-guest-user] Failed to create auth user', createError)
      return new Response(JSON.stringify({ error: 'Failed to create guest user', details: createError }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const authUser = created.user

    const { error: profileError } = await adminClient
      .from('users')
      .update({
        username,
        display_name: username,
        user_type: 'guest',
      })
      .eq('id', authUser.id)

    if (profileError) {
      console.error('[create-guest-user] Failed to update profile', profileError)
      return new Response(JSON.stringify({ error: 'Failed to finalise guest profile', details: profileError }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({
        userId: authUser.id,
        email: guestEmail,
        password,
        username,
      }),
      {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('[create-guest-user] Unexpected error', error)
    return new Response(JSON.stringify({ error: 'Unexpected error creating guest user' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
