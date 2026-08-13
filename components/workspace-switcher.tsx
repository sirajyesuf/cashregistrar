"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import {
  Building2,
  Check,
  ChevronDown,
  GitBranch,
  Plus,
  Settings,
  Settings2,
  Store,
  Users,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { useWorkspace } from "@/components/workspace-provider"
import { cn } from "@/lib/utils"

type WorkspaceBusiness = {
  id: string
  name: string
  role: "OWNER" | "MANAGER" | "CASHIER" | null
  branchId: string | null
  branches: { id: string; name: string; active: boolean }[]
}

async function fetchBusinesses(): Promise<WorkspaceBusiness[]> {
  const res = await fetch("/api/businesses")
  if (!res.ok) throw new Error("Failed to load businesses")
  const body = (await res.json()) as { businesses: WorkspaceBusiness[] }
  return body.businesses
}

export function WorkspaceSwitcher() {
  const router = useRouter()
  const { workspace, setWorkspace } = useWorkspace()
  const { data: businesses } = useQuery({
    queryKey: ["businesses"],
    queryFn: fetchBusinesses,
  })
  const [open, setOpen] = useState(false)

  const currentBusiness = businesses?.find((b) => b.id === workspace?.businessId)
  const currentBranch = currentBusiness?.branches.find(
    (b) => b.id === workspace?.branchId
  )
  const isOwner = currentBusiness?.role === "OWNER"

  const switchWorkspace = async (next: {
    businessId: string
    branchId: string
  }) => {
    setOpen(false)
    await setWorkspace(next)
    router.refresh()
  }

  const label = currentBusiness
    ? `${currentBusiness.name}${currentBranch ? ` · ${currentBranch.name}` : ""}`
    : businesses?.length
      ? "Select business"
      : "No business"

  const businessLabel = currentBusiness?.name ?? label

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        aria-label="Switch business or branch"
        className="min-w-0 max-w-44 gap-1.5 px-2 py-1.5 sm:max-w-56 sm:gap-2"
      >
        <Building2 className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate text-sm font-medium">{businessLabel}</span>
        {currentBusiness && currentBranch && (
          <span className="hidden truncate text-sm text-muted-foreground sm:inline">
            · {currentBranch.name}
          </span>
        )}
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72 p-1 max-[380px]:w-[calc(100vw-2rem)]">
        {!businesses ? (
          <div className="px-2.5 py-6 text-center">
            <Skeleton className="mx-auto h-10 w-40" />
          </div>
        ) : businesses.length === 0 ? (
          <div className="flex flex-col gap-3 px-2.5 py-5 text-center">
            <Store className="mx-auto size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              You don&apos;t belong to any business yet.
            </p>
            <DropdownMenuLinkItem
              render={<Link href="/businesses/new" />}
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-2 rounded-md bg-muted px-3 py-2 text-sm font-medium text-foreground"
            >
              <Plus className="size-3.5" />
              Create business
            </DropdownMenuLinkItem>
          </div>
        ) : (
          <>
            {currentBusiness && (
              <div className="mb-1 flex items-center justify-between gap-2 border-b px-2.5 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Building2 className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm font-semibold">
                    {currentBusiness.name}
                  </span>
                </div>
                {isOwner && (
                  <DropdownMenuLinkItem
                    render={
                      <Link href={`/businesses/${currentBusiness.id}/edit`} />
                    }
                    aria-label={`Edit ${currentBusiness.name}`}
                    onClick={() => setOpen(false)}
                    className="p-1.5"
                  >
                    <Settings2 className="size-4 text-muted-foreground" />
                  </DropdownMenuLinkItem>
                )}
              </div>
            )}
            <div className="max-h-80 overflow-y-auto px-1 py-1">
              {businesses.map((business) => {
                const active =
                  workspace?.businessId === business.id &&
                  !workspace.branchId
                return (
                  <div key={business.id} className="mb-1">
                    <p
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase",
                        active && "text-foreground"
                      )}
                    >
                      <Building2 className="size-3.5" />
                      {business.name}
                    </p>
                    {business.branches.map((branch) => {
                      const isCurrent =
                        workspace?.businessId === business.id &&
                        workspace?.branchId === branch.id
                      const canEditBranch =
                        business.role === "OWNER" ||
                        business.role === "MANAGER"
                      return (
                        <div
                          key={branch.id}
                          className={cn(
                            "flex items-center rounded-md",
                            isCurrent &&
                              "bg-muted text-foreground"
                          )}
                        >
                          <DropdownMenuItem
                            onClick={() =>
                              switchWorkspace({
                                businessId: business.id,
                                branchId: branch.id,
                              })
                            }
                            className={cn(
                              "flex-1 gap-2.5 pl-7",
                              isCurrent && "data-highlighted:bg-muted"
                            )}
                          >
                            {isCurrent && (
                              <Check className="size-3.5 text-primary" />
                            )}
                            <span className="truncate">{branch.name}</span>
                          </DropdownMenuItem>
                          {isCurrent && canEditBranch && (
                            <DropdownMenuLinkItem
                              render={
                                <Link
                                  href={`/businesses/${business.id}/branches/${branch.id}/edit`}
                                />
                              }
                              aria-label={`Edit ${branch.name}`}
                              onClick={() => setOpen(false)}
                              className="mr-1 p-1.5"
                            >
                              <Settings className="size-3.5 text-muted-foreground" />
                            </DropdownMenuLinkItem>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>

            <DropdownMenuSeparator />
            <div className="flex flex-col gap-0.5">
              {isOwner && currentBusiness && (
                <DropdownMenuLinkItem
                  render={
                    <Link
                      href={`/businesses/${currentBusiness.id}/members`}
                    />
                  }
                  onClick={() => setOpen(false)}
                  className="gap-2.5 px-2.5 py-2"
                >
                  <Users className="size-4 text-muted-foreground" />
                  Manage team
                </DropdownMenuLinkItem>
              )}
              {isOwner && currentBusiness && (
                <DropdownMenuLinkItem
                  render={
                    <Link
                      href={`/businesses/${currentBusiness.id}/branches/new`}
                    />
                  }
                  onClick={() => setOpen(false)}
                  className="gap-2.5 px-2.5 py-2"
                >
                  <GitBranch className="size-4 text-muted-foreground" />
                  Add branch
                </DropdownMenuLinkItem>
              )}
              <DropdownMenuLinkItem
                render={<Link href="/businesses/new" />}
                onClick={() => setOpen(false)}
                className="gap-2.5 px-2.5 py-2"
              >
                <Store className="size-4 text-muted-foreground" />
                Add business
              </DropdownMenuLinkItem>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
