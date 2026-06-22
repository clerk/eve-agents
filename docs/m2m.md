# M2M auth between agents

When one agent delegates to another, the outbound call carries a short-lived Clerk M2M token. The receiving agent verifies it like any other Clerk bearer credential — through its `clerkAuth()` channel authenticator — so no extra plumbing is needed on either side beyond the machine setup.

## Agents are Clerk machines

Each agent in your system is represented by a Clerk **machine** — a distinct identity with its own secret key. The calling agent uses its secret to mint outbound tokens; the receiving agent uses its secret to verify inbound tokens. Agent-to-agent relationships are modeled as Clerk **scopes**: granting `main-agent → project-agent` allows main-agent to mint tokens that project-agent will accept. Revoking a scope is an instant kill switch with no deploy.

## How `clerkM2MToken()` is wired

The main agent declares the project agent as a remote subagent and signs the outbound call with `clerkM2MToken()`, which mints a short-lived token from the agent's machine secret key.

```ts
// apps/dashboard/agent/subagents/project.ts
import { clerkM2MToken } from '@clerk/eve-auth/m2m'
import { defineRemoteAgent } from 'eve'
import { bearer } from 'eve/agents/auth'

export default defineRemoteAgent({
  url: process.env.PROJECT_AGENT_URL ?? 'http://127.0.0.1:3002',
  description: 'Delegates project management tasks to the project agent.',
  auth: bearer(clerkM2MToken()),
})
```

`clerkM2MToken()` reads `CLERK_MACHINE_SECRET_KEY` from the calling agent's environment by default and mints a token scoped to the receiving machine.

## Scope verification

Clerk verifies the machine-to-machine relationship before the receiver runs. The calling machine must have the receiving machine in its `scoped_machines`:

```
main-agent.scoped_machines = [project-agent]
```

If the scope is missing or revoked, `authenticateRequest()` on the receiving side rejects the token and the inbound request fails with `401`. There's no per-token scope option on `clerkAuth()` for this — it's part of the M2M verification Clerk performs natively when you pass `machineSecretKey`.

## Setting up the machines

The demo's `demo:create-machines` script creates the two machines and the scope in one shot:

```bash
bun run demo:create-machines
```

It calls `clerk.machines.create()` for each machine and `clerk.machines.createScope(main.id, project.id)` for the one-way scope, then prints both secret keys. Copy them into the matching `apps/<name>/.env.local` as `CLERK_MACHINE_SECRET_KEY`.

To scaffold a new subagent and wire its machine in one step, use the subagent generator:

```bash
bun run gen:subagent
```

Answer **yes** to *Link a Clerk machine?* and the generator finds the host's machine, creates one for the new subagent, scopes the host to call it, and prints the new secret key.
