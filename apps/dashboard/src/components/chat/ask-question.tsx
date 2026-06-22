'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

export type AskQuestionOption = {
  id: string
  label: string
  style?: 'default' | 'primary' | 'danger'
}
// eve's input response carries a single optionId or freeform text.
export type AskQuestionResponse = { optionId?: string; text?: string }

// Per-option emphasis from each option's `style`.
const OPTION_STYLES: Record<
  NonNullable<AskQuestionOption['style']>,
  { item?: string; label?: string }
> = {
  default: {},
  primary: { item: 'border-primary text-primary', label: 'text-primary' },
  danger: {
    item: 'border-destructive text-destructive',
    label: 'text-destructive',
  },
}

// The answer card shown under an `ask_question` tool awaiting a response.
// Renders a single-select radio group for any `options`, plus a freeform field
// when `allowFreeform`. Picking an option and typing are mutually exclusive —
// whichever the user touched last wins.
export function AskQuestion({
  prompt,
  options,
  allowFreeform,
  onSubmit,
  disabled,
}: {
  prompt: string
  options?: AskQuestionOption[]
  allowFreeform?: boolean
  onSubmit: (response: AskQuestionResponse) => void
  disabled?: boolean
}) {
  const [selected, setSelected] = React.useState('')
  const [text, setText] = React.useState('')

  const pickOption = (id: string) => {
    setSelected(id)
    setText('')
  }

  const onText = (value: string) => {
    setText(value)
    if (value) setSelected('')
  }

  const trimmed = text.trim()
  const canSubmit = selected.length > 0 || trimmed.length > 0

  const submit = () => {
    if (selected) onSubmit({ optionId: selected })
    else if (trimmed) onSubmit({ text: trimmed })
    else return
    setSelected('')
    setText('')
  }

  return (
    // Fills the message column, matching the adjacent Tool cards (also w-full).
    <div className="group not-prose mb-4 w-full rounded-md border">
      <form
        className="flex flex-col gap-3 p-3"
        onSubmit={e => {
          e.preventDefault()
          submit()
        }}
      >
        {prompt && <p className="text-sm">{prompt}</p>}

        {options && options.length > 0 && (
          <RadioGroup
            value={selected}
            onValueChange={pickOption}
            disabled={disabled}
          >
            {options.map(option => {
              const style = OPTION_STYLES[option.style ?? 'default']
              return (
                <div key={option.id} className="flex items-center gap-2">
                  <RadioGroupItem
                    value={option.id}
                    id={`opt-${option.id}`}
                    className={style.item}
                  />
                  <Label
                    htmlFor={`opt-${option.id}`}
                    className={cn('font-normal text-sm', style.label)}
                  >
                    {option.label}
                  </Label>
                </div>
              )
            })}
          </RadioGroup>
        )}

        {allowFreeform && (
          <Textarea
            disabled={disabled}
            onChange={e => onText(e.target.value)}
            placeholder={
              options?.length
                ? 'Or type your own answer…'
                : 'Type your answer…'
            }
            value={text}
            className="min-h-16 resize-none"
          />
        )}

        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            disabled={disabled || !canSubmit}
          >
            Submit
          </Button>
        </div>
      </form>
    </div>
  )
}
