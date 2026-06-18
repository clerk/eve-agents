import {
  type EnrichedAgent,
  getEnrichedAgents,
  getPendingConnections,
} from '@/app/actions'
import { AgentCard } from '@/components/agent-card'
import { PendingConnectionsAlert } from '@/components/pending-connections-alert'
import type { PendingConnection } from '@/lib/agents'

export const dynamic = 'force-dynamic'

export default async function AgentsPage() {
  const [agents, pending] = await Promise.all([
    getEnrichedAgents().catch(() => [] as EnrichedAgent[]),
    getPendingConnections().catch(() => [] as PendingConnection[]),
  ])

  return (
    <main className="min-h-0 flex-1 overflow-auto p-6">
      <div className="mx-auto w-full max-w-5xl">
        <h1 className="mb-6 text-2xl font-semibold">Agents</h1>
        <PendingConnectionsAlert connections={pending} />
        {agents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No agents found. Run{' '}
            <code className="font-mono">bun run agents:json</code> to generate
            the agent graph.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map(agent => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
