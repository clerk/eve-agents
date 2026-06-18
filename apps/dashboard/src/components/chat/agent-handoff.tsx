import { BotIcon, ChevronRightIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'

// The from -> to handoff: original agent, chevron, the subagent being called.
export function AgentHandoff({ from, to }: { from: string; to: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Badge variant="secondary">{from}</Badge>
      <ChevronRightIcon className="size-3 text-muted-foreground" />
      <Badge variant="secondary">{to}</Badge>
    </div>
  )
}

// A card for the agent a turn is delegating to: bot icon, the agent's name, and
// the message being handed off.
export function AgentItem({
  name,
  message,
}: {
  name: string
  message?: string
}) {
  return (
    <Item variant="outline">
      <ItemMedia variant="icon" className="bg-muted p-2 rounded-md">
        <BotIcon />
      </ItemMedia>
      <ItemContent className="pr-4">
        <ItemTitle>{name}-agent</ItemTitle>
        {message && <ItemDescription className="text-xs">{message}</ItemDescription>}
      </ItemContent>
    </Item>
  )
}
