"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Copy, Trash2, UserPlus, Users } from "lucide-react"
import { copyText } from "@/lib/copy"
import { InviteMemberDialog } from "@/components/invite-member-dialog"
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Empty, EmptyContent, EmptyDescription, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "@/components/toast"

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

function InvitationStatusBadge({ status }: { status: Invitation["status"] }) {
  if (status === "ACCEPTED") return <Badge variant="success">Accepted</Badge>
  return <Badge variant="outline">{status[0] + status.slice(1).toLowerCase()}</Badge>
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
    removeMember.mutate(member.id)
  }

  const handleCancelInvite = (invitation: Invitation) => {
    cancelInvitation.mutate(invitation.id)
  }

  const membersSkeleton = (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/50 hover:bg-muted/50">
          <TableHead>
            <Skeleton className="h-4 w-24" />
          </TableHead>
          <TableHead>
            <Skeleton className="h-4 w-28" />
          </TableHead>
          <TableHead className="w-28">
            <Skeleton className="h-4 w-14" />
          </TableHead>
          <TableHead className="w-28">
            <Skeleton className="h-4 w-16" />
          </TableHead>
          <TableHead className="w-24 text-right">
            <Skeleton className="ml-auto h-4 w-10" />
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 4 }).map((_, i) => (
          <TableRow key={i}>
            <TableCell>
              <Skeleton className="h-4 w-32" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-40" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-14" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-16" />
            </TableCell>
            <TableCell className="text-right">
              <Skeleton className="ml-auto h-4 w-10" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )

  const invitationsSkeleton = (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/50 hover:bg-muted/50">
          <TableHead>
            <Skeleton className="h-4 w-24" />
          </TableHead>
          <TableHead className="w-24">
            <Skeleton className="h-4 w-12" />
          </TableHead>
          <TableHead className="w-28">
            <Skeleton className="h-4 w-16" />
          </TableHead>
          <TableHead className="w-24">
            <Skeleton className="h-4 w-14" />
          </TableHead>
          <TableHead className="w-28">
            <Skeleton className="h-4 w-16" />
          </TableHead>
          <TableHead className="w-28 text-right">
            <Skeleton className="ml-auto h-4 w-20" />
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 3 }).map((_, i) => (
          <TableRow key={i}>
            <TableCell>
              <Skeleton className="h-4 w-36" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-12" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-16" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-14" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-16" />
            </TableCell>
            <TableCell className="text-right">
              <Skeleton className="ml-auto h-4 w-20" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )

  if (!businessData) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Skeleton className="h-7 w-32" />
            <Skeleton className="mt-2 h-4 w-48" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-36" />
          </div>
        </div>

        <section className="mt-8">
          <Skeleton className="h-4 w-20" />
          <div className="mt-3 rounded-xl border">{membersSkeleton}</div>
        </section>

        <section className="mt-8">
          <Skeleton className="h-4 w-36" />
          <div className="mt-3 rounded-xl border">{invitationsSkeleton}</div>
        </section>
      </div>
    )
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
            membersSkeleton
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
                        <AlertDialog>
                          <AlertDialogTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={removeMember.isPending}
                              />
                            }
                          >
                            <Trash2 className="size-4 text-destructive" />
                            <span className="sr-only">
                              Remove {member.user.name ?? member.user.email}
                            </span>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove member?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Remove {member.user.name ?? member.user.email}{" "}
                                from this business?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Keep member</AlertDialogCancel>
                              <AlertDialogCancel
                                variant="destructive"
                                onClick={() => handleRemoveMember(member)}
                                disabled={removeMember.isPending}
                              >
                                Remove member
                              </AlertDialogCancel>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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
            invitationsSkeleton
          ) : invitations.length === 0 ? (
            <Empty className="p-10">
              <EmptyContent>
                <EmptyTitle>No invitations yet</EmptyTitle>
                <EmptyDescription>
                  Invite someone to join your team.
                </EmptyDescription>
              </EmptyContent>
            </Empty>
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
                      <InvitationStatusBadge status={invitation.status} />
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
                              <Copy data-icon="inline-start" />
                              Copy link
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger
                                render={
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={cancelInvitation.isPending}
                                  />
                                }
                              >
                                Cancel
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Cancel the invitation?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Cancel the invitation for {invitation.email}?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Keep it</AlertDialogCancel>
                                  <AlertDialogCancel
                                    variant="destructive"
                                    onClick={() => handleCancelInvite(invitation)}
                                    disabled={cancelInvitation.isPending}
                                  >
                                    Cancel invitation
                                  </AlertDialogCancel>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
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
