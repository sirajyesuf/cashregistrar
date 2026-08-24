"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { copyText } from "@/lib/copy"
import { toast } from "@/components/toast"
import { Button } from "@/components/ui/button"

type CopyFieldProps = {
  label?: string
  value: string
}

/**
 * Displays a value in monospace with a copy button. Used on the API keys page
 * to let integrators copy the business ID and branch ID.
 */
export function CopyField({ label, value }: CopyFieldProps) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await copyText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.add({
        title: "Could not copy",
        description: "Select the value and copy it manually.",
        type: "destructive",
      })
    }
  }

  return (
    <div className="flex items-center justify-between gap-3">
      {label && (
        <span className="text-sm text-muted-foreground">{label}</span>
      )}
      <span className="flex min-w-0 items-center gap-1.5 font-mono text-xs">
        <span title={value} className="truncate">
          {value}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={copy}
          aria-label={label ? `Copy ${label}` : "Copy value"}
          title="Copy to clipboard"
          className="shrink-0 text-muted-foreground"
        >
          {copied ? <Check className="text-success" /> : <Copy />}
        </Button>
      </span>
    </div>
  )
}
