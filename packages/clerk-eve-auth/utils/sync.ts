import path from 'node:path'
import { hasEnvKey, upsertEnv } from './env'
import { type ClerkClient, listManagedMachines, MACHINE_PREFIX } from './machines'
import { scanProjects } from './projects'

const DEFAULT_TOKEN_TTL = 300
const MACHINE_SECRET_ENV = 'CLERK_MACHINE_SECRET_KEY'

export type SyncOptions = {
  clerk: ClerkClient
  appsDir: string
  // Progress sink; defaults to no-op so non-interactive callers stay quiet.
  log?: (message: string) => void
}

// One stateless reconcile pass over `appsDir`. Ensures a Clerk machine exists
// for every primary + remote agent (named `eve:<name>-agent`), scopes each
// primary and its remotes to one another both ways, writes each project's
// machine secret to its env, and deletes any `eve:`-prefixed machine that no
// longer backs an agent. Safe to run from a watcher or a one-shot command.
export async function syncMachines({
  clerk,
  appsDir,
  log = () => {},
}: SyncOptions): Promise<void> {
  const projects = await scanProjects(appsDir)
  const existing = await listManagedMachines(clerk)

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
      log(`created machine "${name}"`)
    }
  }
  const idOf = (name: string) => machines.get(name)?.id

  // Sync scopes: primary <-> each remote, both directions.
  const desiredScopes = new Set<string>() // `${fromName}->${toName}`
  for (const p of projects) {
    for (const r of p.remotes) {
      desiredScopes.add(`${p.machine}->${r}`)
      desiredScopes.add(`${r}->${p.machine}`)
    }
  }
  for (const pair of desiredScopes) {
    const [from, to] = pair.split('->')
    const fromId = idOf(from)
    const toId = idOf(to)
    if (!fromId || !toId) continue
    if (!existing.get(from)?.scopes.has(to)) {
      await clerk.machines.createScope(fromId, toId)
      log(`scoped ${from} -> ${to}`)
    }
  }
  // Remove scopes that exist on our machines but are no longer desired.
  for (const [name, m] of existing) {
    const fromId = idOf(name) ?? m.id
    for (const scopedName of m.scopes) {
      if (!scopedName.startsWith(MACHINE_PREFIX)) continue
      if (!desiredScopes.has(`${name}->${scopedName}`)) {
        const toId = idOf(scopedName) ?? existing.get(scopedName)?.id
        if (toId) {
          await clerk.machines.deleteScope(fromId, toId).catch(() => {})
          log(`unscoped ${name} -> ${scopedName}`)
        }
      }
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
      log(`deleted machine "${name}"`)
    }
  }
}
