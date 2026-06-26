/**
 * Create the demo's main-agent and project-agent Clerk machines, scope
 * main-agent to project-agent (so main can mint M2M tokens for it), and print
 * their secret keys.
 *
 *   bun run scripts/demo/create-agent-machines.ts
 *
 * Reads CLERK_SECRET_KEY from the environment (bun auto-loads env variables from
 * the cwd).
 *
 * Secret keys are only returned once, at creation time. Copy each one into the
 * corresponding apps/<name>/.env.local as CLERK_MACHINE_SECRET_KEY before
 * starting the agents. Re-running this script creates *new* machines, so clean
 * up duplicates in the Clerk Dashboard if needed.
 */
import { createClerkClient } from '@clerk/backend'

if (!process.env.CLERK_SECRET_KEY) {
  console.error(
    'CLERK_SECRET_KEY is not set. Export it or add it to .env.local at the repo root.'
  )
  process.exit(1)
}

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
})

const [main, project] = await Promise.all([
  clerk.machines.create({ name: 'main-agent' }),
  clerk.machines.create({ name: 'project-agent' }),
])

await clerk.machines.createScope(main.id, project.id)

const row = (label: string, value: string | undefined) =>
  `  ${label.padEnd(28)} ${value ?? '(not returned; rotate from the dashboard)'}`

console.log()
console.log(
  'Created two Clerk machines and scoped main-agent → project-agent.'
)
console.log()
console.log(row('main-agent id', main.id))
console.log(row('main-agent secret', main.secretKey))
console.log(row('project-agent id', project.id))
console.log(row('project-agent secret', project.secretKey))
console.log()
console.log(
  'Copy each secret into the matching apps/<name>/.env.local as CLERK_MACHINE_SECRET_KEY.'
)
console.log('Manage machines: https://dashboard.clerk.com/~/machines')
