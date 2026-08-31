export const EIMS_BUYER_ID_TYPES = [
  "NID",
  "KID",
  "SID",
  "WID",
  "PST",
  "DLS",
  "MRS",
] as const

export type EimsBuyerIdType = (typeof EIMS_BUYER_ID_TYPES)[number]

export function isEimsBuyerIdType(
  value: string | null | undefined
): value is EimsBuyerIdType {
  return value != null && (EIMS_BUYER_ID_TYPES as readonly string[]).includes(value)
}