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

export function calculateTotals(lineItems: LineItem[], taxRate: number): InvoiceTotals {
  const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.rate, 0)
  const taxAmount = subtotal * (taxRate / 100)
  const grandTotal = subtotal + taxAmount
  return { subtotal, taxAmount, grandTotal }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "ETB" }).format(amount)
}

let invoiceCounter = 1

export function generateInvoiceNumber(): string {
  const num = String(invoiceCounter++).padStart(3, "0")
  return `INV-${num}`
}

export function todayString(): string {
  return new Date().toISOString().split("T")[0]
}
