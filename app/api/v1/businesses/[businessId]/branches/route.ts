import { NextResponse } from "next/server"
import { authenticateApiKey } from "@/lib/api-key"
import { branchCreateSchema } from "@/lib/business-schema"
import { createBranch, listBranches } from "@/lib/business-service"

export const runtime = "nodejs"

type Context = { params: Promise<{ businessId: string }> }

export async function GET(request: Request, { params }: Context) {
  const auth = await authenticateApiKey(request)
  if (!auth)
    return NextResponse.json(
      { error: "Invalid or missing API key" },
      { status: 401 }
    )

  const { businessId } = await params
  const result = await listBranches(auth.userId, businessId)
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ branches: result.data })
}

export async function POST(request: Request, { params }: Context) {
  const auth = await authenticateApiKey(request)
  if (!auth)
    return NextResponse.json(
      { error: "Invalid or missing API key" },
      { status: 401 }
    )

  const { businessId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = branchCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((issue) => issue.message).join("; ") },
      { status: 400 }
    )
  }

  const result = await createBranch(auth.userId, businessId, parsed.data)
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ branch: result.data }, { status: 201 })
}
