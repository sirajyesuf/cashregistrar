import type { Invoice } from "@prisma/client"

import { getConfig } from "./config"

export type SalesReceiptPayload = {
  ReceiptNumber: string
  ReceiptType: string
  Reason: string
  ReceiptDate: string
  ReceiptCounter: string
  ManualReceiptNumber: string | null
  SourceSystemType: string
  SourceSystemNumber: string
  ReceiptCurrency: string
  ExchangeRate: number | null
  CollectedAmount: number
  SellerTIN: string
  Invoices: {
    InvoiceIRN: string
    PaymentCoverage: string
    InvoicePaidAmount: number
    DiscountAmount: number | null
    RemainingAmount: number | null
    TotalAmount: number
  }[]
  TransactionDetails: {
    ModeOfPayment: string
    ChequeNumber: string | null
    CPONumber: string | null
    DocumentNumber: string | null
    CollectorName: string
    PaymentServiceProvider: string | null
    OtherPaymentServiceProviderName: string | null
    AccountNumber: string | null
    TransactionNumber: string | null
  }
}

/**
 * Formats a Date as an ISO 8601 string with the Ethiopian timezone offset
 * (+03:00, no DST), matching the ReceiptDate format EIMS expects, e.g.
 * "2026-08-06T15:30:00.000+03:00".
 */
function toReceiptDate(date: Date): string {
  const offsetMs = 3 * 60 * 60 * 1000
  const local = new Date(date.getTime() + offsetMs)
  return local.toISOString().replace("Z", "+03:00")
}

/**
 * Builds the EIMS /v1/receipt/sales payload for a registered invoice.
 *
 * A sales receipt records a payment collected against one or more registered
 * invoices. Values are derived from the invoice and the EIMS config:
 * - ReceiptNumber / ReceiptCounter come from the receipt counter
 * - CollectedAmount, InvoicePaidAmount and TotalAmount = the invoice grand total
 * - PaymentCoverage is always FULL (one receipt fully settles the invoice)
 * - TransactionDetails.ModeOfPayment / CollectorName come from the invoice
 *   (paymentMode / cashierName)
 */
export function buildSalesReceiptPayload(params: {
  invoice: Invoice
  receiptCounter: number
}): SalesReceiptPayload {
  const cfg = getConfig()
  const counter = params.receiptCounter
  const total = Number(params.invoice.grandTotal)

  return {
    ReceiptNumber: `REC${String(counter).padStart(15, "0")}`,
    ReceiptType: "Sales Receipts",
    Reason: "Payment for goods purchased",
    ReceiptDate: toReceiptDate(new Date()),
    ReceiptCounter: String(counter),
    ManualReceiptNumber: null,
    SourceSystemType: cfg.systemType,
    SourceSystemNumber: cfg.systemNumber,
    ReceiptCurrency: "ETB",
    ExchangeRate: null,
    CollectedAmount: total,
    SellerTIN: cfg.tin,
    Invoices: [
      {
        InvoiceIRN: params.invoice.irn ?? "",
        PaymentCoverage: "FULL",
        InvoicePaidAmount: total,
        DiscountAmount: null,
        RemainingAmount: null,
        TotalAmount: total,
      },
    ],
    TransactionDetails: {
      ModeOfPayment: params.invoice.paymentMode,
      ChequeNumber: null,
      CPONumber: null,
      DocumentNumber: null,
      CollectorName: params.invoice.cashierName,
      PaymentServiceProvider: null,
      OtherPaymentServiceProviderName: null,
      AccountNumber: null,
      TransactionNumber: null,
    },
  }
}
