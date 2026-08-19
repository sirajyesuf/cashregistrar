import type { Invoice } from "@prisma/client"

import type { EimsConfig } from "./config"

export type WithholdingReceiptPayload = {
  ReceiptNumber: string
  Reason: string
  ReceiptCounter: string
  ManualReceiptNumber: string | null
  SourceSystemType: string
  SourceSystemNumber: string
  InvoiceDetail: {
    InvoiceIRN: string
    Currency: string
    ExchangeRate: null
  }
  WithholdDetail: {
    Type: "TWHT"
    Rate: null
    PreTaxAmount: number
    WithholdingAmount: number
  }
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/**
 * Builds the EIMS /v1/receipt/withholding payload for a registered B2B invoice.
 *
 * A withholding receipt documents the income withholding tax that the buyer
 * deducts from the payment and remits to the tax authority on the seller's
 * behalf. The amount is derived from the invoice's pre-tax subtotal and its
 * incomeWithholdRate (default 2%); the document type is always "TWHT".
 */
export function buildWithholdingReceiptPayload(params: {
  invoice: Invoice
  receiptCounter: number
  cfg: EimsConfig
}): WithholdingReceiptPayload {
  const cfg = params.cfg
  const counter = params.receiptCounter
  const subtotal = Number(params.invoice.subtotal)
  const rate = Number(params.invoice.incomeWithholdRate ?? 2)

  return {
    ReceiptNumber: `REC${String(counter).padStart(15, "0")}`,
    Reason: "Withold for goods purchased",
    ReceiptCounter: String(counter),
    ManualReceiptNumber: null,
    SourceSystemType: cfg.systemType,
    SourceSystemNumber: cfg.systemNumber,
    InvoiceDetail: {
      InvoiceIRN: params.invoice.irn ?? "",
      Currency: "ETB",
      ExchangeRate: null,
    },
    WithholdDetail: {
      Type: "TWHT",
      Rate: null,
      PreTaxAmount: round2(subtotal),
      WithholdingAmount: round2((subtotal * rate) / 100),
    },
  }
}
