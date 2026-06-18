import { createClerkClient } from '@clerk/backend'
import type { ClerkClient, ClerkOptions } from '@clerk/backend'
import type { AuthFn } from 'eve/channels/auth'

// The agents.json graph shape, served by the dashboard and built by the
// `eve-agents` CLI. Re-exported here so both get the types from the package
// root, along with the Clerk machine/scope helpers the CLI builds on.
export type {
  Agent,
  AgentGraph,
  AgentModel,
  ToolInfo,
  RemoteAgentRef,
} from '../utils/agents'
export type { AgentLike, PendingConnection } from '../utils/connections'
export {
  managedScopesById,
  pendingFromAgents,
  pendingFromProjects,
} from '../utils/connections'
export type { ManagedMachine } from '../utils/machines'
export {
  linkMachineScopes,
  listManagedMachines,
  MACHINE_PREFIX,
  machineName,
  revokeMachineTokens,
} from '../utils/machines'

/**
 * An eve route-auth `AuthFn` that verifies Clerk callers — session tokens, API
 * keys, M2M tokens, and OAuth tokens — and maps them to an eve principal.
 *
 *   auth: [clerkAuth(), localDev(), vercelOidc()]
 *
 * A non-Clerk token (e.g. a Vercel OIDC JWT) simply fails Clerk verification and
 * returns `null`, so the walk falls through to the next authenticator.
 */
export function clerkAuth(options: ClerkOptions = {}): AuthFn<Request> {
  const clerk = createClerkClient({
    secretKey: options.secretKey ?? process.env.CLERK_SECRET_KEY,
    publishableKey:
      options.publishableKey ?? process.env.CLERK_PUBLISHABLE_KEY,
  })
  const machineSecretKey =
    options.machineSecretKey ?? process.env.CLERK_MACHINE_SECRET_KEY

  return async request => {
    // Authenticate from the session cookie OR a bearer token (API key, M2M,
    // OAuth). Don't short-circuit on a missing Authorization header — the
    // dashboard's same-origin calls carry a Clerk session cookie, not a bearer.
    // A non-Clerk request (e.g. a Vercel OIDC token) throws or comes back
    // unauthenticated, so the walk falls through to the next authenticator.
    const state = await clerk
      .authenticateRequest(request, { acceptsToken: 'any', machineSecretKey })
      .catch(() => null)

    if (!state?.isAuthenticated) return null

    const auth = state.toAuth()

    // Session token: a signed-in human user.
    if (auth.tokenType === 'session_token') {
      const attributes: Record<string, string> = {
        tokenType: auth.tokenType,
      }

      if (auth.orgId) attributes.orgId = auth.orgId
      if (auth.orgRole) attributes.orgRole = auth.orgRole
      const name = auth.sessionClaims?.name

      if (typeof name === 'string') attributes.name = name

      return {
        attributes,
        authenticator: 'clerk',
        principalType: 'user',
        principalId: auth.userId,
        subject: auth.userId,
      }
    }

    // Machine caller (API key, M2M, OAuth). `subject` and `scopes` are shared.
    const attributes: Record<string, string | readonly string[]> = {
      tokenType: auth.tokenType,
    }
    if (auth.scopes?.length) attributes.scopes = auth.scopes

    if (auth.tokenType === 'oauth_token') {
      attributes.userId = auth.userId
      attributes.clientId = auth.clientId
    }

    return {
      attributes,
      authenticator: 'clerk',
      principalType: 'machine',
      principalId: auth.subject,
      subject: auth.subject,
    }
  }
}

type CreateM2MTokenParams = NonNullable<
  Parameters<ClerkClient['m2m']['createToken']>[0]
>

export type ClerkM2MTokenOptions = {
  secretKey?: string
} & CreateM2MTokenParams

/**
 * Returns a lazy resolver that mints a Clerk M2M token from the caller's machine
 * secret key. Pass it to eve's `bearer(...)` for remote-agent outbound auth:
 *
 *   auth: bearer(clerkM2MToken({ machineSecretKey: process.env.MAIN_MACHINE_SECRET_KEY }))
 *
 */
export function clerkM2MToken(options: ClerkM2MTokenOptions = {}) {
  const clerk = createClerkClient({
    secretKey: options.secretKey ?? process.env.CLERK_SECRET_KEY,
  })

  return async (): Promise<string> => {
    const m2m = await clerk.m2m.createToken({
      machineSecretKey:
        options.machineSecretKey ?? process.env.CLERK_MACHINE_SECRET_KEY,
      secondsUntilExpiration: options.secondsUntilExpiration ?? 300,
      minRemainingTtlSeconds: options.minRemainingTtlSeconds ?? 60,
    })
    return m2m.token as string
  }
}
