import type { ClerkClient } from '@clerk/backend'
import {
  type Agent,
  type AgentGraph,
  listManagedMachines,
  type ManagedMachine,
  machineName,
  managedScopesById,
  pendingFromAgents,
} from '@clerk/eve-auth'
import { readManifests } from './projects'

// Build the agent graph from every `apps/*` compiled manifest, resolving each
// agent's Clerk machine id by its normalized `eve:<name>-agent` name and
// computing which agent/subagent links are not yet scoped in Clerk. Pass
// `existing` to reuse an already-fetched managed-machine list.
export async function buildAgents({
  clerk,
  appsDir,
  existing,
}: {
  clerk: ClerkClient
  appsDir: string
  existing?: Map<string, ManagedMachine>
}): Promise<AgentGraph> {
  const [projects, machines] = await Promise.all([
    readManifests(appsDir),
    existing ? Promise.resolve(existing) : listManagedMachines(clerk),
  ])
  const machineId = (agentName: string) =>
    machines.get(machineName(agentName))?.id ?? null

  const agents: Agent[] = projects.map(({ manifest }) => {
    const name = manifest.config?.name as string
    return {
      id: name,
      name,
      instructions: manifest.instructions?.markdown ?? '',
      model: {
        id: manifest.config?.model?.id ?? 'unknown',
        routing: manifest.config?.model?.routing,
      },
      tools: (manifest.tools ?? [])
        .filter((t): t is { name: string } & typeof t => typeof t.name === 'string')
        .map(t => ({
          name: t.name,
          description: t.description ?? '',
          inputSchema: t.inputSchema ?? null,
        })),
      clerkMachineId: machineId(name),
      remoteAgents: (manifest.remoteAgents ?? [])
        .filter((r): r is { name: string } & typeof r => typeof r.name === 'string')
        .map(r => ({
          id: r.name,
          name: r.name,
          url: r.url ?? '',
          clerkMachineId: machineId(r.name),
        })),
    }
  })

  const pendingConnections = pendingFromAgents(agents, managedScopesById(machines))
  return { agents, pendingConnections }
}
