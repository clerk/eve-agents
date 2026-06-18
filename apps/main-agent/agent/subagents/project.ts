import { clerkM2MToken } from '@clerk/eve-auth'
import { defineRemoteAgent } from 'eve'
import { bearer } from 'eve/agents/auth'

// Remote-agent subagent: main-agent delegates project tasks to the separately
// running project-agent (its `eve dev` URL), authenticating the agent-to-agent
// call with a Clerk M2M token minted from this agent's machine secret key.
//
// `clerkM2MToken()` defaults to CLERK_MACHINE_SECRET_KEY, which `agents-dev`
// writes for every project, so no explicit key is needed here.
//
// The token is scope-checked on the other side: main-agent's machine must be
// scoped to project-agent's machine in Clerk, and project-agent verifies with
// its own machine secret key.
export default defineRemoteAgent({
  url: process.env.PROJECT_AGENT_URL ?? 'http://127.0.0.1:3002',
  description:
    'Delegates project management tasks (archive, restore, list) to the project agent.',
  auth: bearer(clerkM2MToken()),
})
