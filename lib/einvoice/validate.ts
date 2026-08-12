import type { InvoiceLine } from "@prisma/client"

import { type TaxCode, rateForTaxCode } from "./tax"

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export type LineTotalMismatch = {
  lineNumber: number
  description: string
  expected: number
  received: number
}

/**
 * Pre-flight validation that mirrors EIMS's per-line rule:
 *
 *   TotalLineAmount = round2(PreTaxValue + TaxAmount - Discount)
 *
 * where TaxAmount is derived from the invoice's TaxCode. The app computes
 * TotalLineAmount from `taxRate`; EIMS recomputes it from the TaxCode it
 * receives. Whenever `taxRate` is not exactly the code's rate the two disagree
 * and EIMS rejects the invoice with "expected X received Y".
 *
 * Returns one entry per line whose app-side total would not match EIMS's
 * expectation, so the register route can fail fast with a clear message
 * instead of round-tripping through EIMS.
 */
export function validateLineTotals(params: {
  lines: Pick<
    InvoiceLine,
    "lineNumber" | "description" | "quantity" | "unitPrice" | "discount"
  >[]
  taxCode: TaxCode
  taxRate: number
}): LineTotalMismatch[] {
  const { lines, taxCode, taxRate } = params
  const effectiveRate = rateForTaxCode(taxCode)
  const mismatches: LineTotalMismatch[] = []

  for (const line of lines) {
    const quantity = Number(line.quantity)
    const unitPrice = Number(line.unitPrice)
    const discount = line.discount != null ? Number(line.discount) : 0
    const preTax = round2(quantity * unitPrice)

    const appTaxAmount = round2(preTax * taxRate)
    const eimsTaxAmount = round2(preTax * effectiveRate)
    const received = round2(preTax + appTaxAmount - discount)
    const expected = round2(preTax + eimsTaxAmount - discount)

    if (expected !== received) {
      mismatches.push({
        lineNumber: line.lineNumber,
        description: line.description,
        expected,
        received,
      })
    }
  }

  return mismatches
}
