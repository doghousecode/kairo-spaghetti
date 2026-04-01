import type { RequestContext } from '@vercel/edge'

export default function middleware(_request: Request, _context: RequestContext) {
  // Password requirement temporarily disabled
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.svg$|.*\\.ico$|manifest\\.json$|sw\\.js$).*)',
  ],
}
