import type { SessionAuthContext } from 'eve/context'
import { AgentError, type AgentErrorMessage } from './agent-errors'

type Auth = SessionAuthContext | null | undefined

// Clerk's four token types. The `tokenType` attribute is written by the
// `clerkAuth()` channel helper for every accepted principal.
export type ClerkTokenType =
  | 'session_token'
  | 'api_key'
  | 'm2m_token'
  | 'oauth_token'

// Coerce an attribute that may be a string, a readonly string array, or
// missing into a readable array. Clerk writes permissions/scopes as arrays;
// other attributes (orgId, role) are strings.
function asStringArray(
  value: string | readonly string[] | undefined
): readonly string[] {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') return [value]
  return []
}

export function isSessionAuth(auth: Auth): auth is SessionAuthContext {
  return auth?.attributes.tokenType === 'session_token'
}

export function isApiKeyAuth(auth: Auth): auth is SessionAuthContext {
  return auth?.attributes.tokenType === 'api_key'
}

// Require the caller to have authenticated with one of the listed Clerk
// token types. Returns an agent-friendly error when the type doesn't match
// (or the caller is unauthenticated), `null` when it does. Use this when a
// tool only makes sense for a subset of callers — e.g. an org-scoped
// endpoint that needs `orgId`, which only `session_token` and `api_key`
// callers carry on the principal.
export function requireTokenType(
  allowed: readonly ClerkTokenType[],
  auth: Auth,
  message?: string
): AgentErrorMessage | null {
  const received = auth?.attributes.tokenType
  if (
    typeof received === 'string' &&
    allowed.includes(received as ClerkTokenType)
  ) {
    return null
  }
  return new AgentError(
    'invalid_token_type',
    message ??
      `This tool requires one of these Clerk token types: ${allowed.join(', ')}.`,
    { allowed, received: typeof received === 'string' ? received : 'none' }
  ).toMessage()
}

// Require the caller to carry every named Clerk permission. Returns an
// agent-friendly error naming the first missing permission, or `null` when
// all are present. Reads from `attributes.permissions`, which the clerkAuth()
// helper writes for session-token callers.
export function requirePermissions(
  auth: Auth,
  permissions: readonly string[]
): AgentErrorMessage | null {
  const present = new Set(asStringArray(auth?.attributes.permissions))
  const missing = permissions.find(p => !present.has(p))
  if (!missing) return null
  return new AgentError(
    'permission_missing',
    `You're missing the \`${missing}\` permission.`,
    { permission: missing }
  ).toMessage()
}
