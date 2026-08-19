"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useWorkspace } from "@/components/workspace-provider"

const ALLOWED_PATHS = ["/businesses/new", "/profile", "/api-keys"]

export function WorkspaceGuard() {
  const { workspace, isPending } = useWorkspace()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (isPending || workspace) return
    if (ALLOWED_PATHS.includes(pathname)) return
    router.replace("/businesses/new")
  }, [isPending, workspace, pathname, router])

  return null
}
