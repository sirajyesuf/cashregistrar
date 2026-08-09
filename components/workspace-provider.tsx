"use client"

import { createContext, useCallback, useContext } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

export type Workspace = { businessId: string; branchId: string } | null

type WorkspaceContextValue = {
  workspace: Workspace
  isPending: boolean
  setWorkspace: (workspace: Exclude<Workspace, null>) => Promise<void>
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  workspace: null,
  isPending: true,
  setWorkspace: async () => {},
})

export function useWorkspace() {
  return useContext(WorkspaceContext)
}

async function fetchWorkspace(): Promise<Workspace> {
  const res = await fetch("/api/workspace")
  if (!res.ok) return null
  const body = (await res.json()) as { workspace: Workspace }
  return body.workspace
}

async function postWorkspace(next: Exclude<Workspace, null>): Promise<void> {
  const res = await fetch("/api/workspace", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(next),
  })
  if (!res.ok) throw new Error("Could not save workspace")
}

export function WorkspaceProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const queryClient = useQueryClient()

  const { data: workspace = null, isPending } = useQuery({
    queryKey: ["workspace"],
    queryFn: fetchWorkspace,
  })

  const { mutateAsync: persistWorkspace } = useMutation({
    mutationFn: postWorkspace,
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: ["workspace"] })
      const previous = queryClient.getQueryData<Workspace>(["workspace"])
      queryClient.setQueryData(["workspace"], next)
      return { previous }
    },
    onError: (_error, _next, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(["workspace"], context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace"] })
      queryClient.invalidateQueries({ queryKey: ["businesses"] })
      queryClient.invalidateQueries({ queryKey: ["invoices"] })
      queryClient.invalidateQueries({ queryKey: ["invoice"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })

  const setWorkspace = useCallback(
    (next: Exclude<Workspace, null>) => persistWorkspace(next),
    [persistWorkspace]
  )

  return (
    <WorkspaceContext.Provider value={{ workspace, isPending, setWorkspace }}>
      {children}
    </WorkspaceContext.Provider>
  )
}
