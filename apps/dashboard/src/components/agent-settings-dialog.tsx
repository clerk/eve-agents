'use client'

import { SettingsIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import * as React from 'react'
import { deleteLinkedMachineScopes, type ScopeRef } from '@/app/actions'
import { CopyButton } from '@/components/copy-button'
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
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Tags } from '@/components/ui/tags'

export function AgentSettingsDialog({
  agentName,
  machineId,
  scopes,
}: {
  agentName: string
  machineId: string
  scopes: ScopeRef[]
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [selected, setSelected] = React.useState(() =>
    scopes.map(s => s.name)
  )
  const [saving, setSaving] = React.useState(false)
  // Tags popup portals in here so it stays clickable inside the modal dialog.
  const portalRef = React.useRef<HTMLDivElement>(null)

  const names = React.useMemo(() => scopes.map(s => s.name), [scopes])
  // Scopes present initially but removed from the selection get unlinked.
  const removedIds = scopes
    .filter(s => !selected.includes(s.name))
    .map(s => s.machineId)

  const save = async () => {
    if (removedIds.length === 0) {
      setOpen(false)
      return
    }
    setSaving(true)
    try {
      await deleteLinkedMachineScopes(machineId, removedIds)
      setOpen(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        setOpen(next)
        if (next) setSelected(names) // reset to current scopes on open
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`${agentName} settings`}
        >
          <SettingsIcon />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agent Settings</DialogTitle>
          <DialogDescription>
            Manage settings for the agent and its underlying machine.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
              <Label className="text-muted-foreground text-xs">Name</Label>
              <p className="text-xs font-medium font-mono">{agentName}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-muted-foreground text-xs">Machine ID</Label>
              <CopyButton 
                text={machineId} 
                className="bg-muted"
              />
            </div>
   

          <div className="flex flex-col gap-2">
            <Label className="text-muted-foreground text-xs">Scopes</Label>
            <Tags
              options={names}
              value={selected}
              onValueChange={setSelected}
              placeholder={selected.length ? undefined : 'No scopes'}
              emptyText="No scopes."
              container={portalRef}
            />
            {/* Tags popup portals here, inside the dialog, so it stays clickable. */}
            <div ref={portalRef} />
            <p className="text-xs text-destructive">
              Removing scopes will unlink agent machines in both directions.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={save}
            disabled={saving || removedIds.length === 0}
          >
            {saving ? <Spinner /> : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
