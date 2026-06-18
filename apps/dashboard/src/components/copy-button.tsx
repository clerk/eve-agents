"use client"

import { CheckIcon, CopyIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { cn } from "@/lib/utils"

type CopyButtonProps = {
  text: string
  className?: string
  inputClassName?: string
}

export const CopyButton = ({ text, className, inputClassName }: CopyButtonProps) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    toast.success("Copied to clipboard")
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <InputGroup className={cn("w-fit max-w-sm bg-background", className)}>
      <InputGroupInput value={text} readOnly className={cn("text-xs! font-mono", inputClassName)} />
      <InputGroupAddon align="inline-end">
        <InputGroupButton aria-label="Copy" onClick={handleCopy} size="icon-xs">
          {copied ? <CheckIcon /> : <CopyIcon />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}

