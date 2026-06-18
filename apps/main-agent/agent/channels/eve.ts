import { clerkAuth } from '@clerk/eve-auth'
import { eveChannel } from 'eve/channels/eve'
import { localDev, vercelOidc } from 'eve/channels/auth'

export default eveChannel({
  auth: [
    // Verify Clerk callers (session tokens, API keys, M2M, OAuth). A non-Clerk
    // token falls through to the authenticators below.
    clerkAuth(),
    // Open on localhost for `eve dev`, the REPL, and local subagent/runtime calls.
    localDev(),
    // Vercel deployment-to-deployment trust (TUI, internal callers).
    vercelOidc(),
  ],
})
