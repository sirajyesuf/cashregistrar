export const UNITS = ["PCS", "KG", "M", "L", "BOX", "EA", "Other"] as const

export type Unit = (typeof UNITS)[number]

export const UNIT_OPTIONS: ReadonlyArray<{ value: Unit; label: string }> =
  UNITS.map((value) => ({ value, label: value }))
