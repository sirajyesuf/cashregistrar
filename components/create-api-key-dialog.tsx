"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { toast } from "@/components/toast"
import { copyText } from "@/lib/copy"

export function CreateApiKeyDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
}) {
  const [name, setName] = useState("")
  const [raw, setRaw] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const reset = () => {
    setName("")
    setRaw(null)
    setError(null)
    setCopied(false)
  }

  const close = (next: boolean) => {
    onOpenChange(next)
    if (!next) reset()
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      })
      const body = (await res.json().catch(() => ({}))) as {
        error?: string
        raw?: string
      }
      if (!res.ok || !body.raw) {
        throw new Error(body.error ?? `Failed to create API key (${res.status})`)
      }
      setRaw(body.raw)
      onCreated?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create API key")
    } finally {
      setPending(false)
    }
  }

  const handleCopy = async () => {
    if (!raw) return
    try {
      await copyText(raw)
      setCopied(true)
      toast.add({
        title: "API key copied",
        description: "Store it somewhere safe.",
        type: "success",
      })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.add({
        title: "Could not copy",
        description: "Select the key and copy it manually.",
        type: "destructive",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        {raw ? (
          <>
            <DialogHeader>
              <DialogTitle>API key created</DialogTitle>
              <DialogDescription>
                Copy this key now. For security, you won&apos;t be able to see
                it again.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <InputGroup>
                <InputGroupInput
                  value={raw}
                  readOnly
                  className="font-mono text-xs"
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    type="button"
                    size="icon-sm"
                    onClick={handleCopy}
                    aria-label="Copy API key"
                    title="Copy to clipboard"
                  >
                    {copied ? <Check className="text-success" /> : <Copy />}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              <DialogFooter>
                <Button onClick={() => close(false)}>Done</Button>
              </DialogFooter>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Create API key</DialogTitle>
              <DialogDescription>
                Name this key so you can identify it later. The key is shown
                once after creation.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="api-key-name">Name</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="api-key-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. POS integration"
                      autoFocus
                      required
                    />
                  </InputGroup>
                </Field>
              </FieldGroup>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <DialogFooter>
                <DialogClose
                  render={<Button variant="outline" />}
                  disabled={pending}
                >
                  Cancel
                </DialogClose>
                <Button type="submit" disabled={pending}>
                  {pending ? "Creating…" : "Create API key"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
