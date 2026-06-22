# Deploying to production

The dashboard runs the main agent — colocated at [`apps/dashboard/agent`](../apps/dashboard/agent) — via `withEve` ([next.config.ts](../apps/dashboard/next.config.ts)), so it builds as one Next.js app and deploying the dashboard ships the main agent with it. The `project-agent` is a separate deployment. Deploy it first to get its URL.

Set these on each deployment, using credentials from your Clerk **production instance** (not the development keys in `.env.local`).

| | Dashboard (+ main-agent) | project-agent |
| --- | --- | --- |
| `CLERK_SECRET_KEY` | ✓ | ✓ |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✓ | — |
| `CLERK_PUBLISHABLE_KEY` | — | ✓ |
| `CLERK_MACHINE_SECRET_KEY` | main-agent's machine secret | project-agent's machine secret |
| `AI_GATEWAY_API_KEY` | ✓ | ✓ |
| `PROJECT_AGENT_URL` | the deployed project-agent URL | — |

> [!TIP]
> The dashboard runs `main-agent` via `withEve`, so its `CLERK_MACHINE_SECRET_KEY` is `main-agent`'s machine secret from your Clerk production instance. Remember to scope `main-agent` to `project-agent` in the production instance.
