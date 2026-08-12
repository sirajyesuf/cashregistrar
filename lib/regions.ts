export const REGIONS: Record<string, string> = {
  "2": "Oromia",
  "3": "Tigray",
  "4": "Afar",
  "11": "Amhara",
  "13": "Addis Ababa",
  "14": "Sidama",
}

export const REGION_CODES = Object.keys(REGIONS).sort(
  (a, b) => Number(a) - Number(b)
)

export const REGION_OPTIONS: ReadonlyArray<{
  value: string
  label: string
}> = REGION_CODES.map((code) => ({
  value: code,
  label: REGIONS[code],
}))

export function regionLabel(code: string | null | undefined): string {
  return code ? (REGIONS[code] ?? code) : ""
}
