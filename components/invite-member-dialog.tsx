"use client"

import { useState } from "react"
import { Copy, Mail } from "lucide-react"
import { Dialog } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "@/components/toast"
import { copyText } from "@/lib/copy"

type Branch = { id: string; name: string }

export function InviteMemberDialog({
  businessId,
  branches,
  open,
  onOpenChange,
  onCreated,
}: {
  businessId: string
  branches: Branch[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
}) {
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<string | null>("CASHIER")
  const [branchId, setBranchId] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [link, setLink] = useState<string | null>(null)

  const reset = () => {
    setEmail("")
    setRole("CASHIER")
    setBranchId(null)
    setError(null)
    setLink(null)
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
      const res = await fetch(`/api/businesses/${businessId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role, branchId }),
      })
      const body = (await res.json().catch(() => ({}))) as {
        error?: string
        link?: string
      }
      if (!res.ok || !body.link) {
        throw new Error(body.error ?? `Failed to send invitation (${res.status})`)
      }
      setLink(body.link)
      onCreated?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invitation")
    } finally {
      setPending(false)
    }
  }

  const copy = async () => {
    if (!link) return
    try {
      await copyText(link)
      toast.add({
        title: "Invite link copied",
        description: "Share it with the person you invited.",
        type: "success",
      })
    } catch {
      toast.add({
        title: "Could not copy link",
        description: "Select the link and copy it manually.",
        type: "destructive",
      })
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={close}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card p-6 shadow-lg outline-none">
          {link ? (
            <>
              <Dialog.Title className="text-lg font-semibold">
                Invite link ready
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                Share this link with the person you invited. It expires in 7
                days and can only be used once.
              </Dialog.Description>

              <div className="mt-5 flex gap-2">
                <Input
                  readOnly
                  value={link}
                  onFocus={(e) => e.target.select()}
                  className="font-mono text-xs"
                  aria-label="Invite link"
                />
                <Button type="button" variant="outline" onClick={copy}>
                  <Copy className="size-4" />
                  Copy
                </Button>
              </div>

              <div className="mt-5 flex justify-end">
                <Dialog.Close render={<Button variant="outline" />}>
                  Done
                </Dialog.Close>
              </div>
            </>
          ) : (
            <>
              <Dialog.Title className="text-lg font-semibold">
                Invite a member
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                Create a one-time link for someone to join this business.
              </Dialog.Description>

              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="invite-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="pl-9"
                      autoFocus
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="invite-role">Role</Label>
                    <Select
                      value={role}
                      onValueChange={(value) =>
                        setRole(value === "MANAGER" ? "MANAGER" : "CASHIER")
                      }
                    >
                      <SelectTrigger id="invite-role" aria-label="Role">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MANAGER">Manager</SelectItem>
                        <SelectItem value="CASHIER">Cashier</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invite-branch">Branch</Label>
                    <Select
                      value={branchId}
                      onValueChange={(value) => setBranchId(value)}
                    >
                      <SelectTrigger id="invite-branch" aria-label="Branch">
                        <SelectValue placeholder="Select branch" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <div className="flex justify-end gap-2">
                  <Dialog.Close render={<Button variant="outline" />} disabled={pending}>
                    Cancel
                  </Dialog.Close>
                  <Button type="submit" disabled={pending}>
                    {pending ? "Creating…" : "Create invite link"}
                  </Button>
                </div>
              </form>
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
