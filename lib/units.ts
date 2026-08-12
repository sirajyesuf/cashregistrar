import type { $Enums } from "@prisma/client"

export type Unit = $Enums.Unit

export const UNITS: Record<Unit, string> = {
  MTR: "Meter",
  LTR: "Liter",
  KLG: "Kilogram",
  PCS: "Pieces",
  ROL: "Roll",
}

export const UNIT_CODES = Object.keys(UNITS) as Unit[]

export const UNIT_OPTIONS: ReadonlyArray<{ value: Unit; label: string }> =
  UNIT_CODES.map((code) => ({ value: code, label: UNITS[code] }))

export function unitLabel(unit: string | null | undefined): string {
  return unit ? (UNITS[unit as Unit] ?? unit) : ""
}
