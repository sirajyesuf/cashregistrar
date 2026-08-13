"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import {
  InvoiceForm,
  type InvoiceFormInitial,
} from "@/components/invoice/invoice-form"
import { centsToMoney, moneyToCents } from "@/lib/invoice"
import { type Unit } from "@/lib/units"
import { Skeleton } from "@/components/ui/skeleton"

type ApiLine = {
  id: string
  description: string
  quantity: string
  unitPrice: string
  itemCode?: string | null
  unit?: Unit | null
}

type ApiInvoice = {
  id: string
  number: string
  date: string
  taxCode?: string | null
  taxRate: string
  transactionType?: string | null
  buyerLegalName?: string | null
  buyerTin?: string | null
  buyerVatNumber?: string | null
  buyerIdType?: string | null
  buyerIdNumber?: string | null
  buyerEmail?: string | null
  buyerPhone?: string | null
  buyerCity?: string | null
  buyerRegion?: string | null
  buyerCountry?: string | null
  buyerZone?: string | null
  buyerKebele?: string | null
  buyerWereda?: string | null
  buyerHouseNumber?: string | null
  incomeWithholdRate?: string | null
  cashierName?: string | null
  salesPersonName?: string | null
  registrationStatus?: string | null
  lines: ApiLine[]
}

function formInitialFromApi(invoice: ApiInvoice): InvoiceFormInitial {
  return {
    date: invoice.date.slice(0, 10),
    lines: invoice.lines.map((line) => ({
      description: line.description,
      quantity: String(Number(line.quantity)),
      unitPrice: centsToMoney(moneyToCents(line.unitPrice)),
      itemCode: line.itemCode ?? "",
      unit: line.unit ?? "PCS",
    })),
    taxCode: invoice.taxCode ?? "VAT15",
    taxRate: Number(invoice.taxRate),
    transactionType: invoice.transactionType === "B2C" ? "B2C" : "B2B",
    buyer: {
      legalName: invoice.buyerLegalName ?? "",
      tin: invoice.buyerTin ?? "",
      vatNumber: invoice.buyerVatNumber ?? "",
      idType: invoice.buyerIdType ?? "",
      idNumber: invoice.buyerIdNumber ?? "",
      email: invoice.buyerEmail ?? "",
      phone: invoice.buyerPhone ?? "",
      city: invoice.buyerCity ?? "",
      region: invoice.buyerRegion ?? "",
      country: invoice.buyerCountry ?? "",
      zone: invoice.buyerZone ?? "",
      kebele: invoice.buyerKebele ?? "",
      wereda: invoice.buyerWereda ?? "",
      houseNumber: invoice.buyerHouseNumber ?? "",
    },
    cashierName: invoice.cashierName ?? "AAA",
    salesPersonName: invoice.salesPersonName ?? "AAA",
    incomeWithholdRate: Number(invoice.incomeWithholdRate) || 2,
  }
}

export default function EditInvoicePage() {
  const { id } = useParams<{ id: string }>()

  const {
    data: invoice,
    error,
    isLoading,
  } = useQuery({
    queryKey: ["invoice", id, "edit"],
    queryFn: async () => {
      const res = await fetch(`/api/invoices/${id}`)
      if (res.status === 404) throw new Error("NOT_FOUND")
      if (!res.ok) throw new Error("Failed to load invoice")
      const body = (await res.json()) as { invoice: ApiInvoice }
      return body.invoice
    },
  })

  const notFound = error?.message === "NOT_FOUND"
  const errorMessage =
    error && error.message !== "NOT_FOUND" ? error.message : null

  const locked = invoice?.registrationStatus === "REGISTERED"

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          Edit Invoice {invoice?.number ? `— ${invoice.number}` : ""}
        </h1>
        <Link href={`/invoices/${id}`}>
          <Button variant="outline">View invoice</Button>
        </Link>
      </div>

      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

      {!errorMessage && notFound && (
        <p className="text-sm text-muted-foreground">Invoice not found.</p>
      )}

      {!errorMessage && !notFound && isLoading && (
        <Skeleton className="h-24 w-full" />
      )}

      {invoice && locked && (
        <div className="rounded-lg border p-10 text-center">
          <p className="text-muted-foreground">
            This invoice is registered with EIMS and can no longer be edited.
          </p>
          <Link href={`/invoices/${id}`} className="mt-4 inline-block">
            <Button>View invoice</Button>
          </Link>
        </div>
      )}

      {invoice && !locked && (
        <InvoiceForm
          key={invoice.id}
          invoiceId={invoice.id}
          initial={formInitialFromApi(invoice)}
        />
      )}
    </div>
  )
}
