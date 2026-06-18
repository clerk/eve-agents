import { clerkAuth } from '@clerk/eve-auth'
import { eveChannel } from 'eve/channels/eve'
import { vercelOidc } from 'eve/channels/auth'

// No localDev(): project-agent is only reached machine-to-machine, so inbound
// callers must present a valid (scope-checked) Clerk M2M token. clerkAuth()
// reads CLERK_MACHINE_SECRET_KEY (this agent's own machine secret) to verify
// and scope-check them — only machines scoped to project-agent are accepted.
export default eveChannel({
  auth: [clerkAuth(), vercelOidc()],
})
