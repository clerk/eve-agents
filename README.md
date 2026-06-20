<p align="center">
  <a href="https://clerk.com?utm_source=github&utm_medium=eve_examples" target="_blank" rel="noopener noreferrer">
    <img src="https://images.clerk.com/static/logo-light-mode-400x400.png" height="64" alt="Clerk logo">
  </a>
  <br />
  <h1 align="center">Eve Agents x Clerk Auth Starter</h1>
</p>

<div align="center">

[![Chat on Discord](https://img.shields.io/discord/856971667393609759.svg?logo=discord)](https://clerk.com/discord)
[![Clerk documentation](https://img.shields.io/badge/documentation-clerk-green.svg)](https://clerk.com/docs?utm_source=github&utm_medium=eve_examples)
[![Follow on X](https://img.shields.io/twitter/follow/clerk?style=social)](https://x.com/intent/follow?screen_name=clerk)

[Get help](https://clerk.com/contact/support?utm_source=github&utm_medium=eve_examples)

</div>

A monorepo showing how to secure [Eve](https://vercel.com/eve) agents with [Clerk](https://clerk.com?utm_source=github&utm_medium=eve_examples), through one small custom auth connector.

It covers three patterns:

- **Authorizing agent endpoints.** A `clerkAuth()` channel `AuthFn` that verifies Clerk session tokens, API keys, M2M tokens, and OAuth tokens, then maps each to an eve principal.
- **M2M auth between agents.** Minting short-lived Clerk M2M tokens so one agent can securely call another.
- **Prefilling dynamic instructions.** Reading the authenticated caller off the session to personalize the agent's instructions per request.

The dashboard's chat has a flow selector so you can call the agent as a signed-in user, as an API key, or unauthenticated, and watch each behave differently.


## Apps and packages

| Workspace | Description |
| --- | --- |
| [`apps/dashboard`](apps/dashboard) | Next.js app (port 3000). Clerk-authenticated chat UI with a flow selector to call the agent as a session user, an API key, or unauthenticated. |
| [`apps/main-agent`](apps/main-agent) | Primary eve agent (port 3001). Its channel accepts Clerk session/API key/M2M/OAuth callers, personalizes instructions from the caller's auth, and delegates project tasks to the project agent over M2M. |
| [`apps/project-agent`](apps/project-agent) | Subagent (port 3002). Reachable machine-to-machine only, so inbound callers must present a scoped Clerk M2M token. Exposes a `manage_project` tool. |
| [`packages/clerk-eve-auth`](packages/clerk-eve-auth) | `@clerk/eve-auth`. The `clerkAuth()` channel authenticator and the `clerkM2MToken()` outbound-token resolver. |

## Installing with shadcn

This repo doubles as a public [shadcn GitHub registry](https://ui.shadcn.com/docs/registry/github), so you can easily pull the `clerkAuth()` helper into any Eve project (regardless of framework) without cloning this repository.

```bash
bunx --bun shadcn@latest add clerk/eve-agents/auth
```

The helper lands at `lib/clerk-auth.ts`. Drop it into your channel's `auth: [...]` list:

```ts
// agent/channels/eve.ts
import { clerkAuth } from '@/lib/clerk-auth'
import { eveChannel } from 'eve/channels/eve'

export default eveChannel({
  auth: [clerkAuth()],
})
```

## Getting started

### Prerequisites

- [Bun](https://bun.sh) 1.3+
- A [Clerk application](https://dashboard.clerk.com/sign-up?utm_source=github&utm_medium=eve_examples) with [API keys](https://clerk.com/docs/authentication/api-keys) and [machine-to-machine](https://clerk.com/docs/machine-to-machine) enabled
- An [AI Gateway](https://vercel.com/docs/ai-gateway) API key (or any AI SDK provider key)

### Setup

```bash
bun install
```

Copy the env files for each agent and fill in `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, and `AI_GATEWAY_API_KEY` in each:

```bash
cp apps/main-agent/.env.example apps/main-agent/.env.local
cp apps/project-agent/.env.example apps/project-agent/.env.local
```

Then create the two Clerk machines and the M2M scope in one shot:

```bash
bun run demo:create-machines
```

The script creates `main-agent` and `project-agent` machines, scopes `main-agent` to `project-agent` (so main can mint M2M tokens for it), and prints each machine's secret key. Copy them into their respective `apps/<name>/.env.local` as `CLERK_MACHINE_SECRET_KEY` before starting the agents.

```bash
bun run dev   # dashboard on http://localhost:3000
```

`bun run dev` boots the dashboard, which starts the main agent (via `withEve`) and the project agent together (via Turborepo sidecar tasks). 

Open [http://localhost:3000](http://localhost:3000), sign in, and chat. Test different auth flows from the dropdown or watch m2m auth in action by asking it to archive a project.

## How it works

### Configuring `clerkAuth()`

`clerkAuth()` is the single helper you compose into your channel's `auth: [...]` list. Out of the box it verifies any Clerk token type, returns `null` on failure (so the chain walks to the next authenticator), and maps the caller to an eve principal.

```ts
auth: [clerkAuth()]
```

Every option below is opt-in. Combine them freely.

**Restrict which token types you accept.** Anything else is treated as unauthenticated.

```ts
clerkAuth({ acceptsToken: ['session_token', 'api_key'] })
```

**Require permissions for session callers.** Each missing entry throws `ForbiddenError` (403).

```ts
clerkAuth({
  acceptsToken: ['session_token'],
  permissions: ['org:projects:archive'],
})
```

**Restrict to specific org roles.** The caller's `orgRole` must be in the list; missing or non-matching throws `ForbiddenError` (403).

```ts
clerkAuth({
  acceptsToken: ['session_token'],
  allowedRoles: ['org:admin', 'org:billing_manager'],
})
```

**Require scopes for API key callers.** Each missing scope throws `ForbiddenError` (403). M2M tokens don't need a matching option: Clerk's `authenticateRequest` already verifies the machine-to-machine scope using `CLERK_MACHINE_SECRET_KEY` against the caller machine's `scoped_machines`.

```ts
clerkAuth({
  acceptsToken: ['api_key'],
  apiKeyScopes: ['projects:write'],
})
```

**Reject unauthenticated requests instead of falling through.** Default is `'skip'`. Set `'throw'` to short-circuit the chain with a 401.

```ts
clerkAuth({ onUnauthenticated: 'throw' })
```

**Inspect the raw Clerk request state.** `handleAuth` runs first and receives the full state Clerk produced (`isAuthenticated`, `tokenType`, `reason`, `toAuth()`). Throw to reject with a custom error; return `void` to continue.

```ts
import { UnauthenticatedError } from 'eve/channels/auth'

clerkAuth({
  handleAuth: state => {
    if (state?.tokenType === 'session_token' && state.reason === 'token-expired') {
      throw new UnauthenticatedError({
        code: 'session_expired',
        message: 'Sign in again to continue.',
      })
    }
  },
})
```

**Override the Clerk client config.** `clientOptions` is forwarded to `createClerkClient`.

```ts
clerkAuth({
  clientOptions: {
    secretKey: process.env.CUSTOM_CLERK_SECRET,
    jwtKey: process.env.CLERK_JWT_KEY,
  },
})
```

> [!NOTE]
> When omitted, these fields default to env vars:
> - `secretKey` ← `CLERK_SECRET_KEY`
> - `publishableKey` ← `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, falling back to `CLERK_PUBLISHABLE_KEY`
> - `machineSecretKey` ← `CLERK_MACHINE_SECRET_KEY`

### Principal attributes

After `clerkAuth()` succeeds, eve exposes the caller as `ctx.session.auth.current`. The outer shape is the same for every token type:

```ts
{
  authenticator: 'clerk',
  principalType: 'user' | 'machine',
  principalId: string,
  subject: string,
  attributes: { /* per token type, see below */ },
}
```

`attributes` differs by `tokenType`:

**Session token** (`principalType: 'user'`)

```ts
{
  tokenType: 'session_token',
  orgId?: string,                  // active organization id
  role?: string,                   // org role, e.g. 'org:admin'
  permissions?: readonly string[], // org permissions list
  name?: string,                   // from sessionClaims.name
}
```

**API key** (`principalType: 'machine'`)

```ts
{
  tokenType: 'api_key',
  scopes?: readonly string[], // custom scopes attached to the key
  userId?: string,            // when scoped to a user
  orgId?: string,             // when scoped to an org (mutually exclusive with userId)
}
```

**M2M token** (`principalType: 'machine'`)

```ts
{
  tokenType: 'm2m_token',
  scopes?: readonly string[],
}
```

**OAuth token** (`principalType: 'machine'`)

```ts
{
  tokenType: 'oauth_token',
  scopes?: readonly string[],
  userId: string,                  // the user the token authorizes
  clientId: string,                // the OAuth app's client id
}
```

### Authorizing agent endpoints

Each agent's eve channel composes a list of authenticators. [`clerkAuth()`](packages/clerk-eve-auth/src/index.ts) verifies any Clerk token type and maps it to an eve principal; a non-Clerk token returns `null` and falls through to the next authenticator.

```ts
// apps/main-agent/agent/channels/eve.ts
export default eveChannel({
  auth: [
    clerkAuth(),   // session tokens, API keys, M2M, OAuth
    vercelOidc(),  // deployment-to-deployment trust
  ],
})
```

This starter intentionally omits [`localDev()`](https://eve.dev/docs/guides/auth-and-route-protection#localdev) so unauthenticated requests are rejected with a real `401` even on localhost. `localDev()` would short-circuit Clerk auth in development, which makes it harder to test the real auth flows this demo is built around.

### API key auth

`clerkAuth()` also verifies [Clerk API keys](https://clerk.com/docs/authentication/api-keys). Send one as a bearer token and the agent runs as that key's user, so the same per-caller instructions apply (ask "Who am I?" to see it).

Create a key from the running dashboard: open the sidebar's **API Keys** item (it opens your Clerk user profile's API keys page), generate a key, and copy it.

Call the agent with it. The eve session route is `POST /eve/v1/session`:

```bash
curl -X POST http://localhost:3000/eve/v1/session \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CLERK_API_KEY" \
  -d '{"message":"Who am I?"}'
# {"continuationToken":"eve:...","ok":true,"sessionId":"ses_..."}
```

From a script or backend, the `eve` client takes the key through `auth.bearer`:

```ts
import { Client } from 'eve/client'

const client = new Client({
  host: 'http://localhost:3000',
  auth: { bearer: process.env.CLERK_API_KEY },
})

const session = client.session()
const response = await session.send({ message: 'Who am I?' })
console.log(await response.result())
```

### M2M auth between agents

The main agent declares the project agent as a remote subagent and signs the outbound call with [`clerkM2MToken()`](packages/clerk-eve-auth/src/index.ts), which mints a short-lived token from the agent's machine secret key.

```ts
// apps/main-agent/agent/subagents/project.ts
export default defineRemoteAgent({
  url: process.env.PROJECT_AGENT_URL ?? 'http://127.0.0.1:3002',
  description: 'Delegates project management tasks to the project agent.',
  auth: bearer(clerkM2MToken()),
})
```

The token is scope-checked on the other side: the main agent's machine must be scoped to the project agent's machine in Clerk, which is the scope you created during setup.

### Enriching dynamic instructions with user info

With [dynamic instructions](https://eve.dev/docs/guides/dynamic-capabilities#dynamic-instructions), you can enrich you agent's prompt with session specific context. `ctx.session.auth.current` is whichever principal `clerkAuth()` produced (a user or machine), so you can customize the prompt based on the principal.

```ts
// apps/main-agent/agent/instructions.ts
export default defineDynamic({
  events: {
    'session.started': (_event, ctx) => {
      const auth = ctx.session.auth.current
      const lines = ['You are a helpful assistant.']

      if (auth?.principalType === 'user' && auth.attributes.name) {
        lines.push(`You are speaking with ${auth.attributes.name}.`)
      }
      return defineInstructions({ markdown: lines.join('\n\n') })
    },
  },
})
```

### Sending auth context from client

Dynamic instructions run when a session starts. To send per-turn, ephemeral context from the browser, use `clientContext` instead. It's passed to the model alongside the message and never stored on the session history.

```ts
// apps/dashboard/src/components/chat/chat.tsx
const { user } = useUser()
const { orgId } = useAuth()

const agent = useEveAgent({
  prepareSend: input => ({
    ...input,
    clientContext: {
      // ...,
      user: user?.fullName ?? null,
      orgId: orgId ?? null,
    },
  }),
})
```

See eve's [Attach page context per turn](https://eve.dev/docs/guides/frontend/overview#attach-page-context-per-turn) for the full guide.

### Testing the auth flows

The chat header has a dropdown that switches how the request authenticates:

- **Session** — your signed-in Clerk session (the cookie). The dashboard sends logged in user info through `useEveAgent` hook's `clientContext`.
- **API key** — sends the key from the input's settings dialog as a bearer token; the agent runs as that key's user.
- **Unauthenticated** — sends a custom `no-auth-demo` header so the agent strips credentials and returns a `401`.

## Commands

Run from the repo root.

| Command | Description |
| --- | --- |
| `bun run dev` | Start the dashboard + both agents (port 3000). |
| `bun run dev:agent` | Start the main agent TUI on its own (port 3001). |
| `bun run build` | Build every app and package via Turbo. |
| `bun run typecheck` | Typecheck the whole monorepo. |
| `bun run lint` | Lint with Biome. |
| `bun run format` | Format with Biome. |

The agents also expose per-app eve scripts (`eve:deploy`, `eve:info`). Run them with `bun run --filter=main-agent <script>`.

## Deploying to production

The dashboard runs the main-agent via `withEve` ([next.config.ts](apps/dashboard/next.config.ts)) as a co-located service, so deploying the dashboard ships the main agent with it. The `project-agent` is a separate deployment. Deploy it first to get its URL.

Set these on each deployment. Use credentials from your Clerk **production instance** — the keys in `.env.local` belong to a development instance and aren't valid in production. Replace `CLERK_SECRET_KEY`, the publishable keys, and `CLERK_MACHINE_SECRET_KEY` with their production-instance equivalents.

| | Dashboard (+ main-agent) | project-agent |
| --- | --- | --- |
| `CLERK_SECRET_KEY` | ✓ | ✓ |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✓ | — |
| `CLERK_PUBLISHABLE_KEY` | — | ✓ |
| `CLERK_MACHINE_SECRET_KEY` | main-agent's machine secret | project-agent's machine secret |
| `AI_GATEWAY_API_KEY` | ✓ | ✓ |
| `PROJECT_AGENT_URL` | the deployed project-agent URL | — |

> [!TIP]
> The dashboard runs `main-agent` via `withEve`, so its `CLERK_MACHINE_SECRET_KEY` is `main-agent`'s machine secret from your Clerk production instance. Remember to scope `main-agent` to `project-agent` in the production instance, same as you did locally.

## Support

For help, visit our [support page](https://clerk.com/contact/support?utm_source=github&utm_medium=eve_examples) or join our [Discord](https://clerk.com/discord).
