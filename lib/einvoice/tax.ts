import type { $Enums } from "@prisma/client"

export type TaxCode = $Enums.TaxCode

export const TAX_RATES: Record<TaxCode, number> = {
  TOT2: 0.02,
  VATEX: 0,
  VATWH: 0.5,
  WHOP2: 0.02,
  WTHOT: 0.03,
  TOT10: 0.1,
  VAT0: 0,
  VAT15: 0.15,
}

export const TAX_CODE_CODES = Object.keys(TAX_RATES) as TaxCode[]

export const TAX_CODE_OPTIONS: ReadonlyArray<{
  value: TaxCode
  label: string
  rate: number
}> = TAX_CODE_CODES.map((code) => ({
  value: code,
  label: taxCodeLabel(code),
  rate: TAX_RATES[code],
}))

export function taxCodeLabel(code: string | null | undefined): string {
  if (!code) return ""
  return code
}

export function rateForTaxCode(code: TaxCode): number {
  return TAX_RATES[code]
}
