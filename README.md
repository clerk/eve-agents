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

A monorepo showing how to secure [Eve](https://vercel.com/eve) agents with [Clerk](https://clerk.com?utm_source=github&utm_medium=eve_examples).

It covers three patterns:

- **Authorizing agent endpoints.** An eve channel `AuthFn` that verifies Clerk session tokens, API keys, M2M tokens, and OAuth tokens, then maps each to an eve principal.
- **Prefilling dynamic instructions.** Reading the authenticated caller off the session to personalize the agent's instructions per request.
- **M2M auth between agents.** Minting short-lived Clerk M2M tokens to authorize communication between agents and remotely hosted dynamic agents.

## Apps and packages

| Workspace | Description |
| --- | --- |
| [`apps/dashboard`](apps/dashboard) | Next.js app (port 3000). Clerk-authenticated chat UI for the agents, and an agent graph view that reads `agents.json`, surfaces unlinked agent connections, and links their Clerk machines in one click. |
| [`apps/main-agent`](apps/main-agent) | Primary eve agent (port 3001). Its channel accepts Clerk session/API key/M2M/OAuth callers, its instructions are personalized from the caller's auth context, and it delegates project tasks to the project agent over M2M. |
| [`apps/project-agent`](apps/project-agent) | Subagent (port 3002). Reachable machine-to-machine only, so inbound callers must present a scoped Clerk M2M token. Exposes a `manage_project` tool. |
| [`packages/clerk-eve-auth`](packages/clerk-eve-auth) | `@clerk/eve-auth`. The `clerkAuth()` channel authenticator, the `clerkM2MToken()` outbound-token resolver, and the Clerk machine/scope helpers the CLI builds on. |
| [`packages/eve-agents`](packages/eve-agents) | `eve-agents` CLI. `eve-agents dev` / `generate` / `link` — provisions a Clerk machine per agent, writes the `agents.json` graph, and links agent-to-agent machine scopes. |

## Getting started

### Prerequisites

- [Bun](https://bun.sh) 1.3+
- A [Clerk application](https://dashboard.clerk.com/sign-up?utm_source=github&utm_medium=eve_examples) with [API keys](https://clerk.com/docs/authentication/api-keys) and [machine-to-machine](https://clerk.com/docs/machine-to-machine) enabled
- An [AI Gateway](https://vercel.com/docs/ai-gateway) API key (or any AI SDK provider key)

### Setup

```bash
bun install
```

Copy the env files for each agent and fill in your Clerk and AI Gateway keys:

```bash
cp apps/main-agent/.env.example apps/main-agent/.env.local
cp apps/project-agent/.env.example apps/project-agent/.env.local
```

Leave `CLERK_MACHINE_SECRET_KEY` blank. `eve-agents dev` provisions a Clerk machine per agent and writes the secret back for you.

With `CLERK_SECRET_KEY` set at the repo root, start the machine sync:

```bash
bun run agents:dev
```

It creates a machine (`eve:<name>-agent`) for every agent under `apps/*`, writes each machine secret to its `.env.local`, keeps `apps/dashboard/agents.json` in sync, and reports any agent-to-agent connections that are missing Clerk machine scopes. Resolve them all at once (in another terminal):

```bash
bun run agents:link
```

Then start the dashboard:

```bash
bun run dev   # dashboard on http://localhost:3000
```

Open [http://localhost:3000](http://localhost:3000), sign in, and chat with the main agent. Ask it to archive or restore a project to watch it delegate tasks to remote agents w/ M2M.

## How it works

### Authorizing agent endpoints

Each agent's eve channel composes a list of authenticators. [`clerkAuth()`](packages/clerk-eve-auth/src/index.ts) verifies any Clerk token type and maps it to an eve principal; a non-Clerk token returns `null` and falls through to the next authenticator.

```ts
// apps/main-agent/agent/channels/eve.ts
export default eveChannel({
  auth: [
    clerkAuth(),   // session tokens, API keys, M2M, OAuth
    localDev(),    // open on localhost for `eve dev` and local subagent calls
    vercelOidc(),  // deployment-to-deployment trust
  ],
})
```

Agents used as subagents should drop `localDev()` so they can only ever be reached with a valid, M2M token.

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

`useEveAgent` takes the same `auth`, for a custom frontend pointed at an agent it doesn't host. Set `host` to that agent's origin (omit it when the agent is mounted same-origin via `withEve`, as the dashboard does):

```ts
const agent = useEveAgent({
  host: 'http://localhost:3000', // the standalone agent, not this app's origin
  auth: { bearer: apiKey },
})
```

> [!IMPORTANT]
> API keys belong on the server, so prefer curl or the SDK over the browser.

When using `useEveAgent` on a frontend secured by Clerk, it runs same-origin and the agent trusts the signed-in Clerk session, so no key is needed there. Locally, `localDev()` still admits tokenless localhost calls, so the key is what attaches a user identity to the request.

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

The token is scope-checked on the other side: the main agent's machine must be scoped to the project agent's machine in Clerk, exactly the scope `eve-agents link` (or the dashboard) creates.

### Sharing user info in `clientContext`

`useEveAgent`'s `prepareSend` runs before every turn, so the chat UI can attach `clientContext` straight from Clerk's client hooks. eve injects it as context for that turn's model call only, so it personalizes the response without landing in durable session history.

```ts
// apps/dashboard/src/components/chat/chat.tsx
const { user } = useUser()
const { orgId } = useAuth()

const agent = useEveAgent({
  prepareSend: input => ({
    ...input,
    clientContext: {
      user: user?.fullName ?? null,
      orgId: orgId ?? null,
    },
  }),
})
```

### Prefilling dynamic instructions

Whoever the caller is (a session user, an API key's user, or a calling machine), the authenticated principal is available on the session, so the agent's instructions can be built per request from auth context (plan, principal type, name).

```ts
// apps/main-agent/agent/instructions.ts
'session.started': (_event, ctx) => {
  const auth = ctx.session.auth.current
  const plan = auth?.attributes.plan ?? 'free'
  const sections = [/* … */]

  if (auth?.principalType === 'user' && auth.attributes.name) {
    sections.push(`You are speaking with ${auth.attributes.name}.`)
  }
  return defineInstructions({ markdown: sections.join('\n\n') })
}
```

### Syncing agents with Clerk machines

M2M only works if every agent has a Clerk machine and the right scopes exist between them. The [`eve-agents`](packages/eve-agents) CLI keeps that in lockstep with the code, with three subcommands:

- **`eve-agents dev`** watches `apps/*` and reconciles a Clerk machine (`eve:<name>-agent`) for every primary and remote agent, writing each machine secret back to its `.env.local`. It also regenerates `agents.json` on each change. It deletes machines that no longer back an agent, and warns about connections that need linking.
- **`eve-agents generate`** scans the same agents and writes an `agents.json` graph (agents, tools, models, machine ids, and remote-agent edges) for the dashboard to serve. Use `--out <dir>` to choose where it lands.
- **`eve-agents link`** creates the bidirectional machine scopes for every pending connection, the same action as the dashboard's **Link** button.

It builds on the Clerk machine/scope helpers exported from `@clerk/eve-auth`, so the same logic backs both the CLI and the dashboard.

## Commands

Run from the repo root.

| Command | Description |
| --- | --- |
| `bun run dev` | Start the dashboard (port 3000). |
| `bun run dev:agent` | Start the main agent TUI (port 3001). |
| `bun run agents:dev` | Watch `apps/*`, keep Clerk machines and `apps/dashboard/agents.json` in sync. |
| `bun run agents:link` | Create machine scopes for all pending agent connections. |
| `bun run agents:json` | Write the agent graph to `apps/dashboard/agents.json` (one-off). |
| `bun run build` | Build every app and package via Turbo. |
| `bun run typecheck` | Typecheck the whole monorepo. |
| `bun run lint` | Lint with Biome. |
| `bun run format` | Format with Biome. |

The agents also expose per-app eve scripts (`eve:link`, `eve:deploy`, `eve:info`). Run them with `bun run --filter=main-agent <script>`.

## Support

For help, visit our [support page](https://clerk.com/contact/support?utm_source=github&utm_medium=eve_examples) or join our [Discord](https://clerk.com/discord).
