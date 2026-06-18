import { type ManagedMachine, MACHINE_PREFIX } from './machines'

// A scope relationship that should exist but doesn't (yet). `machines` are the
// two Clerk machine ids to link bidirectionally; `agents` are their friendly
// names for display.
export type PendingConnection = {
  machines: [string, string]
  agents: [string, string]
}

type Endpoint = { id: string | null; name: string }

// The minimal agent shape needed to derive desired links — satisfied by the
// full `Agent` from agents.ts and by lightweight reconstructions.
export type AgentLike = {
  name: string
  clerkMachineId: string | null
  remoteAgents: { name: string; clerkMachineId: string | null }[]
}

// Given desired machine pairs and current scope state (machine id -> the ids it
// is scoped to), return the pairs not linked in BOTH directions. Deduped per
// unordered pair; endpoints missing an id are skipped.
function unlinkedPairs(
  desired: [Endpoint, Endpoint][],
  scopesByMachineId: Map<string, Set<string>>
): PendingConnection[] {
  const pending: PendingConnection[] = []
  const seen = new Set<string>()
  for (const [a, b] of desired) {
    if (!a.id || !b.id || a.id === b.id) continue
    const key = [a.id, b.id].sort().join('::')
    if (seen.has(key)) continue
    const linked =
      (scopesByMachineId.get(a.id)?.has(b.id) ?? false) &&
      (scopesByMachineId.get(b.id)?.has(a.id) ?? false)
    if (linked) continue
    seen.add(key)
    pending.push({ machines: [a.id, b.id], agents: [a.name, b.name] })
  }
  return pending
}

const stripPrefix = (name: string) =>
  name.startsWith(MACHINE_PREFIX) ? name.slice(MACHINE_PREFIX.length) : name

// Convert the managed-machine map (scopes held by name) into a machine id ->
// scoped machine ids map, for `unlinkedPairs`.
export function managedScopesById(
  existing: Map<string, ManagedMachine>
): Map<string, Set<string>> {
  const idByName = new Map([...existing].map(([name, m]) => [name, m.id]))
  const out = new Map<string, Set<string>>()
  for (const [, m] of existing) {
    const ids = new Set<string>()
    for (const scopeName of m.scopes) {
      const id = idByName.get(scopeName)
      if (id) ids.add(id)
    }
    out.set(m.id, ids)
  }
  return out
}

// Pending connections from the normalized-name domain (scanned projects +
// the machine ids ensured for them). Used by the watcher. `projects` is typed
// structurally so this stays free of the fs-based project scanner.
export function pendingFromProjects(
  projects: { machine: string; remotes: string[] }[],
  machineIdByName: Map<string, string>,
  scopesByMachineId: Map<string, Set<string>>
): PendingConnection[] {
  const desired: [Endpoint, Endpoint][] = []
  for (const p of projects) {
    const primary: Endpoint = {
      id: machineIdByName.get(p.machine) ?? null,
      name: stripPrefix(p.machine),
    }
    for (const remote of p.remotes) {
      desired.push([
        primary,
        { id: machineIdByName.get(remote) ?? null, name: stripPrefix(remote) },
      ])
    }
  }
  return unlinkedPairs(desired, scopesByMachineId)
}

// Pending connections from the agent domain (each agent + its remote agents).
// Used by the generator, the dashboard, and `agents-link`.
export function pendingFromAgents(
  agents: AgentLike[],
  scopesByMachineId: Map<string, Set<string>>
): PendingConnection[] {
  const nameByMachineId = new Map<string, string>()
  for (const agent of agents) {
    if (agent.clerkMachineId) nameByMachineId.set(agent.clerkMachineId, agent.name)
  }
  const desired: [Endpoint, Endpoint][] = []
  for (const agent of agents) {
    const primary: Endpoint = { id: agent.clerkMachineId, name: agent.name }
    for (const remote of agent.remoteAgents) {
      desired.push([
        primary,
        {
          id: remote.clerkMachineId,
          name: remote.clerkMachineId
            ? (nameByMachineId.get(remote.clerkMachineId) ?? remote.name)
            : remote.name,
        },
      ])
    }
  }
  return unlinkedPairs(desired, scopesByMachineId)
}
