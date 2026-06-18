'use server'

import {
  linkMachineScopes,
  type PendingConnection,
  pendingFromAgents,
  revokeMachineTokens,
} from '@clerk/eve-auth'
import { clerkClient } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { type Agent, getAgents } from '@/lib/agents'

// A machine this agent is scoped to. `machineId` drives the Clerk calls;
// `name` is the friendly label (the owning agent's name where known).
export type ScopeRef = { machineId: string; name: string }

export type MachineDetails = {
  name: string
  scopes: ScopeRef[]
}

export type EnrichedAgent = Agent & {
  machineDetails: MachineDetails | null
}

// Read the generated agent graph, then attach each agent's Clerk machine name
// and scopes (which agents it can call). One `machines.list` call resolves the
// whole graph, including the friendly names for scoped machine ids.
export async function getEnrichedAgents(): Promise<EnrichedAgent[]> {
  const agents = await getAgents()
  const clerk = await clerkClient()
  const { data: machines } = await clerk.machines.list({ limit: 500 })

  const machineById = new Map(machines.map(m => [m.id, m]))
  // machine id -> agent name, to swap scope ids for friendly names.
  const nameByMachineId = new Map<string, string>()
  for (const agent of agents) {
    if (agent.clerkMachineId) nameByMachineId.set(agent.clerkMachineId, agent.name)
  }

  return agents.map(agent => {
    const machine = agent.clerkMachineId
      ? machineById.get(agent.clerkMachineId)
      : undefined
    if (!machine) return { ...agent, machineDetails: null }
    const scopes = machine.scopedMachines.map(scoped => ({
      machineId: scoped.id,
      name: nameByMachineId.get(scoped.id) ?? scoped.name.replace(/^eve:/, ''),
    }))
    return { ...agent, machineDetails: { name: machine.name, scopes } }
  })
}

// Live agent/subagent links that aren't scoped in Clerk yet. Computed against
// the current machine scopes so it reflects links made since agents.json was
// generated (e.g. via the dashboard or `agents-link`).
export async function getPendingConnections(): Promise<PendingConnection[]> {
  const agents = await getAgents()
  const clerk = await clerkClient()
  const { data: machines } = await clerk.machines.list({ limit: 500 })
  const scopesByMachineId = new Map(
    machines.map(m => [m.id, new Set(m.scopedMachines.map(s => s.id))])
  )
  return pendingFromAgents(agents, scopesByMachineId)
}

// Create the bidirectional scope between two machines (the dashboard "Link"
// action and `agents-link` share this same effect).
export async function linkMachines(
  machineIdA: string,
  machineIdB: string
): Promise<void> {
  const clerk = await clerkClient()
  await linkMachineScopes(clerk, machineIdA, machineIdB)
  // Drop outstanding tokens for both machines so the new scope applies on the
  // next call rather than after the current tokens' reuse window.
  await revokeMachineTokens(clerk, [machineIdA, machineIdB])
  revalidatePath('/')
}

// Remove scopes between `machineId` and each scoped machine, in both
// directions, then revalidate the agents page.
export async function deleteLinkedMachineScopes(
  machineId: string,
  scopeMachineIds: string[]
): Promise<void> {
  if (scopeMachineIds.length === 0) return
  const clerk = await clerkClient()

  await Promise.all(
    scopeMachineIds.flatMap(scopeId => [
      clerk.machines.deleteScope(machineId, scopeId).catch(() => {}),
      clerk.machines.deleteScope(scopeId, machineId).catch(() => {}),
    ])
  )

  // Revoke outstanding tokens for the agent and everything it was scoped to, so
  // the unlink is enforced immediately instead of after the tokens age out.
  await revokeMachineTokens(clerk, [machineId, ...scopeMachineIds])

  revalidatePath('/')
}
