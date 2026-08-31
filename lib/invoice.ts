import { type Unit } from "@/lib/units"

export type TransactionType = "B2B" | "B2C"

export type BuyerDetails = {
  city: string
  email: string
  houseNumber: string
  idNumber: string
  idType: string
  tin: string
  legalName: string
  phone: string
  region: string
  country: string
  zone: string
  kebele: string
  vatNumber: string
  wereda: string
}

export const EMPTY_BUYER: BuyerDetails = {
  city: "",
  email: "",
  houseNumber: "",
  idNumber: "",
  idType: "KID",
  tin: "",
  legalName: "",
  phone: "",
  region: "",
  country: "",
  zone: "",
  kebele: "",
  vatNumber: "",
  wereda: "",
}

/**
 * True when no meaningful buyer information has been entered. Used by the
 * invoice form to send `buyer: null` for B2C invoices without buyer details.
 */
export function isBlankBuyer(
  buyer: { [K in keyof BuyerDetails]?: string | null | undefined }
): boolean {
  return ["legalName", "tin", "vatNumber", "email", "phone", "idNumber"].every(
    (key) => !buyer[key as keyof BuyerDetails]?.trim()
  )
}

export const TEST_BUYER: BuyerDetails = {
  legalName: "Taxpayer A",
  tin: "0089238373",
  vatNumber: "1000000001",
  idType: "KID",
  idNumber: "111222333444",
  email: "codethicaet@gmail.com",
  phone: "9110912450",
  region: "1",
  city: "101",
  country: "70",
  zone: "A",
  kebele: "Near Airport",
  wereda: "574",
  houseNumber: "101",
}

export const TEST_BUYER_B2C: BuyerDetails = {
  legalName: "Test Customer",
  tin: "0089238373",
  vatNumber: "1000000000",
  idType: "KID",
  idNumber: "999999999999",
  email: "customer@test.com",
  phone: "9111111111",
  region: "1",
  city: "101",
  country: "70",
  zone: "A",
  kebele: "01",
  wereda: "574",
  houseNumber: "101",
}

export type LineItemCents = {
  id: string
  description: string
  quantity: number
  unitPriceCents: number
  totalCents: number
  itemCode?: string
  unit?: string
}

export type InvoiceTotalsCents = {
  subtotalCents: number
  taxAmountCents: number
  grandTotalCents: number
}

export type PreviewLineItem = LineItemCents

export type SellerInfo = {
  businessName: string
  street: string
  city: string
  country: string
  legalName?: string
  tin?: string
  vatNumber?: string
  email?: string
  phone?: string
  region?: string
  subCity?: string
  wereda?: string
  houseNumber?: string
  locality?: string
}

export type RegistrationStatus =
  "PENDING" | "PROCESSING" | "REGISTERED" | "CANCELLED" | "FAILED"

export type CancellationErrorDetails = {
  statusCode?: number | null
  message?: string | null
  issues?: { portion: string; messages: string[] }[]
  raw?: unknown
}

export type PreviewInvoice = {
  id: string
  number: string
  businessId: string
  date: string
  taxCode?: string | null
  taxRate: number
  lineItems: PreviewLineItem[]
  transactionType?: TransactionType
  buyer?: Partial<BuyerDetails>
  seller: SellerInfo
  irn?: string | null
  registrationStatus?: RegistrationStatus | null
  cancellationReason?: string | null
  cancellationRemark?: string | null
  cancellationError?: CancellationErrorDetails | null
  cancelledAt?: string | null
  receipt?: {
    number: string | null
    rrn: string | null
    qr: string | null
    eimsStatus: string | null
    status: string | null
  } | null
  withholdingReceipt?: {
    number: string | null
    rrn: string | null
    qr: string | null
    eimsStatus: string | null
    status: string | null
  } | null
} & InvoiceTotalsCents

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
  const taxAmountCents = Math.round(subtotalCents * taxRate)
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
  itemCode?: string | null
  unit?: Unit | null
}

type ApiInvoice = {
  id: string
  number: string
  businessId: string
  date: string
  taxCode?: string | null
  taxRate: ApiMoney
  subtotal: ApiMoney
  taxAmount: ApiMoney
  grandTotal: ApiMoney
  lines: ApiLine[]
  transactionType?: string | null
  buyerLegalName?: string | null
  buyerTin?: string | null
  irn?: string | null
  registrationStatus?: string | null
  cancellationReason?: string | null
  cancellationRemark?: string | null
  cancellationError?: CancellationErrorDetails | null
  cancelledAt?: string | null
  receipt?: {
    number: string | null
    rrn: string | null
    qr: string | null
    eimsStatus: string | null
    status: string | null
  } | null
  withholdingReceipt?: {
    number: string | null
    rrn: string | null
    qr: string | null
    eimsStatus: string | null
    status: string | null
  } | null
  sellerCity?: string | null
  sellerCountry?: string | null
  sellerEmail?: string | null
  sellerHouseNumber?: string | null
  sellerLegalName?: string | null
  sellerLocality?: string | null
  sellerPhone?: string | null
  sellerRegion?: string | null
  sellerSubCity?: string | null
  sellerTin?: string | null
  sellerVatNumber?: string | null
  sellerWereda?: string | null
}

export function invoiceFromApi(invoice: ApiInvoice): PreviewInvoice {
  const lineItems: PreviewLineItem[] = invoice.lines.map((line) => ({
    id: line.id,
    description: line.description,
    quantity: Number(line.quantity),
    unitPriceCents: moneyToCents(line.unitPrice),
    totalCents: moneyToCents(line.total),
    itemCode: line.itemCode ?? undefined,
    unit: line.unit ?? undefined,
  }))
  return {
    id: invoice.id,
    number: invoice.number,
    businessId: invoice.businessId,
    date: invoice.date.slice(0, 10),
    taxCode: invoice.taxCode ?? undefined,
    taxRate: Number(invoice.taxRate),
    lineItems,
    transactionType:
      invoice.transactionType === "B2B" || invoice.transactionType === "B2C"
        ? invoice.transactionType
        : undefined,
    buyer: invoice.buyerLegalName
      ? {
          legalName: invoice.buyerLegalName,
          tin: invoice.buyerTin ?? undefined,
        }
      : undefined,
    seller: {
      businessName: invoice.sellerLegalName ?? "",
      street: "",
      city: invoice.sellerCity ?? "",
      country: invoice.sellerCountry ?? "",
      legalName: invoice.sellerLegalName ?? undefined,
      tin: invoice.sellerTin ?? undefined,
      vatNumber: invoice.sellerVatNumber ?? undefined,
      email: invoice.sellerEmail ?? undefined,
      phone: invoice.sellerPhone ?? undefined,
      region: invoice.sellerRegion ?? undefined,
      subCity: invoice.sellerSubCity ?? undefined,
      wereda: invoice.sellerWereda ?? undefined,
      houseNumber: invoice.sellerHouseNumber ?? undefined,
      locality: invoice.sellerLocality ?? undefined,
    },
    irn: invoice.irn ?? null,
    registrationStatus: invoice.registrationStatus as
      RegistrationStatus | null | undefined,
    cancellationReason: invoice.cancellationReason ?? null,
    cancellationRemark: invoice.cancellationRemark ?? null,
    cancellationError: invoice.cancellationError ?? null,
    cancelledAt: invoice.cancelledAt ?? null,
    receipt: invoice.receipt
      ? {
          number: invoice.receipt.number ?? null,
          rrn: invoice.receipt.rrn ?? null,
          qr: invoice.receipt.qr ?? null,
          eimsStatus: invoice.receipt.eimsStatus ?? null,
          status: invoice.receipt.status ?? null,
        }
      : null,
    withholdingReceipt: invoice.withholdingReceipt
      ? {
          number: invoice.withholdingReceipt.number ?? null,
          rrn: invoice.withholdingReceipt.rrn ?? null,
          qr: invoice.withholdingReceipt.qr ?? null,
          eimsStatus: invoice.withholdingReceipt.eimsStatus ?? null,
          status: invoice.withholdingReceipt.status ?? null,
        }
      : null,
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

export function hasIssuedReceipt(
  invoice: { receipt?: { status?: string | null } | null } | null
): boolean {
  return invoice?.receipt?.status === "ISSUED"
}

export function hasIssuedWithholdingReceipt(
  invoice: { withholdingReceipt?: { status?: string | null } | null } | null
): boolean {
  return invoice?.withholdingReceipt?.status === "ISSUED"
}
