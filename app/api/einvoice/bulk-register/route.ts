import { eimsRouteHandler } from "@/lib/einvoice/client"

export const runtime = "nodejs"

export async function POST(request: Request) {
  return eimsRouteHandler("/v1/bulkRegister", request)
}
