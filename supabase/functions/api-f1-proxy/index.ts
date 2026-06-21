// deno-lint-ignore-file no-explicit-any
// Server-side proxy for the api-sports Formula-1 API (keeps the key off the client).
// Mirrors api-football-proxy but targets the F1 host. Same API key (api-sports account).
import 'jsr:@supabase/functions-js'

const F1_HOST = 'v1.formula-1.api-sports.io'

Deno.serve(async (req) => {
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

    const url = new URL(`https://${F1_HOST}${path}`)
    Object.entries(params ?? {}).forEach(([k, v]) => url.searchParams.set(k, String(v)))

    const upstream = await fetch(url, {
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': F1_HOST
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

function cors(req: Request) {
  const origin = req.headers.get('origin') ?? '*'
  return {
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': '*'
  }
}
