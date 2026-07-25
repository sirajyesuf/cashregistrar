import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Page() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">CashRegistrar</h1>
        <p className="mt-2 text-muted-foreground">Invoice Generator</p>
      </div>
      <Link href="/invoices">
        <Button size="lg">Create Invoice</Button>
      </Link>
    </div>
  )
}
