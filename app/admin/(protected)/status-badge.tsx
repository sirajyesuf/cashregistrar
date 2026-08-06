import { Badge } from "@/components/ui/badge"

export function StatusBadge({ status }: { status: string | null }) {
  if (status === "REGISTERED")
    return <Badge variant="success">Registered</Badge>
  if (status === "CANCELLED") return <Badge variant="outline">Cancelled</Badge>
  if (status === "FAILED") return <Badge variant="destructive">Failed</Badge>
  return <Badge variant="outline">Unregistered</Badge>
}
