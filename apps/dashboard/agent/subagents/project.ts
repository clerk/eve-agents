import { clerkM2MToken } from '@clerk/eve-auth/m2m'
import { defineRemoteAgent } from 'eve'
import { bearer } from 'eve/agents/auth'

// main-agent delegates to project-agent over M2M. `clerkM2MToken()` mints from
// this agent's CLERK_MACHINE_SECRET_KEY; project-agent verifies with its own.
export default defineRemoteAgent({
  url: process.env.PROJECT_AGENT_URL ?? 'http://127.0.0.1:3002',
  description:
    'Delegates project management tasks (archive, restore, list) to the project agent.',
  auth: bearer(clerkM2MToken()),
})
