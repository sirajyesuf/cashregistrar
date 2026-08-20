import { Badge } from "@/components/ui/badge"

export function StatusBadge({ status }: { status: string | null }) {
  if (status === "REGISTERED")
    return <Badge variant="outline" className="text-success">Registered</Badge>
  if (status === "CANCELLED") return <Badge variant="outline">Cancelled</Badge>
  if (status === "FAILED") return <Badge variant="destructive">Failed</Badge>
  if (status === "PROCESSING")
    return <Badge variant="outline">Processing</Badge>
  return <Badge variant="outline">Unregistered</Badge>
}
