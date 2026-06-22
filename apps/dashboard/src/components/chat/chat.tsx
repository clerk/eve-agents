'use client'

import { useAuth, useUser } from '@clerk/nextjs'
import type { UIMessage } from 'ai'
import { useEveAgent } from 'eve/react'
import Link from 'next/link'
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
import { Button } from '@/components/ui/button'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from '@/components/ui/item'
import { ApiKeyProvider, useApiKey } from './api-key'
import { ChatInput } from './chat-input'
import { FlowSelect } from './flow-select'
import { type FlowId, flowOptions } from './flows'
import { Messages } from './messages'

const SUGGESTIONS = [
  'List my github repositories',
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
  // Remount on flow (or api-key) change so each session starts clean with the right auth — useEveAgent reads its options at init.
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

  // A tool's interactive auth emits `authorization.required` with a connect URL and parks the turn until the caller connects. Surface a persistent connect affordance and clear it on `authorization.completed` (or a fresh turn).
  const [authChallenge, setAuthChallenge] = React.useState<{
    url?: string
    displayName?: string
    name: string
  } | null>(null)

  // `auth`/`headers` can safely be removed if not using the demo flows.
  // `clientContext` is the dashboard session's identity, so only attach it when not using the api-key or unauthenticated flows.
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
    onEvent: event => {
      if (event.type === 'authorization.required') {
        const challenge = event.data.authorization
        setAuthChallenge({
          url: challenge?.url,
          displayName: challenge?.displayName,
          name: event.data.name,
        })
        toast.warning('Authorization required', {
          description: `Please connect your ${challenge?.displayName ?? event.data.name} account to continue.`,
        })
      }
      if (event.type === 'authorization.completed') {
        setAuthChallenge(null)
      }
    },
    onError: error => toast.error(error.message),
    onFinish: snapshot =>
      toast.success(`Run finished (${snapshot.status})`),
  })
  const { status } = agent

  const send = (text: string) => {
    setAuthChallenge(null)
    void agent.send({ message: text })
  }

  // Resolve a pending ask_question by answering its input request — either a
  // selected option (`optionId`) or freeform `text` — which un-parks the run.
  const answer = (
    requestId: string,
    response: { optionId?: string; text?: string }
  ) => {
    void agent.send({ inputResponses: [{ requestId, ...response }] })
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
          {authChallenge?.url && (
            <Item variant="outline" className="mt-2">
              <ItemContent>
                <ItemTitle>
                  Connect {authChallenge.displayName ?? authChallenge.name}
                </ItemTitle>
                <ItemDescription>
                  Authorize access to continue this request.
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button asChild size="sm">
                  <Link
                    href={authChallenge.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Connect
                  </Link>
                </Button>
              </ItemActions>
            </Item>
          )}
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
