import {
  defaultMessageReducer,
  type EveAgentReducer,
  type EveMessage,
} from 'eve/react'

export type SubagentInvocation = {
  callId: string
  name: string
  remoteUrl?: string
  status: 'called' | 'completed'
  output?: string
  // Custom, frontend-derived metadata — this is the "meta" you wanted on the
  // subagent.called event. The event itself has no slot for it, so we attach
  // it here, keyed on the framework fields (name / remote.url).
  label: string
  startedAt: number
}

export type ChatData = {
  readonly messages: readonly EveMessage[]
  readonly subagents: readonly SubagentInvocation[]
}

// Compose: run the built-in message projection (so `messages` still works for
// the AI Elements components) and layer our own subagent tracking on top.
const base = defaultMessageReducer()

export const chatReducer: EveAgentReducer<ChatData> = {
  initial: () => ({ ...base.initial(), subagents: [] }),

  reduce: (data, event) => {
    const { messages } = base.reduce(data, event)
    let subagents = data.subagents

    if (event.type === 'subagent.called') {
      const { callId, name, remote } = event.data
      subagents = [
        ...subagents,
        {
          callId,
          name,
          remoteUrl: remote?.url,
          status: 'called',
          startedAt: Date.now(),
          // derive whatever metadata your UI wants from the event fields:
          label: remote ? `${name} (remote)` : name,
        },
      ]
    } else if (event.type === 'subagent.completed') {
      // The result the remote/subagent returned lands here (string `output`,
      // or your `outputSchema` shape if the remote runs in task mode).
      subagents = subagents.map(s =>
        s.callId === event.data.callId
          ? { ...s, status: 'completed', output: event.data.output }
          : s
      )
    }

    return { messages, subagents }
  },
}
