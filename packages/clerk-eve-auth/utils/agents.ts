import { type ClerkClient, listManagedMachines, machineName } from './machines'
import { readManifests } from './projects'

export type AgentModel = {
  id: string
  routing?: { kind?: string; target?: string }
}

export type ToolInfo = {
  name: string
  description: string
  inputSchema: unknown
}

// A remote agent another agent delegates to. `clerkMachineId` is the join key
// for graph edges: it matches the target agent's own `clerkMachineId`, since a
// remote (`project`) and its target agent (`project-agent`) normalize to the
// same `eve:project-agent` machine.
export type RemoteAgentRef = {
  id: string
  name: string
  url: string
  clerkMachineId: string | null
}

export type Agent = {
  id: string
  name: string
  instructions: string
  model: AgentModel
  tools: ToolInfo[]
  clerkMachineId: string | null
  remoteAgents: RemoteAgentRef[]
}

// Build the agent graph from every `apps/*` compiled manifest, resolving each
// agent's Clerk machine id by its normalized `eve:<name>-agent` name.
export async function buildAgents({
  clerk,
  appsDir,
}: {
  clerk: ClerkClient
  appsDir: string
}): Promise<Agent[]> {
  const [projects, machines] = await Promise.all([
    readManifests(appsDir),
    listManagedMachines(clerk),
  ])
  const machineId = (agentName: string) =>
    machines.get(machineName(agentName))?.id ?? null

  return projects.map(({ manifest }) => {
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
}
