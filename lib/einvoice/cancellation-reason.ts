import type { $Enums } from "@prisma/client"

export type CancellationReason = $Enums.CancellationReason

export const CANCELLATION_REASON_CODES: Record<CancellationReason, string> = {
  DUPLICATE: "1",
  dataEntryMistake: "2",
  orderCancelled: "3",
  OTHERS: "4",
}

export const CANCELLATION_REASON_LABELS: Record<CancellationReason, string> = {
  DUPLICATE: "Duplicate",
  dataEntryMistake: "Data entry mistake",
  orderCancelled: "Order cancelled",
  OTHERS: "Others",
}

export const CANCELLATION_REASON_CODES_LIST = Object.keys(
  CANCELLATION_REASON_CODES
) as CancellationReason[]

export const CANCELLATION_REASON_OPTIONS: ReadonlyArray<{
  value: CancellationReason
  label: string
}> = CANCELLATION_REASON_CODES_LIST.map((code) => ({
  value: code,
  label: CANCELLATION_REASON_LABELS[code],
}))

export const DEFAULT_CANCELLATION_REASON: CancellationReason = "OTHERS"

export function cancellationReasonCode(reason: CancellationReason): string {
  return CANCELLATION_REASON_CODES[reason]
}

export function cancellationReasonLabel(
  reason: string | null | undefined
): string {
  if (!reason) return ""
  return CANCELLATION_REASON_LABELS[reason as CancellationReason] ?? reason
}

export function isCancellationReason(
  value: unknown
): value is CancellationReason {
  return (
    typeof value === "string" &&
    (CANCELLATION_REASON_CODES_LIST as string[]).includes(value)
  )
}
