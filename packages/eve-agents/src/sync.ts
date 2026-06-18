import path from 'node:path'
import type { ClerkClient } from '@clerk/backend'
import {
  listManagedMachines,
  type ManagedMachine,
  managedScopesById,
  pendingFromProjects,
} from '@clerk/eve-auth'
import { hasEnvKey, upsertEnv } from './env'
import { scanProjects } from './projects'

const DEFAULT_TOKEN_TTL = 300
const MACHINE_SECRET_ENV = 'CLERK_MACHINE_SECRET_KEY'

export type SyncOptions = {
  clerk: ClerkClient
  appsDir: string
  // Progress sink; defaults to no-op so non-interactive callers stay quiet.
  log?: (message: string) => void
  // A pre-fetched managed-machine list to reuse instead of calling Clerk. It is
  // kept current in place (created machines added, deleted ones removed) so a
  // caller can pass the same map to `buildAgents` and skip a second list call.
  existing?: Map<string, ManagedMachine>
}

// One stateless reconcile pass over `appsDir`. Ensures a Clerk machine exists
// for every primary + remote agent (named `eve:<name>-agent`), writes each
// project's machine secret to its env, and deletes any `eve:`-prefixed machine
// that no longer backs an agent. It does NOT create scopes — it detects the
// agent/subagent links that aren't scoped yet and warns to run `eve-agents
// link`. Safe to run from a watcher or a one-shot command.
export async function syncMachines(options: SyncOptions): Promise<void> {
  const { clerk, appsDir, log = () => {} } = options
  const projects = await scanProjects(appsDir)
  const existing = options.existing ?? (await listManagedMachines(clerk))

  // Desired machines = every primary + every remote, by normalized name.
  const desired = new Set<string>()
  for (const p of projects) {
    desired.add(p.machine)
    for (const r of p.remotes) desired.add(r)
  }

  // Ensure every desired machine exists, tracking its id by name. We keep the
  // secret only for machines we just created (an existing machine's secret is
  // fetched lazily below, and only when its env is missing the key).
  const machines = new Map<string, { id: string; freshSecret?: string }>()
  for (const name of desired) {
    const found = existing.get(name)
    if (found) {
      machines.set(name, { id: found.id })
    } else {
      const created = await clerk.machines.create({
        name,
        defaultTokenTtl: DEFAULT_TOKEN_TTL,
      })
      machines.set(name, { id: created.id, freshSecret: created.secretKey as string })
      // Keep `existing` current so a shared map reflects the new machine.
      existing.set(name, { id: created.id, scopes: new Set() })
      log(`created machine "${name}"`)
    }
  }

  // Write each project's primary machine secret as CLERK_MACHINE_SECRET_KEY.
  // A machine we just created always wins (any existing env value is stale).
  // For an existing machine we only fetch + write when the key is missing, so
  // a settled project gets no env write — and thus no eve dev rebuild loop.
  for (const p of projects) {
    const m = machines.get(p.machine)
    if (!m) continue
    let secret: string | undefined = m.freshSecret
    if (!secret) {
      if (await hasEnvKey(p.dir, MACHINE_SECRET_ENV)) continue
      secret = (await clerk.machines.getSecretKey(m.id)).secret
    }
    const wrote = await upsertEnv(p.dir, MACHINE_SECRET_ENV, secret)
    if (wrote) log(`set ${MACHINE_SECRET_ENV} in ${path.relative(appsDir, wrote)}`)
  }

  // Delete our machines that no longer back any agent.
  for (const [name, m] of existing) {
    if (!desired.has(name)) {
      await clerk.machines.delete(m.id).catch(() => {})
      existing.delete(name)
      log(`deleted machine "${name}"`)
    }
  }

  // Detect agent/subagent links that aren't scoped in Clerk yet, and warn.
  // We don't create them here — run `eve-agents link` (or use the dashboard).
  const machineIdByName = new Map([...machines].map(([name, m]) => [name, m.id]))
  const pending = pendingFromProjects(
    projects,
    machineIdByName,
    managedScopesById(existing)
  )
  if (pending.length > 0) {
    log(
      `${pending.length} agent connection(s) need linking — run \`eve-agents link\` to resolve:`
    )
    for (const c of pending) log(`  ${c.agents[0]} <-> ${c.agents[1]}`)
  }
}
