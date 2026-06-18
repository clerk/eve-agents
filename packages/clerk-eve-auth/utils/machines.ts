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

// Link two machines bidirectionally (each scoped to the other). Errors — e.g.
// an already-existing scope — are ignored so this is safe to call repeatedly.
export async function linkMachineScopes(
  clerk: ClerkClient,
  machineIdA: string,
  machineIdB: string
): Promise<void> {
  await clerk.machines.createScope(machineIdA, machineIdB).catch(() => {})
  await clerk.machines.createScope(machineIdB, machineIdA).catch(() => {})
}

// Revoke every active M2M token issued by the given machines. Call after a
// scope change so it takes effect immediately: outstanding tokens snapshot
// their scopes at mint time and Clerk reuses them within their TTL, so without
// revocation a relink/unlink only applies once those tokens age out. Returns
// the number of tokens revoked. Best-effort: individual failures are ignored.
export async function revokeMachineTokens(
  clerk: ClerkClient,
  machineIds: string[]
): Promise<number> {
  let revoked = 0
  for (const subject of machineIds) {
    // The M2M list endpoint caps limit at 100. Token reuse keeps the active set
    // small, so a single page is plenty here.
    const res = await clerk.m2m.list({ subject, limit: 100 }).catch(() => null)
    if (!res) continue
    for (const token of res.data) {
      await clerk.m2m.revokeToken({ m2mTokenId: token.id }).catch(() => {})
      revoked++
    }
  }
  return revoked
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
