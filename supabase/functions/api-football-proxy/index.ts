/* deno-lint-ignore-file no-explicit-any */


Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() })

  try {
    const { path, params } = (await req.json()) as {
      path: string
      params?: Record<string, any>
    }

    if (!path || !path.startsWith('/')) {
      return json({ error: 'Invalid path' }, 400)
    }

    const apiKey = Deno.env.get('API_FOOTBALL_KEY')
    if (!apiKey) return json({ error: 'Missing API_FOOTBALL_KEY' }, 500)

    // Build target URL
    const url = new URL(`https://v3.football.api-sports.io${path}`)
    Object.entries(params ?? {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
    })

    // Call upstream API
    const upstream = await fetch(url, {
      headers: {
        // La plupart des intégrations directes utilisent ce header :
        'x-apisports-key': apiKey,
        // Compat: si la clé est une clé RapidAPI, ce header marche aussi :
        'x-rapidapi-key': apiKey
      }
    })

    const data = await upstream.json().catch(() => ({}))
    return json(data, upstream.status)
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, content-type'
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders() }
  })
}
