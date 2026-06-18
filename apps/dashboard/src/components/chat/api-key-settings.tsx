'use client'

import { SettingsIcon } from 'lucide-react'
import * as React from 'react'
import { PromptInputButton } from '@/components/ai-elements/prompt-input'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useApiKey } from './api-key'

// A settings button in the prompt input that opens a dialog to set the Clerk
// API key used by the "API key" flow. The input is prefilled with the stored
// key.
export function ApiKeySettings() {
  const { apiKey, setApiKey } = useApiKey()
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState(apiKey)

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        setOpen(next)
        if (next) setValue(apiKey) // prefill with the stored key on open
      }}
    >
      <DialogTrigger asChild>
        <PromptInputButton tooltip="API key" aria-label="API key settings">
          <SettingsIcon />
        </PromptInputButton>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>API key</DialogTitle>
          <DialogDescription>
            Sent as the bearer token when the API key flow is active.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="api-key">Clerk API key</Label>
          <Input
            id="api-key"
            autoFocus
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="ak_..."
            className="font-mono"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setApiKey(value.trim())
              setOpen(false)
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
