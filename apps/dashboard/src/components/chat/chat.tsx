'use client'

import { useAuth, useUser } from '@clerk/nextjs'
import type { UIMessage } from 'ai'
import { useEveAgent } from 'eve/react'
import { usePathname } from 'next/navigation'
import * as React from 'react'
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
import { ApiKeyProvider, useApiKey } from './api-key'
import { ChatInput } from './chat-input'
import { FlowSelect } from './flow-select'
import { type FlowId, flowOptions } from './flows'
import { Messages } from './messages'

const SUGGESTIONS = [
  'What can you help me with?',
  'Archive project',
  'Who am I?',
]

export function Chat() {
  return (
    <ApiKeyProvider>
      <ChatInner />
    </ApiKeyProvider>
  )
}

function ChatInner() {
  const [flow, setFlow] = React.useState<FlowId>('session')
  const { apiKey } = useApiKey()
  // Remount on flow (or api-key) change so each session starts clean with the
  // right auth — useEveAgent reads its options at init.
  const sessionKey = flow === 'api-key' ? `api-key:${apiKey}` : flow

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-center pb-4">
        <FlowSelect value={flow} onChange={setFlow} />
      </div>
      <ChatSession key={sessionKey} flow={flow} apiKey={apiKey} />
    </div>
  )
}

function ChatSession({ flow, apiKey }: { flow: FlowId; apiKey: string }) {
  const pathname = usePathname()
  const { user } = useUser()
  const { orgId } = useAuth()
  const { auth, headers } = flowOptions(flow, apiKey)

  // `auth`/`headers` select the flow (api-key bearer, or the `no-auth-demo`
  // header that makes the agent strip credentials server-side). `clientContext`
  // is the dashboard session's identity, so only attach it on the session flow
  // — it would be misleading to send it as an API key or unauthenticated caller.
  const agent = useEveAgent({
    auth,
    headers,
    prepareSend: input =>
      flow === 'session'
        ? {
            ...input,
            clientContext: {
              route: pathname,
              user: user?.fullName ?? null,
              orgId: orgId ?? null,
            },
          }
        : input,
    onError: error => toast.error(error.message),
    onFinish: snapshot => toast.success(`Run finished (${snapshot.status})`),
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
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation className="min-h-0">
        <ConversationContent>
          {/* EveMessage follows the AI SDK UIMessage convention. */}
          <Messages
            messages={agent.data.messages as unknown as UIMessage[]}
            onAnswer={answer}
          />
          {status === 'streaming' && (
            <Spinner variant="ellipsis" className="text-muted-foreground" />
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
