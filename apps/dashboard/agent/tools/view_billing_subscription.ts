import { defineTool } from 'eve/tools'
import { z } from 'zod'
import { requirePermissions, requireTokenType } from '@/lib/agent-utils'

const PERMISSION = 'org:sys_billing:read'

export default defineTool({
  description:
    "View the caller's current organization's billing subscription.",
  inputSchema: z.object({}),
  execute: async (_input, ctx) => {
    const auth = ctx.session.auth.current

    // Only session_token and api_key callers carry `orgId` on the principal,
    // so only those can resolve a target org for the Backend API call.
    const tokenError = requireTokenType(
      ['session_token', 'api_key'],
      auth,
      'Sign in or call with an org-scoped Clerk API key to view billing.'
    )
    if (tokenError) return tokenError

    const permError = requirePermissions(auth, [PERMISSION])
    if (permError) return permError

    const orgId = auth?.attributes.orgId
    if (typeof orgId !== 'string') {
      return {
        error: true,
        message:
          'Switch into an organization to view its billing subscription.',
      }
    }

    const res = await fetch(
      `https://api.clerk.com/v1/organizations/${orgId}/billing/subscription`,
      {
        headers: {
          authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
        },
      }
    )
    if (!res.ok) {
      const body = await res.text()
      console.error(
        '[view_billing_subscription] clerk error',
        res.status,
        body
      )
      return {
        error: true,
        message: `Clerk Backend API error (${res.status}).`,
      }
    }
    return await res.json()
  },
})
