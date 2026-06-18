'use client'

import { useState } from 'react'
import {
  PromptInput,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
} from '@/components/ai-elements/prompt-input'

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
      className="mt-4 w-full max-w-2xl mx-auto relative"
    >
      <PromptInputTextarea
        value={input}
        placeholder="Say something..."
        onChange={e => setInput(e.currentTarget.value)}
        className="pr-12"
      />
      <PromptInputSubmit
        status={status}
        onStop={onStop}
        disabled={disabled}
        className="absolute bottom-1 right-1"
      />
    </PromptInput>
  )
}
