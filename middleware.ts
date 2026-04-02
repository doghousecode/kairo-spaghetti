import type { RequestContext } from '@vercel/edge'

export default function middleware(request: Request, _context: RequestContext) {
  const { pathname } = new URL(request.url)

  if (pathname.startsWith('/password') || pathname.startsWith('/api/password')) {
    return
  }

  const cookieHeader = request.headers.get('cookie') ?? ''
  const auth = cookieHeader
    .split(';')
    .map(c => c.trim().split('='))
    .find(([key]) => key === 'kairo-auth')?.[1]

  if (auth !== 'granted') {
    return Response.redirect(new URL('/password', request.url))
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.svg$|.*\\.ico$|manifest\\.json$|sw\\.js$).*)',
  ],
}
