import type { createClerkClient } from '@clerk/backend'

export type ClerkClient = ReturnType<typeof createClerkClient>

// Every managed machine is named `eve:<name>-agent`, so the watcher only ever
// touches its own machines and the `eve:` prefix bounds delete/scope safety.
export const MACHINE_PREFIX = 'eve:'

// `project` -> `eve:project-agent`; `project-agent` -> `eve:project-agent`. A
// remote subagent and its target agent normalize to the SAME machine name.
export function machineName(agentName: string): string {
  const base = agentName.endsWith('-agent') ? agentName : `${agentName}-agent`
  return `${MACHINE_PREFIX}${base}`
}

export type ManagedMachine = { id: string; scopes: Set<string> }

// List only the `eve:`-prefixed machines, keyed by name, with the set of
// machine names each is scoped to.
export async function listManagedMachines(
  clerk: ClerkClient
): Promise<Map<string, ManagedMachine>> {
  const res = await clerk.machines.list({ limit: 500 })
  const byName = new Map<string, ManagedMachine>()
  for (const m of res.data) {
    if (!m.name.startsWith(MACHINE_PREFIX)) continue
    byName.set(m.name, {
      id: m.id,
      scopes: new Set(m.scopedMachines.map(s => s.name)),
    })
  }
  return byName
}
