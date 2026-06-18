import { clerkAuth } from '@clerk/eve-auth'
import { type AuthFn, vercelOidc } from 'eve/channels/auth'
import { eveChannel } from 'eve/channels/eve'

// Demo helper: the dashboard's "Unauthenticated" flow sends a `no-auth-demo`
// header. The browser can't drop its same-origin session cookie, so we strip
// credentials server-side before Clerk sees them, forcing a real 401.
function clerkAuthWithDemo(): AuthFn<Request> {
  const inner = clerkAuth()
  return request => {
    if (!request.headers.get('no-auth-demo')) return inner(request)
    const headers = new Headers(request.headers)
    headers.delete('cookie')
    headers.delete('authorization')
    return inner(new Request(request.url, { method: request.method, headers }))
  }
}

export default eveChannel({
  auth: [
    // Verify Clerk callers (session tokens, API keys, M2M, OAuth). No localDev:
    // unauthenticated requests are rejected even on localhost, so the auth-flow
    // demo can show a real 401.
    clerkAuthWithDemo(),
    // Vercel deployment-to-deployment trust (TUI, internal callers).
    vercelOidc(),
  ],
})
