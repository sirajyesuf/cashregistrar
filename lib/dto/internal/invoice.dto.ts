import type { Invoice, InvoiceLine, Receipt } from "@prisma/client"
import type { InvoiceListResult } from "@/lib/services/invoice.service"

export type InternalInvoice = Invoice & {
  lines: InvoiceLine[]
  receipt?: Receipt | null
}

export function toInternalInvoice(invoice: InternalInvoice): InternalInvoice {
  return invoice
}

export function toInternalInvoiceList(result: InvoiceListResult): InvoiceListResult {
  return result
}