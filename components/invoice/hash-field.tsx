"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { copyText } from "@/lib/copy"
import { Button } from "@/components/ui/button"

type HashFieldProps = {
  label: string
  value: string
}

/**
 * Displays a long identifier (IRN, RRN, …) truncated to a short readable
 * form, with a copy button for the full value. Keeps the layout clean on
 * small screens where full 64+ character hashes would overflow.
 */
export function HashField({ label, value }: HashFieldProps) {
  const [copied, setCopied] = useState(false)
  const short =
    value.length > 20 ? `${value.slice(0, 12)}…${value.slice(-8)}` : value

  const copy = async () => {
    try {
      await copyText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable; ignore
    }
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="flex min-w-0 items-center gap-1.5 font-mono text-xs">
        <span title={value} className="truncate">
          {short}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={copy}
          aria-label={`Copy ${label}`}
          title="Copy to clipboard"
          className="text-muted-foreground"
        >
          {copied ? <Check className="text-success" /> : <Copy />}
        </Button>
      </span>
    </div>
  )
}
