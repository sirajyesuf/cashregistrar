"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Copy, Trash2, UserPlus, Users } from "lucide-react"
import { copyText } from "@/lib/copy"
import { InviteMemberDialog } from "@/components/invite-member-dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "@/components/toast"
import { cn } from "@/lib/utils"

type Member = {
  id: string
  role: "OWNER" | "MANAGER" | "CASHIER"
  branchId: string | null
  createdAt: string
  user: { id: string; name: string | null; email: string }
  branch: { id: string; name: string } | null
}

type Invitation = {
  id: string
  email: string
  role: "MANAGER" | "CASHIER"
  status: "PENDING" | "ACCEPTED" | "CANCELLED" | "EXPIRED"
  branchId: string | null
  createdAt: string
  expiresAt: string
  branch: { id: string; name: string } | null
  invitedBy: { id: string; name: string | null; email: string }
  acceptedBy: { id: string; name: string | null; email: string } | null
}

type Branch = { id: string; name: string }

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  CASHIER: "Cashier",
}

const INVITE_STATUS_STYLES: Record<Invitation["status"], string> = {
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  ACCEPTED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400",
  CANCELLED: "bg-muted text-muted-foreground",
  EXPIRED: "bg-muted text-muted-foreground",
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export default function MembersPage() {
  const params = useParams<{ businessId: string }>()
  const businessId = params.businessId
  const queryClient = useQueryClient()
  const [inviteOpen, setInviteOpen] = useState(false)

  const { data: businessData } = useQuery({
    queryKey: ["business", businessId],
    queryFn: async () => {
      const res = await fetch(`/api/businesses/${businessId}`)
      if (!res.ok) throw new Error("Could not load business")
      const body = (await res.json()) as {
        business: { id: string; name: string } | null
        role: string
      }
      return body
    },
    enabled: Boolean(businessId),
  })

  const { data: members = [], isPending: membersPending } = useQuery({
    queryKey: ["members", businessId],
    queryFn: async () => {
      const res = await fetch(`/api/businesses/${businessId}/members`)
      if (!res.ok) throw new Error("Could not load members")
      const body = (await res.json()) as { members: Member[] }
      return body.members
    },
    enabled: Boolean(businessId),
  })

  const { data: invitations = [], isPending: invitesPending } = useQuery({
    queryKey: ["invitations", businessId],
    queryFn: async () => {
      const res = await fetch(`/api/businesses/${businessId}/invitations`)
      if (!res.ok) throw new Error("Could not load invitations")
      const body = (await res.json()) as { invitations: Invitation[] }
      return body.invitations
    },
    enabled: Boolean(businessId),
  })

  const { data: branches = [] } = useQuery({
    queryKey: ["branches", businessId],
    queryFn: async () => {
      const res = await fetch(`/api/businesses/${businessId}/branches`)
      if (!res.ok) throw new Error("Could not load branches")
      const body = (await res.json()) as { branches: Branch[] }
      return body.branches
    },
    enabled: Boolean(businessId),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["members", businessId] })
    queryClient.invalidateQueries({ queryKey: ["invitations", businessId] })
    queryClient.invalidateQueries({ queryKey: ["businesses"] })
  }

  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      const res = await fetch(
        `/api/businesses/${businessId}/members/${memberId}`,
        { method: "DELETE" }
      )
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        throw new Error(body.error ?? `Failed to remove member (${res.status})`)
      }
    },
    onSuccess: () => {
      invalidate()
      toast.add({
        title: "Member removed",
        description: "The member was removed from this business.",
        type: "success",
      })
    },
    onError: (err) => {
      toast.add({
        title: "Could not remove member",
        description: err instanceof Error ? err.message : "Failed to remove member",
        type: "destructive",
      })
    },
  })

  const cancelInvitation = useMutation({
    mutationFn: async (invitationId: string) => {
      const res = await fetch(
        `/api/businesses/${businessId}/invitations/${invitationId}`,
        { method: "DELETE" }
      )
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        throw new Error(body.error ?? `Failed to cancel invite (${res.status})`)
      }
    },
    onSuccess: () => {
      invalidate()
      toast.add({
        title: "Invitation cancelled",
        description: "The invite link is no longer valid.",
        type: "success",
      })
    },
    onError: (err) => {
      toast.add({
        title: "Could not cancel invite",
        description: err instanceof Error ? err.message : "Failed to cancel invite",
        type: "destructive",
      })
    },
  })

  const copyInvitation = useMutation({
    mutationFn: async (invitationId: string): Promise<string> => {
      const res = await fetch(
        `/api/businesses/${businessId}/invitations/${invitationId}/link`,
        { method: "POST" }
      )
      const body = (await res.json().catch(() => ({}))) as { error?: string; link?: string }
      if (!res.ok || !body.link) {
        throw new Error(body.error ?? `Failed to copy link (${res.status})`)
      }
      return body.link
    },
    onSuccess: async (link) => {
      try {
        await copyText(link)
        toast.add({
          title: "Invite link copied",
          description: "A fresh link was created and copied. Share it with the invitee.",
          type: "success",
        })
      } catch {
        toast.add({
          title: "Could not copy link",
          description: "Try copying from the share dialog instead.",
          type: "destructive",
        })
      }
    },
    onError: (err) => {
      toast.add({
        title: "Could not copy link",
        description: err instanceof Error ? err.message : "Failed to copy link",
        type: "destructive",
      })
    },
  })

  const handleCopyLink = (invitation: Invitation) => {
    copyInvitation.mutate(invitation.id)
  }

  const handleRemoveMember = (member: Member) => {
    if (!window.confirm(`Remove ${member.user.name ?? member.user.email} from this business?`)) {
      return
    }
    removeMember.mutate(member.id)
  }

  const handleCancelInvite = (invitation: Invitation) => {
    if (!window.confirm(`Cancel the invitation for ${invitation.email}?`)) {
      return
    }
    cancelInvitation.mutate(invitation.id)
  }

  if (!businessData) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }

  if (businessData.role !== "OWNER") {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <div className="rounded-xl border border-dashed p-10 text-center">
          <Users className="mx-auto size-6 text-muted-foreground" />
          <h1 className="mt-3 text-lg font-semibold">Owner access required</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Only the business owner can manage members and invitations.
          </p>
          <Link href="/dashboard" className="mt-4 inline-block">
            <Button variant="outline">Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    )
  }

  const businessName = businessData.business?.name ?? ""

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team</h1>
          <p className="mt-1 text-sm text-muted-foreground">{businessName}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard">
            <Button variant="outline" size="sm">
              <ArrowLeft className="size-3.5" />
              Dashboard
            </Button>
          </Link>
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus className="size-3.5" />
            Invite member
          </Button>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-semibold">Members</h2>
        <div className="mt-3 rounded-xl border">
          {membersPending ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      {member.user.name || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {member.user.email}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {ROLE_LABELS[member.role] ?? member.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {member.branch?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {member.role !== "OWNER" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveMember(member)}
                          disabled={removeMember.isPending}
                        >
                          <Trash2 className="size-4 text-destructive" />
                          <span className="sr-only">
                            Remove {member.user.name ?? member.user.email}
                          </span>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold">Pending invitations</h2>
        <div className="mt-3 rounded-xl border">
          {invitesPending ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : invitations.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm text-muted-foreground">
                No invitations yet. Invite someone to join your team.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell className="font-medium">
                      {invitation.email}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {ROLE_LABELS[invitation.role] ?? invitation.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {invitation.branch?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                          INVITE_STATUS_STYLES[invitation.status]
                        )}
                      >
                        {invitation.status[0] + invitation.status.slice(1).toLowerCase()}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(invitation.expiresAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {invitation.status === "PENDING" && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopyLink(invitation)}
                              disabled={copyInvitation.isPending}
                            >
                              <Copy className="size-3.5" />
                              Copy link
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCancelInvite(invitation)}
                              disabled={cancelInvitation.isPending}
                            >
                              Cancel
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>

      <InviteMemberDialog
        businessId={businessId}
        branches={branches}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onCreated={invalidate}
      />
    </div>
  )
}
