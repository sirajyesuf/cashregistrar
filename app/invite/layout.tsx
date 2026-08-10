import { QueryProvider } from "@/components/query-provider"

export default function InviteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <QueryProvider>{children}</QueryProvider>
}
