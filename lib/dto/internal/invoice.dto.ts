import type { Invoice, InvoiceLine, Receipt, WithholdingReceipt } from "@prisma/client"
import type { InvoiceListResult } from "@/lib/services/invoice.service"

export type InternalInvoice = Invoice & {
  lines: InvoiceLine[]
  receipt?: Receipt | null
  withholdingReceipt?: WithholdingReceipt | null
}

export function toInternalInvoice(invoice: InternalInvoice): InternalInvoice {
  return invoice
}

export function toInternalInvoiceList(result: InvoiceListResult): InvoiceListResult {
  return result
}