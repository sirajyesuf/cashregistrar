import type { Business, Invoice, InvoiceLine } from "@prisma/client"

import type { EimsConfig } from "./config"
import { taxCodeForRate } from "./tax"

export type RegisterPayload = {
  BuyerDetails: {
    City: string | null
    Email: string | null
    HouseNumber: string | null
    IdNumber: string | null
    IdType: string | null
    Tin: string | null
    LegalName: string | null
    Phone: string | null
    Region: string | null
    Country: string | null
    Zone: string | null
    Kebele: string | null
    VatNumber: string | null
    Wereda: string | null
  }
  DocumentDetails: {
    DocumentNumber: string
    Date: string
    Type: string
  }
  ItemList: {
    Discount: number
    ExciseTaxValue: number
    HarmonizationCode: string | null
    NatureOfSupplies: string
    ItemCode: string
    ProductDescription: string
    PreTaxValue: number
    Quantity: number
    LineNumber: number
    TaxAmount: number
    TaxCode: string
    TotalLineAmount: number
    Unit: string
    UnitPrice: number
  }[]
  PaymentDetails: {
    Mode: string
    PaymentTerm: string
  }
  ReferenceDetails: {
    PreviousIrn: string | null
    RelatedDocument: string | null
  }
  SellerDetails: {
    City: string | null
    Email: string | null
    HouseNumber: string | null
    LegalName: string
    Locality: string | null
    Phone: string | null
    Region: string | null
    SubCity: string | null
    Tin: string
    VatNumber: string | null
    Wereda: string | null
  }
  SourceSystem: {
    CashierName: string
    InvoiceCounter: number
    SalesPersonName: string
    SystemNumber: string
    SystemType: string
  }
  TransactionType: "B2B" | "B2C"
  ValueDetails: {
    Discount: number | null
    ExciseValue: number
    IncomeWithholdValue: number
    TaxValue: number
    TotalValue: number
    TransactionWithholdValue: number
    InvoiceCurrency: string
  }
  Version: string
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function toEimsDate(date: string): string {
  const [year, month, day] = date.split("-")
  if (!year || !month || !day) return date
  return `${day}-${month}-${year}T00:00:00`
}

function orEmpty(value: string | null | undefined): string {
  return value ?? ""
}

export function buildRegisterPayload(params: {
  invoice: Invoice & { lines: InvoiceLine[] }
  seller: Business | null
  invoiceCounter: number
  previousIrn: string | null
  cfg: EimsConfig
}): RegisterPayload {
  const { invoice, seller, invoiceCounter, previousIrn, cfg } = params
  const rate = Number(invoice.taxRate)
  const withholdRate = Number(invoice.incomeWithholdRate ?? 2)

  const itemList = invoice.lines
    .slice()
    .sort((a, b) => a.lineNumber - b.lineNumber)
    .map((line) => {
      const unitPrice = Number(line.unitPrice)
      const quantity = Number(line.quantity)
      const preTaxValue = round2(quantity * unitPrice)
      const taxAmount = round2((preTaxValue * rate) / 100)
      const discount = line.discount != null ? Number(line.discount) : 0
      return {
        Discount: round2(discount),
        ExciseTaxValue: 0,
        HarmonizationCode: null,
        NatureOfSupplies: line.natureOfSupplies.toLowerCase(),
        ItemCode: line.itemCode ?? "",
        ProductDescription: line.description,
        PreTaxValue: preTaxValue,
        Quantity: quantity,
        LineNumber: line.lineNumber,
        TaxAmount: taxAmount,
        TaxCode: line.taxCode ?? taxCodeForRate(rate),
        TotalLineAmount: round2(preTaxValue + taxAmount - discount),
        Unit: line.unit,
        UnitPrice: unitPrice,
      }
    })

  const subtotal = round2(
    itemList.reduce((sum, item) => sum + item.PreTaxValue, 0)
  )
  const taxValue = round2(
    itemList.reduce((sum, item) => sum + item.TaxAmount, 0)
  )
  const totalValue = round2(
    itemList.reduce((sum, item) => sum + item.TotalLineAmount, 0)
  )
  const incomeWithholdValue =
    invoice.transactionType === "B2B"
      ? round2((subtotal * withholdRate) / 100)
      : 0

  return {
    BuyerDetails: {
      City: invoice.buyerCity,
      Email: invoice.buyerEmail,
      HouseNumber: invoice.buyerHouseNumber,
      IdNumber: invoice.buyerIdNumber,
      IdType: invoice.buyerIdType,
      Tin: invoice.buyerTin,
      LegalName: invoice.buyerLegalName,
      Phone: invoice.buyerPhone,
      Region: invoice.buyerRegion,
      Country: invoice.buyerCountry,
      Zone: invoice.buyerZone,
      Kebele: invoice.buyerKebele,
      VatNumber: invoice.buyerVatNumber,
      Wereda: invoice.buyerWereda,
    },
    DocumentDetails: {
      DocumentNumber: String(invoiceCounter),
      Date: toEimsDate(invoice.date),
      Type: "INV",
    },
    ItemList: itemList,
    PaymentDetails: {
      Mode: invoice.paymentMode,
      PaymentTerm: invoice.paymentTerm,
    },
    ReferenceDetails: {
      PreviousIrn: previousIrn ?? "",
      RelatedDocument: null,
    },
    SellerDetails: {
      City: orEmpty(seller?.city),
      Email: orEmpty(seller?.email),
      HouseNumber: seller?.houseNumber ?? null,
      LegalName: orEmpty(seller?.legalName ?? seller?.name),
      Locality: seller?.locality ?? null,
      Phone: orEmpty(seller?.phone),
      Region: orEmpty(seller?.region),
      SubCity: seller?.subCity ?? null,
      Tin: cfg.tin,
      VatNumber: orEmpty(seller?.vatNumber),
      Wereda: orEmpty(seller?.wereda),
    },
    SourceSystem: {
      CashierName: invoice.cashierName,
      InvoiceCounter: invoiceCounter,
      SalesPersonName: invoice.salesPersonName,
      SystemNumber: cfg.systemNumber,
      SystemType: cfg.systemType,
    },
    TransactionType: invoice.transactionType,
    ValueDetails: {
      Discount: null,
      ExciseValue: 0,
      IncomeWithholdValue: incomeWithholdValue,
      TaxValue: taxValue,
      TotalValue: totalValue,
      TransactionWithholdValue: 0,
      InvoiceCurrency: "ETB",
    },
    Version: "1",
  }
}
