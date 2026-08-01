export type LineItemCents = {
  id: string
  description: string
  quantity: number
  unitPriceCents: number
  totalCents: number
}

export type InvoiceTotalsCents = {
  subtotalCents: number
  taxAmountCents: number
  grandTotalCents: number
}

export type PreviewLineItem = LineItemCents

export type PreviewInvoice = {
  id: string
  number: string
  date: string
  customerName: string
  taxRate: number
  lineItems: PreviewLineItem[]
} & InvoiceTotalsCents

export type SellerInfo = {
  businessName: string
  street: string
  city: string
  country: string
}

export function moneyToCents(value: string | number): number {
  const num = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(num)) return 0
  return Math.round(num * 100)
}

export function centsToMoney(cents: number): string {
  const value = Math.round(cents) / 100
  return value.toFixed(2)
}

export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-ET", {
    style: "currency",
    currency: "ETB",
  }).format(Math.round(cents) / 100)
}

export function calculateTotalsCents(
  lineItems: LineItemCents[],
  taxRate: number
): InvoiceTotalsCents {
  const subtotalCents = lineItems.reduce(
    (sum, item) => sum + item.totalCents,
    0
  )
  const taxAmountCents = Math.round((subtotalCents * taxRate) / 100)
  const grandTotalCents = subtotalCents + taxAmountCents
  return { subtotalCents, taxAmountCents, grandTotalCents }
}

export function lineTotalCents(
  quantity: number,
  unitPriceCents: number
): number {
  return Math.round(quantity * unitPriceCents)
}

type ApiMoney = string | number

type ApiLine = {
  id: string
  description: string
  quantity: ApiMoney
  unitPrice: ApiMoney
  total: ApiMoney
}

type ApiInvoice = {
  id: string
  number: string
  date: string
  customerName: string
  taxRate: ApiMoney
  subtotal: ApiMoney
  taxAmount: ApiMoney
  grandTotal: ApiMoney
  lines: ApiLine[]
}

export function invoiceFromApi(invoice: ApiInvoice): PreviewInvoice {
  const lineItems: PreviewLineItem[] = invoice.lines.map((line) => ({
    id: line.id,
    description: line.description,
    quantity: Number(line.quantity),
    unitPriceCents: moneyToCents(line.unitPrice),
    totalCents: moneyToCents(line.total),
  }))
  return {
    id: invoice.id,
    number: invoice.number,
    date: invoice.date.slice(0, 10),
    customerName: invoice.customerName,
    taxRate: Number(invoice.taxRate),
    lineItems,
    subtotalCents: moneyToCents(invoice.subtotal),
    taxAmountCents: moneyToCents(invoice.taxAmount),
    grandTotalCents: moneyToCents(invoice.grandTotal),
  }
}

export function todayString(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}
