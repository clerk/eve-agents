import type { SessionAuthContext } from 'eve/context'
import {
  defineDynamic,
  defineInstructions,
  type DynamicResolveContext,
} from 'eve/instructions'

/**
 * Anything a {@link ClerkInstructionsCallback} may return. A `string` is
 * emitted as-is; an array of sections is filtered for falsy entries
 * (`false`/`null`/`undefined`/empty strings) and joined with blank lines.
 */
export type ClerkInstructionsResult =
  | string
  | readonly (string | false | null | undefined)[]
  | undefined

/**
 * Builds the prompt for a single session start.
 *
 * - `auth` is the active Clerk-backed principal, or `null` when no caller
 *   authenticated.
 * - `userInfo` is a newline-separated `key: value` summary of
 *   `auth.attributes`, built once per call. Empty string when no caller
 *   authenticated, so you can splice it into a section with `&&`.
 * - `ctx` is the raw {@link DynamicResolveContext} for advanced use (session
 *   id, message history, channel metadata).
 */
export type ClerkInstructionsCallback = (
  auth: SessionAuthContext | null,
  userInfo: string,
  ctx: DynamicResolveContext
) => ClerkInstructionsResult | Promise<ClerkInstructionsResult>

function buildUserInfo(auth: SessionAuthContext | null): string {
  if (!auth) return ''
  const lines: string[] = []
  for (const [key, value] of Object.entries(auth.attributes)) {
    const stringValue =
      typeof value === 'string'
        ? value
        : Array.isArray(value) && value.length > 0
          ? value.join(', ')
          : ''
    if (stringValue) lines.push(`${key}: ${stringValue}`)
  }
  return lines.join('\n')
}

/**
 * Factory for `agent/instructions.ts` that wires `defineDynamic` and
 * `defineInstructions` around your callback. The callback runs on every
 * `session.started` event and returns the markdown prompt.
 *
 *   // agent/instructions.ts
 *   import { clerkInstructions } from '@clerk/eve-auth/instructions'
 *
 *   export default clerkInstructions((auth, userInfo) => [
 *     'You are a helpful assistant.',
 *     userInfo && `Caller context:\n${userInfo}`,
 *   ])
 */
export function clerkInstructions(callback: ClerkInstructionsCallback) {
  return defineDynamic({
    events: {
      'session.started': async (_event, ctx) => {
        const auth = ctx.session.auth.current
        const userInfo = buildUserInfo(auth)
        const result = await callback(auth, userInfo, ctx)
        const markdown =
          typeof result === 'string'
            ? result
            : result
              ? result.filter(Boolean).join('\n\n')
              : ''
        return defineInstructions({ markdown })
      },
    },
  })
}
