import type { UIMessage } from 'ai'
import { MessageSquare } from 'lucide-react'
import { ConversationEmptyState } from '@/components/ai-elements/conversation'
import { Message, MessageContent } from '@/components/ai-elements/message'
import type { ToolPart } from '@/components/ai-elements/tool'
import { TextMessage } from './text-message'
import { ToolMessage } from './tool-message'

export function Messages({ messages }: { messages: UIMessage[] }) {
  if (messages.length === 0) {
    return (
      <ConversationEmptyState
        icon={<MessageSquare className="size-12" />}
        title="Start a conversation"
        description="Pick an example above, then send a message."
      />
    )
  }

  return messages.map(message => (
    <Message from={message.role} key={message.id}>
      <MessageContent>
        {message.parts.map((part, i) => {
          const key = `${message.id}-${i}`

          if (part.type === 'text') {
            return <TextMessage key={key} text={part.text} />
          }

          if (
            part.type.startsWith('tool-') ||
            part.type === 'dynamic-tool'
          ) {
            return <ToolMessage key={key} part={part as ToolPart} />
          }

          return null
        })}
      </MessageContent>
    </Message>
  ))
}
