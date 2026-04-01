export default function middleware(request: Request) {
  const cookieHeader = request.headers.get('cookie') ?? ''
  const auth = cookieHeader
    .split(';')
    .map(c => c.trim().split('='))
    .find(([key]) => key === 'kairo-auth')?.[1]

  if (auth !== 'granted') {
    return Response.redirect('https://meetkairo.ai/password')
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.svg$|.*\\.ico$|manifest\\.json$|sw\\.js$).*)',
  ],
}
