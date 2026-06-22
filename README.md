<p align="center">
  <a href="https://clerk.com?utm_source=github&utm_medium=eve_examples" target="_blank" rel="noopener noreferrer">
    <img src="https://images.clerk.com/static/logo-light-mode-400x400.png" height="64" alt="Clerk logo">
  </a>
  <br />
  <h1 align="center">Eve Agents with Clerk</h1>
</p>

<div align="center">

[![Chat on Discord](https://img.shields.io/discord/856971667393609759.svg?logo=discord)](https://clerk.com/discord)
[![Clerk documentation](https://img.shields.io/badge/documentation-clerk-green.svg)](https://clerk.com/docs?utm_source=github&utm_medium=eve_examples)
[![Follow on X](https://img.shields.io/twitter/follow/clerk?style=social)](https://x.com/intent/follow?screen_name=clerk)

</div>

A monorepo showing how to secure [Eve](https://vercel.com/eve) agents with [Clerk](https://clerk.com?utm_source=github&utm_medium=eve_examples). One auth connector handles every Clerk token type — session, API key, M2M, OAuth — with optional permission, scope, and role gates. Includes agent-to-agent M2M auth, enchriched agent instructions and tool-call authorization.

## What's inside

1. **Clerk auth helpers** — Eve-compatible channel auth and helpers for securing subagents and tool calls.
2. **Three sample apps** — a Next.js dashboard with chat UI, a main agent that delegates work, and a project-agent subagent that's reachable only via M2M.
3. **Dynamic instructions** — Enchriched prompts with Clerk auth context.
4. **shadcn registry** — pull Clerk auth helpers into an existing eve project with shadcn.

| Workspace | Description |
| --- | --- |
| [`apps/dashboard`](apps/dashboard) | Next.js app featuring Clerk-authenticated chat UI with a colocated `main-agent` (mounted via `withEve`). |
| [`apps/project-agent`](apps/project-agent) | Remote subagent that communicates with `main-agent` (port 3002). Reachable machine-to-machine only. |
| [`packages/clerk-eve-auth`](packages/clerk-eve-auth) | Clerk helpers and channel auth for eve agents. |


## Quick start

> [!TIP]
> Want to use Clerk auth in an existing eve project? Skip the quickstart and [install the auth helpers with shadcn.](#install-with-shadcn)

Prerequisites: [Bun](https://bun.sh) 1.3+, a [Clerk application](https://dashboard.clerk.com/sign-up?utm_source=github&utm_medium=eve_examples), and a [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) API key.

```bash
bun install
```

Copy the `.env.example` templates into `.env.local`:

```bash
cp apps/dashboard/.env.example apps/dashboard/.env.local
cp apps/project-agent/.env.example apps/project-agent/.env.local
```

Fill in `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, and `AI_GATEWAY_API_KEY` in each `.env.local`, then create the two Clerk machines with M2M scopes in one shot:

```bash
bun run demo:create-machines
```

Copy each printed secret into `CLERK_MACHINE_SECRET_KEY` — the main-agent secret in `apps/dashboard/.env.local`, the project-agent secret in `apps/project-agent/.env.local` — then:

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in, and chat. Use the auth-flow dropdown or ask the agent to archive a project to watch M2M in action.

## Install with Shadcn

Use shadcn to install Clerk auth helpers into an existing eve project.

```bash
bunx --bun shadcn@latest add clerk/eve-agents/auth
```

Drop `clerkAuth()` into your eve channel's auth list to verify Clerk callers on every inbound request:

```ts
// agent/channels/eve.ts
import { clerkAuth } from '@/lib/clerk-auth'
import { eveChannel } from 'eve/channels/eve'

export default eveChannel({
  auth: [clerkAuth()],
})
```

Use `clerkInstructions()` to rebuild the system prompt per session with the authenticated caller's context:

```ts
// agent/instructions.ts
import { clerkInstructions } from '@/lib/clerk-auth/instructions'

export default clerkInstructions((auth, userInfo) => [
  'You are a helpful assistant.',
  userInfo
])
```

Pair `clerkM2MToken()` with eve's `bearer()` to sign outbound calls to a remote subagent with a short-lived Clerk M2M token:

```ts
// agent/subagents/<name>.ts
import { clerkM2MToken } from '@/lib/clerk-auth/m2m'
import { defineRemoteAgent } from 'eve'
import { bearer } from 'eve/agents/auth'

export default defineRemoteAgent({
  url: process.env.SUBAGENT_URL!,
  description: 'Delegates to the subagent.',
  auth: bearer(clerkM2MToken()),
})
```

## Configuring `clerkAuth()`

`clerkAuth()` verifies any Clerk token type and maps the caller to an eve principal. Default behavior returns `null` on failure so the chain walks to the next authenticator. Every option is opt-in — combine them freely.

```ts
// agent/channels/eve.ts
import { clerkAuth } from '@clerk/eve-auth'
import { eveChannel } from 'eve/channels/eve'

export default eveChannel({
  auth: [clerkAuth()],
})
```

For the full list of options with examples for each, see [docs/configuration.md](docs/configuration.md).

After `clerkAuth()` succeeds, eve exposes the caller as `ctx.session.auth.current`:

```ts
{
  authenticator: 'clerk',
  principalType: 'user' | 'machine',
  principalId: string,
  subject: string,
  attributes: { /* per token type */ },
}
```

Attributes differ by principal and Clerk token type. See [docs/attributes.md](docs/attributes.md) to see type definitions for each.


## How it works

### Authorized agent delegation and collaboration

Agents can call each other securely over M2M with short-lived [machine tokens](https://clerk.com/docs/guides/development/machine-auth/m2m-tokens), with scope enforced by Clerk.

See [docs/m2m.md](docs/m2m.md) for how agents map to Clerk machines, the scope model, and the setup script.

### Enriching dynamic instructions

`clerkInstructions()` is a helper that uses [dynamic instructions](https://eve.dev/docs/guides/dynamic-capabilities#dynamic-instructions) and runs on every `session.started` event, returning a prompt enriched with the Clerk caller's auth context.

```ts
// agent/instructions.ts
import { clerkInstructions } from '@clerk/eve-auth/instructions'

export default clerkInstructions((auth, userInfo) => [
  'You are a helpful assistant.',
  userInfo &&
    `Use the following info about the caller to personalize your response:\n${userInfo}`,
])
```

For a signed-in user, `userInfo` looks like:

```
tokenType: session_token
orgId: org_123
role: org:admin
permissions: org:projects:archive, org:projects:read
name: John Doe
```

The callback receives three arguments:

- `auth` — the Clerk-backed eve principal, or `null` when no caller authenticated.
- `userInfo` — a pre-built newline-separated `key: value` summary of `auth.attributes` (empty string when unauthenticated). 
- `ctx` — the raw `DynamicResolveContext` for advanced use (session id, message history, channel metadata).

### Sending auth context from client

Dynamic instructions run when a session starts. For per-turn context coming from the browser (user name, active org ID), use `clientContext` instead — it's ephemeral, sent on each turn, and passed to the model alongside the message.

```ts
// apps/dashboard/src/components/chat/chat.tsx
const agent = useEveAgent({
  prepareSend: input => ({
    ...input,
    clientContext: { 
      user: user?.fullName ?? null, 
      orgId: orgId ?? null 
    },
  }),
})
```

See eve docs on [attaching page context](https://eve.dev/docs/guides/frontend/overview#attach-page-context-per-turn) for the full guide.


## Deploying to production

See [docs/production.md](docs/production.md).

## Support

For help, visit our [support page](https://clerk.com/contact/support?utm_source=github&utm_medium=eve_examples) or join our [Discord](https://clerk.com/discord).
