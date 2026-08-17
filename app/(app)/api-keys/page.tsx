"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { KeyRound, Plus, Trash2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
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
import { CreateApiKeyDialog } from "@/components/create-api-key-dialog"
import { maskApiKey } from "@/lib/api-key"

type ApiKey = {
  id: string
  name: string
  prefix: string
  lastUsedAt: string | null
  createdAt: string
}

function formatDate(value: string | null): string {
  if (!value) return "Never"
  return new Date(value).toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export default function ApiKeysPage() {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)

  const { data: apiKeys = [], isPending } = useQuery({
    queryKey: ["api-keys"],
    queryFn: async () => {
      const res = await fetch("/api/api-keys")
      if (!res.ok) throw new Error("Failed to load API keys")
      const body = (await res.json()) as { apiKeys: ApiKey[] }
      return body.apiKeys
    },
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["api-keys"] })
  }

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/api-keys/${id}`, { method: "DELETE" })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        throw new Error(body.error ?? `Failed to delete key (${res.status})`)
      }
    },
    onSuccess: () => {
      invalidate()
      toast.add({
        title: "API key deleted",
        description: "The key is no longer valid.",
        type: "success",
      })
    },
    onError: (err) => {
      toast.add({
        title: "Could not delete key",
        description: err instanceof Error ? err.message : "Failed to delete",
        type: "destructive",
      })
    },
  })

  const loadingSkeleton = (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead>
              <Skeleton className="h-4 w-24" />
            </TableHead>
            <TableHead className="w-40">
              <Skeleton className="h-4 w-28" />
            </TableHead>
            <TableHead className="w-32">
              <Skeleton className="h-4 w-24" />
            </TableHead>
            <TableHead className="w-32">
              <Skeleton className="h-4 w-16" />
            </TableHead>
            <TableHead className="w-20 text-right">
              <Skeleton className="ml-auto h-4 w-12" />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 3 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-4 w-32" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-28" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-16" />
              </TableCell>
              <TableCell className="text-right">
                <Skeleton className="ml-auto h-4 w-12" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">API Keys</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create and manage API keys for programmatic access.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus data-icon="inline-start" />
          Create API Key
        </Button>
      </div>

      {isPending ? (
        loadingSkeleton
      ) : apiKeys.length === 0 ? (
        <Empty className="rounded-xl border border-dashed p-10">
          <EmptyMedia variant="icon">
            <KeyRound />
          </EmptyMedia>
          <EmptyContent>
            <EmptyTitle>No API keys yet</EmptyTitle>
            <EmptyDescription>
              Create a key to integrate with the API.
            </EmptyDescription>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus data-icon="inline-start" />
              Create API Key
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead>Name</TableHead>
                <TableHead className="w-40">Key</TableHead>
                <TableHead className="w-32">Created</TableHead>
                <TableHead className="w-32">Last used</TableHead>
                <TableHead className="w-20 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apiKeys.map((apiKey) => (
                <TableRow key={apiKey.id}>
                  <TableCell className="font-medium">{apiKey.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {maskApiKey(apiKey.prefix)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(apiKey.createdAt)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(apiKey.lastUsedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <AlertDialog>
                      <AlertDialogTrigger
                        render={<Button variant="ghost" size="sm" />}
                      >
                        <Trash2 className="size-4 text-destructive" />
                        <span className="sr-only">
                          Delete {apiKey.name}
                        </span>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Delete &quot;{apiKey.name}&quot;?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Requests using this key will fail immediately. This
                            cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Keep key</AlertDialogCancel>
                          <AlertDialogCancel
                            variant="destructive"
                            onClick={() => deleteMutation.mutate(apiKey.id)}
                            disabled={deleteMutation.isPending}
                          >
                            Delete key
                          </AlertDialogCancel>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateApiKeyDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={invalidate}
      />
    </div>
  )
}
