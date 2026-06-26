'use client'

import { useState } from 'react'
import {
  PromptInput,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from '@/components/ai-elements/prompt-input'
import { ApiKeySettings } from './api-key-settings'

export function ChatInput({
  onSend,
  onStop,
  status,
}: {
  onSend: (text: string) => void
  onStop?: () => void
  status: 'submitted' | 'streaming' | 'ready' | 'error'
}) {
  const [input, setInput] = useState('')

  // Disabled while 'submitted' (turn sent, stream not started — nothing to stop
  // yet). Enabled while 'streaming' (so it can stop); otherwise needs text.
  const disabled =
    status === 'submitted' || (status !== 'streaming' && !input.trim())

  const handleSubmit = (message: PromptInputMessage) => {
    if (message.text.trim()) {
      onSend(message.text)
      setInput('')
    }
  }

  return (
    <PromptInput
      onSubmit={handleSubmit}
      className="mt-4 w-full max-w-2xl mx-auto"
    >
      <PromptInputTextarea
        value={input}
        placeholder="Say something..."
        onChange={e => setInput(e.currentTarget.value)}
      />
      <PromptInputFooter>
        <PromptInputTools>
          <ApiKeySettings />
        </PromptInputTools>
        <PromptInputSubmit
          status={status}
          onStop={onStop}
          disabled={disabled}
        />
      </PromptInputFooter>
    </PromptInput>
  )
}
