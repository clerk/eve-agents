import { createClerkClient } from '@clerk/backend'
import type { ClerkClient } from '@clerk/backend'

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
 *   auth: bearer(clerkM2MToken({ machineSecretKey: process.env.CLERK_MACHINE_SECRET_KEY }))
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
