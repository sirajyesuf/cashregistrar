import { NextResponse } from "next/server"
import { getOpenApiDocument } from "@/lib/openapi"

export const runtime = "nodejs"

export async function GET() {
  return NextResponse.json(getOpenApiDocument())
}
