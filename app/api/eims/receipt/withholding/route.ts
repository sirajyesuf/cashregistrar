import { eimsRouteHandler } from "@/lib/eims/client"

export const runtime = "nodejs"

export async function POST(request: Request) {
  return eimsRouteHandler("/v1/receipt/withholding", request)
}
