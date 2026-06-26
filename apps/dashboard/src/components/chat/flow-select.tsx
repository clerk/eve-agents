'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { type FlowId, FLOWS } from './flows'

export function FlowSelect({
  value,
  onChange,
}: {
  value: FlowId
  onChange: (flow: FlowId) => void
}) {
  const flow = FLOWS.find(f => f.id === value)

  return (
    <Select value={value} onValueChange={v => onChange(v as FlowId)}>
      <SelectTrigger className="w-[220px]">
        <SelectValue placeholder="Select a flow">
          {flow?.label}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {FLOWS.map(f => (
          <SelectItem key={f.id} value={f.id}>
            <div className="w-full p-1">
              <p className="text-sm font-medium">{f.label}</p>
              <p className="text-xs text-muted-foreground">
                {f.description}
              </p>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
