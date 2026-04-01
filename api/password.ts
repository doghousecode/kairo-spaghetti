export const config = { runtime: 'edge' }

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: { password?: string }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!body.password) {
    return new Response(JSON.stringify({ error: 'Password required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (body.password !== process.env.SITE_PASSWORD) {
    return new Response(JSON.stringify({ error: 'Incorrect password' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie':
        'kairo-auth=granted; Path=/; Domain=.meetkairo.ai; Max-Age=2592000; SameSite=Lax; Secure; HttpOnly',
    },
  })
}
