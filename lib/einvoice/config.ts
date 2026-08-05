const DEFAULT_BASE_URL = "https://core.mor.gov.et"

export type EimsConfig = {
  baseUrl: string
  clientId: string
  clientSecret: string
  apiKey: string
  tin: string
  systemNumber: string
  systemType: string
}

export function getConfig(): EimsConfig {
  const value = (name: string) => process.env[name]?.trim()

  const required = {
    EINVOICE_CLIENT_ID: value("EINVOICE_CLIENT_ID"),
    EINVOICE_CLIENT_SECRET: value("EINVOICE_CLIENT_SECRET"),
    EINVOICE_API_KEY: value("EINVOICE_API_KEY"),
    EINVOICE_TIN: value("EINVOICE_TIN"),
    EINVOICE_SYSTEM_NUMBER: value("EINVOICE_SYSTEM_NUMBER"),
    EINVOICE_SYSTEM_TYPE: value("EINVOICE_SYSTEM_TYPE"),
  }

  const missing = Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k)
  if (missing.length > 0) {
    throw new Error(
      `Missing required EINVOICE env vars: ${missing.join(", ")}. ` +
        "See the EIMS integration doc for where to get them."
    )
  }

  return {
    baseUrl: (value("EINVOICE_BASE_URL") ?? DEFAULT_BASE_URL).replace(
      /\/+$/,
      ""
    ),
    clientId: required.EINVOICE_CLIENT_ID!,
    clientSecret: required.EINVOICE_CLIENT_SECRET!,
    apiKey: required.EINVOICE_API_KEY!,
    tin: required.EINVOICE_TIN!,
    systemNumber: required.EINVOICE_SYSTEM_NUMBER!,
    systemType: required.EINVOICE_SYSTEM_TYPE!,
  }
}
