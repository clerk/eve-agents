'use client'

import { useUser, useAuth } from '@clerk/nextjs'
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

const SUGGESTIONS = [
  'What can you help me with?',
  'Archive project',
  'Who am I?',
]

export function Chat() {
  const pathname = usePathname()
  const { user } = useUser()
  const { orgId } = useAuth()
  // No `host`: withEve mounts the main-agent runtime same-origin, so the hook's
  // default (/eve/v1/*) is correct. `prepareSend` attaches ephemeral page
  // context to every turn — the current route and signed-in user — without it
  // landing in durable session history.
  const agent = useEveAgent({
    prepareSend: input => ({
      ...input,
      clientContext: {
        route: pathname,
        user: user?.fullName ?? null,
        orgId: orgId ?? null,
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

  // Resolve a pending ask_question by answering its input request with freeform
  // text, which un-parks the waiting run.
  const answer = (requestId: string, text: string) => {
    void agent.send({ inputResponses: [{ requestId, text }] })
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <Conversation className="min-h-0">
        <ConversationContent>
          {/* EveMessage follows the AI SDK UIMessage convention. */}
          <Messages
            messages={agent.data.messages as unknown as UIMessage[]}
            onAnswer={answer}
          />
          {status === 'streaming' && (
            <Spinner
              variant="ellipsis"
              className="text-muted-foreground"
            />
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="mt-4 flex shrink-0 flex-col gap-2">
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
