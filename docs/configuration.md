# Configuring `clerkAuth()`

`clerkAuth()` verifies any Clerk token type and maps the caller to an eve principal. Default behavior returns `null` on failure so the chain walks to the next authenticator. Every option below is opt-in — combine them freely.

## Basic usage

```ts
// agent/channels/eve.ts
import { clerkAuth } from '@clerk/eve-auth'
import { eveChannel } from 'eve/channels/eve'

export default eveChannel({
  auth: [clerkAuth()],
})
```

## Restrict which token types you accept

```ts
export default eveChannel({
  auth: [clerkAuth({ acceptsToken: ['session_token', 'api_key'] })],
})
```

## Use API Key from environment variable

```ts
export default eveChannel({
  auth: [clerkAuth({ eveApiKeyEnvVar: 'EVE_API_KEY' })],
})
```

## Require permissions for session callers

Each missing entry throws `ForbiddenError` (403).

```ts
export default eveChannel({
  auth: [
    clerkAuth({
      acceptsToken: ['session_token'],
      permissions: ['org:projects:archive'],
    }),
  ],
})
```

## Restrict to specific org roles

Missing or non-matching `orgRole` throws `ForbiddenError` (403).

```ts
export default eveChannel({
  auth: [
    clerkAuth({
      acceptsToken: ['session_token'],
      allowedRoles: ['org:admin', 'org:billing_manager'],
    }),
  ],
})
```

## Require scopes for API key callers

M2M tokens don't need this — Clerk's `authenticateRequest` already verifies the machine-to-machine scope using `CLERK_MACHINE_SECRET_KEY`.

```ts
export default eveChannel({
  auth: [
    clerkAuth({
      acceptsToken: ['api_key'],
      apiKeyScopes: ['projects:write'],
    }),
  ],
})
```

## Reject unauthenticated requests instead of falling through

```ts
export default eveChannel({
  auth: [clerkAuth({ onUnauthenticated: 'throw' })],
})
```

## Inspect the raw Clerk request state

`handleAuth` runs first and receives the full state Clerk produced.

```ts
// agent/channels/eve.ts
import { clerkAuth } from '@clerk/eve-auth'
import { UnauthenticatedError } from 'eve/channels/auth'
import { eveChannel } from 'eve/channels/eve'

export default eveChannel({
  auth: [
    clerkAuth({
      handleAuth: state => {
        if (state?.tokenType === 'session_token' && state.reason === 'token-expired') {
          throw new UnauthenticatedError({
            code: 'session_expired',
            message: 'Sign in again to continue.',
          })
        }
      },
    }),
  ],
})
```

## Override the Clerk client config

```ts
export default eveChannel({
  auth: [
    clerkAuth({
      clientOptions: {
        secretKey: process.env.CUSTOM_CLERK_SECRET,
        jwtKey: process.env.CLERK_JWT_KEY,
      },
    }),
  ],
})
```

> [!NOTE]
> When omitted, these fields default to env vars:
> - `secretKey` → `CLERK_SECRET_KEY`
> - `publishableKey` → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, falling back to `CLERK_PUBLISHABLE_KEY`
> - `machineSecretKey` → `CLERK_MACHINE_SECRET_KEY`
