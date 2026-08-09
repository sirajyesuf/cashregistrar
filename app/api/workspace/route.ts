import { NextResponse } from "next/server"
import { z } from "zod"
import { getSessionUser } from "@/lib/auth/user"
import {
  canAccessWorkspace,
  getWorkspace,
  saveWorkspace,
} from "@/lib/workspace"

export const runtime = "nodejs"

const workspaceBodySchema = z.object({
  businessId: z.string().trim().min(1),
  branchId: z.string().trim().min(1),
})

export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const workspace = await getWorkspace(user.id)
  return NextResponse.json({
    workspace: workspace
      ? { businessId: workspace.businessId, branchId: workspace.branchId }
      : null,
  })
}

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = workspaceBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((issue) => issue.message).join("; ") },
      { status: 400 }
    )
  }

  const { businessId, branchId } = parsed.data

  const accessible = await canAccessWorkspace(user.id, businessId, branchId)
  if (!accessible) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
  }

  await saveWorkspace(user.id, businessId, branchId)
  return NextResponse.json({ workspace: { businessId, branchId } })
}
