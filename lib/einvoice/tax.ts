export enum TaxCode {
  VAT15 = "VAT15",
  VAT0 = "VAT0",
}

export function taxCodeForRate(rate: number): TaxCode {
  if (rate === 0) return TaxCode.VAT0
  return TaxCode.VAT15
}
