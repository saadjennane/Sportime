// deno-lint-ignore-file no-explicit-any
// Keep the import that works for you (this one avoids the export error):
import 'jsr:@supabase/functions-js'

Deno.serve(async (req) => {
  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors(req) })
  }

  try {
    const { path, params } = (await req.json()) as {
      path: string
      params?: Record<string, any>
    }
    if (!path?.startsWith('/')) {
      return json({ error: 'Invalid path' }, 400, req)
    }

    const apiKey = Deno.env.get('API_FOOTBALL_KEY')
    if (!apiKey) return json({ error: 'Missing API key' }, 500, req)

    const url = new URL(`https://v3.football.api-sports.io${path}`)
    Object.entries(params ?? {}).forEach(([k, v]) => url.searchParams.set(k, String(v)))

    const upstream = await fetch(url, {
      // Use the same headers you already validated earlier
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': 'v3.football.api-sports.io'
      }
    })

    const text = await upstream.text()
    return new Response(text, {
      status: upstream.status,
      headers: { 'content-type': 'application/json', ...cors(req) }
    })
  } catch (e) {
    return json({ error: (e as Error).message }, 500, req)
  }
})

function json(body: unknown, status = 200, req: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...cors(req) }
  })
}

// IMPORTANT: echo Origin + allow ALL headers (fixes `apikey` preflight)
function cors(req: Request) {
  const origin = req.headers.get('origin') ?? '*'
  return {
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    // wildcard so Supabase JS `apikey` is accepted in preflight
    'Access-Control-Allow-Headers': '*'
  }
}
