import type { PendingConnection } from './connections'

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

// The generated agent graph: the agents plus the scope relationships that
// should exist between their machines but don't yet (resolved by the
// `eve-agents link` command or the dashboard). Built by `eve-agents generate`.
export type AgentGraph = {
  agents: Agent[]
  pendingConnections: PendingConnection[]
}
