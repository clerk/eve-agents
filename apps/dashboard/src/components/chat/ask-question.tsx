'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

// The freeform answer card shown under an `ask_question` tool that is awaiting a
// response. Submitting resolves the pending input request through the agent.
export function AskQuestion({
  prompt,
  onSubmit,
  disabled,
}: {
  prompt: string
  onSubmit: (text: string) => void
  disabled?: boolean
}) {
  const [value, setValue] = React.useState('')

  const submit = () => {
    const text = value.trim()
    if (!text) return
    onSubmit(text)
    setValue('')
  }

  return (
    // Fills the message column, matching the adjacent Tool cards (also w-full).
    <div className="group not-prose mb-4 w-full rounded-md border">
      <form
        className="flex flex-col gap-2 p-3"
        onSubmit={e => {
          e.preventDefault()
          submit()
        }}
      >
        {prompt && <p className="text-sm pb-2">{prompt}</p>}
        <Textarea
          autoFocus
          disabled={disabled}
          onChange={e => setValue(e.target.value)}
          placeholder="Type your answer…"
          value={value}
          className="min-h-16 resize-none"
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={disabled || !value.trim()}>
            Submit
          </Button>
        </div>
      </form>
    </div>
  )
}
