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

> [!NOTE]
> This branch wires the Clerk machines **by hand** to keep things simple. The [`m2m-sync`](https://github.com/clerk/eve-agents-with-clerk/tree/m2m-sync) branch automates the same setup with a CLI and an agent-graph dashboard.

## Apps and packages

| Workspace | Description |
| --- | --- |
| [`apps/dashboard`](apps/dashboard) | Next.js app (port 3000). Clerk-authenticated chat UI with a flow selector to call the agent as a session user, an API key, or unauthenticated. |
| [`apps/main-agent`](apps/main-agent) | Primary eve agent (port 3001). Its channel accepts Clerk session/API key/M2M/OAuth callers, personalizes instructions from the caller's auth, and delegates project tasks to the project agent over M2M. |
| [`apps/project-agent`](apps/project-agent) | Subagent (port 3002). Reachable machine-to-machine only, so inbound callers must present a scoped Clerk M2M token. Exposes a `manage_project` tool. |
| [`packages/clerk-eve-auth`](packages/clerk-eve-auth) | `@clerk/eve-auth`. The `clerkAuth()` channel authenticator and the `clerkM2MToken()` outbound-token resolver. |

## Getting started

### Prerequisites

- [Bun](https://bun.sh) 1.3+
- A [Clerk application](https://dashboard.clerk.com/sign-up?utm_source=github&utm_medium=eve_examples) with [API keys](https://clerk.com/docs/authentication/api-keys) and [machine-to-machine](https://clerk.com/docs/machine-to-machine) enabled
- An [AI Gateway](https://vercel.com/docs/ai-gateway) API key (or any AI SDK provider key)

### Setup

```bash
bun install
```

Copy the env files for each agent:

```bash
cp apps/main-agent/.env.example apps/main-agent/.env.local
cp apps/project-agent/.env.example apps/project-agent/.env.local
```

Create the Clerk machines by hand in the [Clerk dashboard](https://dashboard.clerk.com) (Machines):

1. Create a **machine for each agent** (e.g. `main-agent` and `project-agent`). Copy each machine's secret key (`ak_...`) into that agent's `.env.local` as `CLERK_MACHINE_SECRET_KEY`.
2. **Scope the two machines to each other** (main-agent → project-agent and project-agent → main-agent). M2M is rejected without this scope.

Fill in `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, and `AI_GATEWAY_API_KEY` in each `.env.local`, then start everything:

```bash
bun run dev   # dashboard on http://localhost:3000
```

`bun run dev` boots the dashboard, which starts the main agent (via `withEve`) and the project agent (via Turbo). Open [http://localhost:3000](http://localhost:3000), sign in, and chat. Ask it to archive or restore a project to watch it delegate to the project agent over M2M.

## How it works

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

There's no `localDev()`, so unauthenticated requests are rejected with a real `401` even on localhost. (The starter wraps `clerkAuth()` to strip credentials when it sees a `no-auth-demo` header, since a browser can't drop its own same-origin cookie — that powers the "Unauthenticated" flow below.)

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

### Prefilling dynamic instructions

Whoever the caller is (a session user, an API key's user, or a calling machine), the authenticated principal is available on the session, so the agent's instructions are built per request from auth context, including which token type authenticated the call.

```ts
// apps/main-agent/agent/instructions.ts
'session.started': (_event, ctx) => {
  const auth = ctx.session.auth.current
  const sections = [/* … */]

  if (auth?.principalType === 'user' && auth.attributes.name) {
    sections.push(`You are speaking with ${auth.attributes.name}.`)
  }
  return defineInstructions({ markdown: sections.join('\n\n') })
}
```

### Testing the auth flows

The chat header has a dropdown that switches how the request authenticates:

- **Session** — your signed-in Clerk session (the cookie). The dashboard also attaches `clientContext` (route, name, org) on this flow only.
- **API key** — sends the key from the input's settings dialog as a bearer token; the agent runs as that key's user.
- **Unauthenticated** — sends the `no-auth-demo` header so the agent strips credentials and returns a `401`.

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

Set these on each deployment (one Clerk instance across all of them):

| | Dashboard (+ main-agent) | project-agent |
| --- | --- | --- |
| `CLERK_SECRET_KEY` | ✓ | ✓ |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✓ | — |
| `CLERK_PUBLISHABLE_KEY` | — | ✓ |
| `CLERK_MACHINE_SECRET_KEY` | main-agent's machine secret | project-agent's machine secret |
| `AI_GATEWAY_API_KEY` | ✓ | ✓ |
| `PROJECT_AGENT_URL` | the deployed project-agent URL | — |

> [!TIP]
> The dashboard's `CLERK_MACHINE_SECRET_KEY` is **main-agent's** (it runs main-agent via `withEve`). Use main-agent's `.env.local` value. Make sure the two machines are scoped to each other in Clerk, same as local.

## Support

For help, visit our [support page](https://clerk.com/contact/support?utm_source=github&utm_medium=eve_examples) or join our [Discord](https://clerk.com/discord).
