import { createClerkClient } from '@clerk/backend'
import type { ClerkClient, ClerkOptions } from '@clerk/backend'
import type { TokenType } from '@clerk/backend/internal'
import {
  ForbiddenError,
  UnauthenticatedError,
  type AuthFn,
} from 'eve/channels/auth'

export {
  clerkInstructions,
  type ClerkInstructionsCallback,
  type ClerkInstructionsResult,
} from './instructions.js'

/**
 * Raw Clerk request state returned by `authenticateRequest`. Surfaced to
 * `handleAuth` so callers can inspect `isAuthenticated`, `tokenType`, `reason`,
 * or call `toAuth()` themselves. `null` when verification threw (e.g. malformed
 * token).
 */
export type ClerkRequestState = Awaited<
  ReturnType<ClerkClient['authenticateRequest']>
> | null

export type HandleClerkAuth = (
  state: ClerkRequestState
) => void | Promise<void>

export type ClerkAuthOptions<
  T extends readonly TokenType[] = readonly TokenType[],
> = {
  /**
   * Options forwarded to `createClerkClient` (secret/publishable keys, machine
   * secret, JWT key, domain, etc.). Each field falls back to the matching env
   * var when omitted.
   */
  clientOptions?: ClerkOptions
  /**
   * Restrict which Clerk token types this authenticator accepts. Defaults to
   * all four (`'session_token'`, `'api_key'`, `'m2m_token'`, `'oauth_token'`)
   * when omitted, matching Clerk's `acceptsToken: 'any'`.
   */
  acceptsToken?: T
  /**
   * Required permissions for session-token callers. After auth succeeds, each
   * permission is checked via Clerk's `has({ permission })`. A missing
   * permission throws an eve `ForbiddenError` (403).
   */
  permissions?: string[]
  /**
   * Allowed org roles for session-token callers. The caller's `orgRole` must
   * match one of the entries; missing role or non-matching role throws an eve
   * `ForbiddenError` (403).
   */
  allowedRoles?: string[]
  /**
   * Required scopes for API-key callers. A missing scope throws an eve
   * `ForbiddenError` (403). M2M tokens don't have a matching option: the
   * machine-to-machine scope is verified by Clerk's `authenticateRequest`
   * using `machineSecretKey` against the caller machine's `scoped_machines`.
   */
  apiKeyScopes?: string[]
  /**
   * Inspect the raw Clerk request state after `authenticateRequest` returns.
   * Receives the same object Clerk produces (with `isAuthenticated`,
   * `tokenType`, `reason`, `toAuth()`, etc.) or `null` if verification threw.
   *
   * Throw to reject with a custom error (e.g. `UnauthenticatedError`,
   * `ForbiddenError`). Return `void` to let the standard flow continue.
   *
   * When both `handleAuth` and `onUnauthenticated` are set, `handleAuth` runs
   * first; `onUnauthenticated` only fires if the request is still
   * unauthenticated after.
   */
  handleAuth?: HandleClerkAuth
  /**
   * What to do when the request is not authenticated by Clerk.
   *
   *  - `'skip'` (default): return `null` so the chain walks to the next authenticator.
   *  - `'throw'`: throw an eve `UnauthenticatedError` to short-circuit with a 401.
   */
  onUnauthenticated?: 'skip' | 'throw'
}

/**
 * An eve route-auth `AuthFn` that verifies Clerk callers — session tokens, API
 * keys, M2M tokens, and OAuth tokens — and maps them to an eve principal.
 *
 *   auth: [clerkAuth(), localDev(), vercelOidc()]
 *
 * By default returns `null` on failure so the chain walks to the next
 * authenticator. Set `onUnauthenticated: 'throw'` to reject with a 401 instead,
 * or pass `handleAuth` for full custom inspection. Pass `permissions`,
 * `allowedRoles`, or `apiKeyScopes` to enforce authorization after auth
 * succeeds (each missing entry throws `ForbiddenError`).
 */
export function clerkAuth<
  const T extends readonly TokenType[] = readonly TokenType[],
>(options: ClerkAuthOptions<T> = {}): AuthFn<Request> {
  const {
    clientOptions = {},
    acceptsToken,
    permissions,
    allowedRoles,
    apiKeyScopes,
    handleAuth,
    onUnauthenticated = 'skip',
  } = options

  const clerk = createClerkClient({
    ...clientOptions,
    secretKey: clientOptions.secretKey ?? process.env.CLERK_SECRET_KEY,
    // The publishable key is public. Prefer the Next-exposed var, since the
    // agent runs inside the dashboard's runtime (via withEve) where that's the
    // one that's set; fall back to CLERK_PUBLISHABLE_KEY for a standalone agent.
    publishableKey:
      clientOptions.publishableKey ??
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ??
      process.env.CLERK_PUBLISHABLE_KEY,
  })
  const machineSecretKey =
    clientOptions.machineSecretKey ?? process.env.CLERK_MACHINE_SECRET_KEY

  return async request => {
    // Authenticate from the session cookie OR a bearer token (API key, M2M,
    // OAuth). Don't short-circuit on a missing Authorization header — the
    // dashboard's same-origin calls carry a Clerk session cookie, not a bearer.
    // A non-Clerk request (e.g. a Vercel OIDC token) throws or comes back
    // unauthenticated; by default the walk falls through to the next
    // authenticator, but `onUnauthenticated: 'throw'` can short-circuit.
    const state = await clerk
      .authenticateRequest(request, {
        // Cast keeps Clerk's overload on the wide 'any' branch so `toAuth()`
        // returns the full SignedIn | Machine union; the runtime value is still
        // the narrowed array when `acceptsToken` was provided.
        acceptsToken: (acceptsToken ? [...acceptsToken] : 'any') as 'any',
        machineSecretKey,
      })
      .catch(() => null)

    // Cast only at the handleAuth boundary so `state`'s inferred type (which
    // preserves the discriminator) is what flows into `toAuth()` below.
    if (handleAuth) await handleAuth(state as ClerkRequestState)

    if (!state?.isAuthenticated) {
      if (onUnauthenticated === 'throw') {
        throw new UnauthenticatedError({
          code: 'authentication_required',
          message: `Clerk auth failed (${state?.reason ?? 'unknown'})`,
        })
      }
      return null
    }

    const auth = state.toAuth()

    // Session token: a signed-in human user.
    if (auth.tokenType === 'session_token') {
      if (permissions?.length) {
        for (const permission of permissions) {
          if (!auth.has({ permission })) {
            throw new ForbiddenError({
              message: `Missing required permission: ${permission}`,
            })
          }
        }
      }

      if (allowedRoles?.length) {
        if (!auth.orgRole || !allowedRoles.includes(auth.orgRole)) {
          throw new ForbiddenError({
            message: `Role "${auth.orgRole ?? 'none'}" is not allowed.`,
          })
        }
      }

      const attributes: Record<string, string | readonly string[]> = {
        tokenType: auth.tokenType,
      }

      if (auth.orgId) attributes.orgId = auth.orgId
      if (auth.orgRole) attributes.role = auth.orgRole
      if (auth.orgPermissions?.length)
        attributes.permissions = auth.orgPermissions
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
    if (auth.tokenType === 'api_key' && apiKeyScopes?.length) {
      const presentScopes = auth.scopes ?? []
      for (const scope of apiKeyScopes) {
        if (!presentScopes.includes(scope)) {
          throw new ForbiddenError({
            message: `Missing required scope: ${scope}`,
          })
        }
      }
    }

    const attributes: Record<string, string | readonly string[]> = {
      tokenType: auth.tokenType,
    }
    if (auth.scopes?.length) attributes.scopes = auth.scopes

    if (auth.tokenType === 'api_key') {
      // userId and orgId are mutually exclusive based on the key's subject.
      if (auth.userId) attributes.userId = auth.userId
      if (auth.orgId) attributes.orgId = auth.orgId
    }

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
