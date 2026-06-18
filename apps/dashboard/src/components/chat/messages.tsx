import type { UIMessage } from 'ai'
import { MessageSquare } from 'lucide-react'
import { Fragment } from 'react'
import { ConversationEmptyState } from '@/components/ai-elements/conversation'
import { Message, MessageContent } from '@/components/ai-elements/message'
import type { ToolPart } from '@/components/ai-elements/tool'
import { AgentItem } from './agent-handoff'
import { AskQuestion } from './ask-question'
import { TextMessage } from './text-message'
import { ToolMessage } from './tool-message'

// The pending human-in-the-loop request eve attaches to a tool part while a run
// is parked at `session.waiting`.
type EveInputRequest = {
  requestId: string
  prompt?: string
  options?: { id: string; label: string }[]
  allowFreeform?: boolean
}

function inputRequestOf(part: ToolPart): EveInputRequest | undefined {
  return (
    part as { toolMetadata?: { eve?: { inputRequest?: EveInputRequest } } }
  ).toolMetadata?.eve?.inputRequest
}

const toolNameOf = (part: ToolPart): string =>
  part.type === 'dynamic-tool' ? part.toolName : part.type.replace(/^tool-/, '')

// The `message` the model handed to a subagent tool call.
function subagentMessage(part: ToolPart): string | undefined {
  const input = (part as { input?: { message?: unknown } }).input
  return typeof input?.message === 'string' ? input.message : undefined
}

export function Messages({
  messages,
  onAnswer,
}: {
  messages: UIMessage[]
  onAnswer?: (requestId: string, text: string) => void
}) {
  if (messages.length === 0) {
    return (
      <ConversationEmptyState
        icon={<MessageSquare className="size-12" />}
        title="Start a conversation"
        description="Pick an example below or send a message."
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
            const toolPart = part as ToolPart
            const toolName = toolNameOf(toolPart)
            const request = inputRequestOf(toolPart)
            // Show the freeform answer card under an `ask_question` that is still
            // awaiting a response.
            const awaitingFreeform =
              toolName === 'ask_question' &&
              toolPart.state === 'approval-requested' &&
              request?.allowFreeform === true
            // Subagent delegations get an agent card above the tool call.
            const isSubagent = toolName.startsWith('eve:subagent')

            return (
              <Fragment key={key}>
                {isSubagent && (
                  <AgentItem
                    name={toolName.replace(/^eve:subagent:?/, '')}
                    message={subagentMessage(toolPart)}
                  />
                )}
                <ToolMessage part={toolPart} />
                {awaitingFreeform && request && (
                  <AskQuestion
                    prompt={request.prompt ?? ''}
                    onSubmit={text => onAnswer?.(request.requestId, text)}
                  />
                )}
              </Fragment>
            )
          }

          return null
        })}
      </MessageContent>
    </Message>
  ))
}
