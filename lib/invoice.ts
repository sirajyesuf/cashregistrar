export type LineItem = {
  id: string
  description: string
  quantity: number
  rate: number
}

export type InvoiceData = {
  invoiceNumber: string
  date: string
  customerName: string
  lineItems: LineItem[]
  taxRate: number
}

export type InvoiceTotals = {
  subtotal: number
  taxAmount: number
  grandTotal: number
}

export function calculateTotals(
  lineItems: LineItem[],
  taxRate: number
): InvoiceTotals {
  const subtotal = lineItems.reduce(
    (sum, item) => sum + item.quantity * item.rate,
    0
  )
  const taxAmount = subtotal * (taxRate / 100)
  const grandTotal = subtotal + taxAmount
  return { subtotal, taxAmount, grandTotal }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "ETB",
  }).format(amount)
}

// Placeholder counter: resets every page load, so numbers repeat across sessions.
// Replace with a persisted sequence (e.g. an Invoice table counter) when invoices
// become durable.
let invoiceCounter = 1

export function generateInvoiceNumber(): string {
  const num = String(invoiceCounter++).padStart(3, "0")
  return `INV-${num}`
}

export function todayString(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}
