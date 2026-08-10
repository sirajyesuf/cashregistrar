import { prisma } from "@/lib/db"

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

/**
 * Loads the EIMS configuration for a business from its MorCredential row.
 * There is no global/env fallback: every business must have its own MOR
 * credentials configured before EIMS operations can run.
 */
export async function getConfig(businessId: string): Promise<EimsConfig> {
  const credential = await prisma.morCredential.findUnique({
    where: { businessId },
  })
  if (!credential) {
    throw new Error(
      "Missing MOR credentials for this business. " +
        "Configure system number, API key, client ID and client secret " +
        "under the business's MOR credentials before using EIMS."
    )
  }

  const baseUrl = (
    process.env.EINVOICE_BASE_URL ?? DEFAULT_BASE_URL
  ).replace(/\/+$/, "")

  return {
    baseUrl,
    clientId: credential.clientId,
    clientSecret: credential.clientSecret,
    apiKey: credential.apiKey,
    tin: credential.tin,
    systemNumber: credential.systemNumber,
    systemType: credential.systemType,
  }
}
