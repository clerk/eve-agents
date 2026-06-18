'use client'

import { ArrowLeftRightIcon, LinkIcon, ShieldAlertIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import * as React from 'react'
import { linkMachines } from '@/app/actions'
import type { PendingConnection } from '@/lib/agents'
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'

export function PendingConnectionsAlert({
  connections,
}: {
  connections: PendingConnection[]
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [linking, setLinking] = React.useState<string | null>(null)

  if (connections.length === 0) return null

  const link = async (connection: PendingConnection) => {
    const [a, b] = connection.machines
    setLinking(connection.machines.join('::'))
    try {
      await linkMachines(a, b)
      router.refresh()
    } finally {
      setLinking(null)
    }
  }

  const count = connections.length

  return (
    <Alert className="mb-6">
      <ShieldAlertIcon />
      <AlertTitle>Agent authorization needed</AlertTitle>
      <AlertDescription>
        {count} agent connection{count === 1 ? '' : 's'} {count === 1 ? 'is' : 'are'}{' '}
        not yet linked in Clerk.
      </AlertDescription>
      <AlertAction>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">Fix</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Link agent machines</DialogTitle>
              <DialogDescription>
                Each pair needs a bidirectional Clerk machine scope to
                communicate. Link the ones you want to authorize.
              </DialogDescription>
            </DialogHeader>
            <ul className="flex flex-col divide-y rounded-lg border">
              {connections.map(connection => {
                const key = connection.machines.join('::')
                return (
                  <li
                    key={key}
                    className="flex items-center justify-between gap-2 p-3"
                  >
                    <span className="flex items-center gap-2 text-sm">
                      {connection.agents[0]}
                      <ArrowLeftRightIcon className="size-3 text-muted-foreground" />
                      {connection.agents[1]}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => link(connection)}
                      disabled={linking !== null}
                    >
                      {linking === key ? <Spinner /> : <LinkIcon />}
                      Link
                    </Button>
                  </li>
                )
              })}
            </ul>
          </DialogContent>
        </Dialog>
      </AlertAction>
    </Alert>
  )
}
