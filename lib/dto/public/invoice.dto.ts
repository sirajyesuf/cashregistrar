import type { Invoice, InvoiceLine, Receipt } from "@prisma/client"
import type { InvoiceListResult } from "@/lib/services/invoice.service"

export type PublicInvoice = Invoice & {
  lines: InvoiceLine[]
  receipt?: Receipt | null
}

export function toPublicInvoice(invoice: PublicInvoice): PublicInvoice {
  return invoice
}

export function toPublicInvoiceList(result: InvoiceListResult): InvoiceListResult {
  return result
}