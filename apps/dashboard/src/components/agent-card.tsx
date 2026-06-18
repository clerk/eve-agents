import { BotIcon } from 'lucide-react'
import type { EnrichedAgent } from '@/app/actions'
import { AgentSettingsDialog } from '@/components/agent-settings-dialog'
import { Badge } from '@/components/ui/badge'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'

export function AgentCard({ agent }: { agent: EnrichedAgent }) {
  const model = agent.model.id && agent.model.id !== 'unknown' ? agent.model.id : null
  // Tools take priority; agents without any (e.g. the orchestrator) fall back to
  // showing the agents they're scoped to call.
  const scopes = agent.machineDetails?.scopes ?? []

  return (
    <Item variant="outline" className="items-start">
      <ItemMedia variant="icon" className="bg-muted p-2 rounded-md">
        <BotIcon />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{agent.name}</ItemTitle>
        {model && (
          <ItemDescription className="font-mono text-xs">{model}</ItemDescription>
        )}
      </ItemContent>
      {agent.clerkMachineId && agent.machineDetails && (
        <ItemActions>
          <AgentSettingsDialog
            agentName={agent.name}
            machineId={agent.clerkMachineId}
            scopes={agent.machineDetails.scopes}
          />
        </ItemActions>
      )}
      {agent.tools.length > 0 ? (
        <ItemFooter className="flex-wrap justify-start gap-1.5">
          {agent.tools.map(tool => (
            <Badge key={tool.name} variant="secondary">
              {tool.name}
            </Badge>
          ))}
        </ItemFooter>
      ) : scopes.length > 0 ? (
        <ItemFooter className="flex-wrap justify-start gap-1.5">
          {scopes.map(scope => (
            <Badge key={scope.machineId} variant="secondary">
              {scope.name}
            </Badge>
          ))}
        </ItemFooter>
      ) : null}
    </Item>
  )
}
