import { createClerkClient } from '@clerk/backend'
import {
  type AuthorizationDefinition,
  type ConnectionPrincipal,
  ConnectionAuthorizationFailedError,
  ConnectionAuthorizationRequiredError,
  defineInteractiveAuthorization,
} from 'eve/connections'
import type { ToolContext } from 'eve/tools'
import type { ClerkClient } from '@clerk/backend'

/**
 * The OAuth providers Clerk can broker
 */

export type ClerkOAuthProvider = Parameters<
  ClerkClient['users']['getUserOauthAccessToken']
>[1]

export type ClerkConnectOptions = {
  /** Extra provider scopes to require, e.g. `['repo']` for GitHub. */
  readonly scopes?: readonly string[]
  /**
   * Dashboard route that runs the Clerk connect flow. The interactive
   * challenge points the caller at `${connectPath}/${provider}`. Default
   * `/connect`.
   */
  readonly connectPath?: string
  /** Provider name shown in the consent prompt (defaults to the provider). */
  readonly displayName?: string
  /**
   * OIDC `prompt` value forwarded to the provider's authorize URL (via Clerk's
   * `oidcPrompt`). Forces the account/consent screens instead of silently
   * reusing a prior authorization. Default `'select_account consent'`; pass
   * `''` to disable. (GitHub honors `consent` to re-show the scope/org grant
   * and ignores `select_account`, which is single-account.)
   */
  readonly prompt?: string
  /** Clerk secret key. Defaults to `CLERK_SECRET_KEY`. */
  readonly secretKey?: string
}

/**
 * Reads the caller's stored provider token from Clerk. Returns `null` when
 * the provider isn't connected or the token is missing a required scope (so
 * the caller is sent back through the connect flow to grant it).
 */
async function readProviderToken(
  secretKey: string | undefined,
  userId: string,
  provider: ClerkOAuthProvider,
  requiredScopes: readonly string[]
): Promise<string | null> {
  const clerk = createClerkClient({
    secretKey: secretKey ?? process.env.CLERK_SECRET_KEY,
  })
  const res = await clerk.users.getUserOauthAccessToken(userId, provider)
  const entry = res.data[0]
  if (!entry?.token) return null
  if (requiredScopes.length) {
    const granted = new Set(entry.scopes ?? [])
    if (!requiredScopes.every(scope => granted.has(scope))) return null
  }
  return entry.token
}

/**
 * Interactive tool `auth` backed by Clerk's brokered OAuth, modeled on
 * `connect("...")` from `@vercel/connect/eve`:
 *
 * ```ts
 * export default defineTool({
 *   description: "List the caller's GitHub repositories.",
 *   inputSchema: z.object({}),
 *   auth: clerkConnect('github', { scopes: ['repo'] }),
 *   async execute(_input, ctx) {
 *     const { token } = await ctx.getToken()
 *     // call the provider API with `token`
 *   },
 * })
 * ```
 *
 * `getToken` reads the caller's stored provider token from Clerk
 * (`getUserOauthAccessToken`). When it's missing — or missing a required
 * scope — it throws so eve drives the interactive flow: `startAuthorization`
 * returns a challenge URL pointing at a dashboard page that runs Clerk's
 * frontend connect (`createExternalAccount`) and redirects back to eve's
 * `callbackUrl`; `completeAuthorization` then re-reads the now-stored token.
 *
 * Interactive auth resolves a `principalType: 'user'` principal, so this only
 * fires for signed-in user callers. Machine callers (API keys minted for a
 * user) can't complete a browser consent — use {@link clerkOAuthToken} inside
 * `execute` for them.
 */
export function clerkConnect(
  provider: ClerkOAuthProvider,
  options: ClerkConnectOptions = {}
): AuthorizationDefinition {
  const {
    scopes = [],
    connectPath = '/connect',
    prompt = 'select_account consent',
    secretKey,
    displayName,
  } = options

  const tokenFor = (principal: ConnectionPrincipal) => {
    if (principal.type !== 'user') {
      throw new ConnectionAuthorizationRequiredError(provider, {
        message: `Connecting ${provider} requires a signed-in user.`,
      })
    }
    return readProviderToken(secretKey, principal.id, provider, scopes)
  }

  return defineInteractiveAuthorization({
    displayName: displayName ?? provider,
    getToken: async ({ principal }) => {
      const token = await tokenFor(principal)
      if (!token) {
        throw new ConnectionAuthorizationRequiredError(provider, {
          message: `Connect your ${provider} account to continue.`,
        })
      }
      return { token }
    },
    startAuthorization: async ({ callbackUrl }) => {
      const params = new URLSearchParams({ return: callbackUrl })
      if (scopes.length) params.set('scopes', scopes.join(' '))
      if (prompt) params.set('prompt', prompt)
      return {
        challenge: {
          url: `${connectPath}/${provider}?${params.toString()}`,
          displayName: displayName ?? provider,
        },
      }
    },
    completeAuthorization: async ({ principal }) => {
      const token = await tokenFor(principal)
      if (!token) {
        throw new ConnectionAuthorizationFailedError(provider, {
          message: `${provider} did not return an access token after connecting.`,
          reason: 'no_token',
          retryable: false,
        })
      }
      return { token }
    },
  })
}

export type ClerkOAuthTokenResult =
  | { readonly token: string }
  | { readonly token: null; readonly reason: 'no_user' | 'not_connected' }

/**
 * Non-interactive Clerk OAuth token resolver for use *inside* a tool's
 * `execute`. Unlike {@link clerkConnect}, this works for machine callers —
 * an API key minted for a user — by reading the user id from the principal's
 * attributes. There's no browser consent: a missing connection returns
 * `{ token: null, reason: 'not_connected' }` for the tool to surface.
 *
 * ```ts
 * async execute(_input, ctx) {
 *   const result = await clerkOAuthToken(ctx, 'github', { scopes: ['repo'] })
 *   if (!result.token) return { error: true, message: 'Connect GitHub to continue.' }
 *   // call the provider API with result.token
 * }
 * ```
 */
export async function clerkOAuthToken(
  ctx: ToolContext,
  provider: ClerkOAuthProvider,
  options: {
    readonly scopes?: readonly string[]
    readonly secretKey?: string
  } = {}
): Promise<ClerkOAuthTokenResult> {
  const auth = ctx.session.auth.current
  const userId = resolveUserId(auth)
  if (!userId) return { token: null, reason: 'no_user' }
  const token = await readProviderToken(
    options.secretKey,
    userId,
    provider,
    options.scopes ?? []
  )
  return token ? { token } : { token: null, reason: 'not_connected' }
}

/**
 * The Clerk user id behind a caller: the principal id for a signed-in user,
 * or the `userId` attribute for an API key minted for a user. `undefined`
 * for pure machine callers (M2M), which have no user OAuth tokens.
 */
function resolveUserId(
  auth: ToolContext['session']['auth']['current']
): string | undefined {
  if (!auth) return undefined
  if (auth.principalType === 'user') return auth.principalId
  const userId = auth.attributes.userId
  return typeof userId === 'string' ? userId : undefined
}
