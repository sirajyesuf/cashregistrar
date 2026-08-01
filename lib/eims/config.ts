const DEFAULT_BASE_URL = "https://core.mor.gov.et"

export type EimsConfig = {
  baseUrl: string
  clientId: string
  clientSecret: string
  apiKey: string
  tin: string
}

export function getConfig(): EimsConfig {
  const value = (name: string) => process.env[name]?.trim()

  const required = {
    EIMS_CLIENT_ID: value("EIMS_CLIENT_ID"),
    EIMS_CLIENT_SECRET: value("EIMS_CLIENT_SECRET"),
    EIMS_API_KEY: value("EIMS_API_KEY"),
    EIMS_TIN: value("EIMS_TIN"),
  }

  const missing = Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k)
  if (missing.length > 0) {
    throw new Error(
      `Missing required EIMS env vars: ${missing.join(", ")}. ` +
        "See the EIMS integration doc for where to get them."
    )
  }

  return {
    baseUrl: (value("EIMS_BASE_URL") ?? DEFAULT_BASE_URL).replace(/\/+$/, ""),
    clientId: required.EIMS_CLIENT_ID!,
    clientSecret: required.EIMS_CLIENT_SECRET!,
    apiKey: required.EIMS_API_KEY!,
    tin: required.EIMS_TIN!,
  }
}
