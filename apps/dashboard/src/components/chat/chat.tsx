'use client'

import { useUser } from '@clerk/nextjs'
import type { UIMessage } from 'ai'
import { useEveAgent } from 'eve/react'
import { usePathname } from 'next/navigation'
import { toast } from 'sonner'
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import {
  Suggestion,
  Suggestions,
} from '@/components/ai-elements/suggestion'
import { Spinner } from '@/components/kibo-ui/spinner'
import { ChatInput } from './chat-input'
import { Messages } from './messages'
import { chatReducer, type ChatData } from './reducer'

const SUGGESTIONS = [
  'What can you help me with?',
  'Archive project abc-123',
  'Who am I?',
]

export function Chat() {
  const pathname = usePathname()
  const { user } = useUser()

  // No `host`: withEve mounts the main-agent runtime same-origin, so the hook's
  // default (/eve/v1/*) is correct. `prepareSend` attaches ephemeral page
  // context to every turn — the current route and signed-in user — without it
  // landing in durable session history.
  const agent = useEveAgent<ChatData>({
    reducer: chatReducer,
    prepareSend: input => ({
      ...input,
      clientContext: {
        route: pathname,
        user: user?.fullName ?? null,
      },
    }),
    // onEvent: event => console.log(event),
    onError: error => toast.error(error.message),
    onFinish: snapshot =>
      toast.success(`Run finished (${snapshot.status})`),
  })
  const { status } = agent

  const send = (text: string) => {
    void agent.send({ message: text })
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <Conversation>
        <ConversationContent>
          {/* EveMessage follows the AI SDK UIMessage convention. */}
          <Messages
            messages={agent.data.messages as unknown as UIMessage[]}
          />
          {status === 'streaming' && (
            <Spinner
              variant="ellipsis"
              className="text-muted-foreground"
            />
          )}
          {/* Custom reducer projection: subagent delegations + our own meta. */}
          {agent.data.subagents.map(s => (
            <div key={s.callId} className="text-xs text-muted-foreground">
              Delegated to {s.label} ({s.status})
              {s.remoteUrl ? ` — ${s.remoteUrl}` : ''}
            </div>
          ))}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="mt-4 flex flex-col gap-2">
        <Suggestions>
          {SUGGESTIONS.map(suggestion => (
            <Suggestion
              key={suggestion}
              suggestion={suggestion}
              onClick={send}
            />
          ))}
        </Suggestions>
        <ChatInput onSend={send} onStop={agent.stop} status={status} />
      </div>
    </div>
  )
}
