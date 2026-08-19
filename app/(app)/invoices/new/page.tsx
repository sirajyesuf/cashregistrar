import Link from "next/link"
import { redirect } from "next/navigation"
import { AlertTriangle, Building2 } from "lucide-react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { InvoiceForm } from "@/components/invoice/invoice-form"
import { getSessionUser } from "@/lib/auth/user"
import { prisma } from "@/lib/db"
import { getWorkspace } from "@/lib/workspace"

export default async function NewInvoicePage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")

  const workspace = await getWorkspace(user.id)
  let workspaceLabel: string | null = null
  let productCount = 0
  if (workspace) {
    const [business, branch, products] = await Promise.all([
      prisma.business.findUnique({
        where: { id: workspace.businessId },
        select: { name: true },
      }),
      prisma.branch.findUnique({
        where: { id: workspace.branchId },
        select: { name: true },
      }),
      prisma.product.count({ where: { businessId: workspace.businessId } }),
    ])
    workspaceLabel = `${business?.name ?? ""} · ${branch?.name ?? ""}`
    productCount = products
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">New Invoice</h1>
          {workspaceLabel ? (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Building2 className="size-3.5" />
              Issuing from {workspaceLabel}
            </p>
          ) : (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-destructive">
              <Building2 className="size-3.5" />
              No workspace selected. Select or create a business and branch
              first.
            </p>
          )}
        </div>
        <Link href="/invoices">
          <Button variant="outline">Back to Invoices</Button>
        </Link>
      </div>
      {workspace && productCount === 0 ? (
        <Alert>
          <AlertTriangle className="size-4" />
          <AlertTitle>No products yet</AlertTitle>
          <AlertDescription>
            You need at least one product before you can create an invoice.{" "}
            <Link
              href="/products"
              className="font-medium text-foreground underline underline-offset-3 hover:text-primary"
            >
              Add products first
            </Link>
            .
          </AlertDescription>
        </Alert>
      ) : workspace ? (
        <InvoiceForm />
      ) : null}
    </div>
  )
}
