import { PrismaClient } from "@prisma/client"
import { loadEnv } from "./load-env.mjs"

loadEnv()

const prisma = new PrismaClient()

function value(name, fallback) {
  const v = process.env[name]?.trim()
  return v === undefined ? fallback : v
}

const seller = {
  businessName: value(
    "EINVOICE_SELLER_BUSINESS_NAME",
    "Empire Technological solution"
  ),
  street: value("EINVOICE_SELLER_STREET", ""),
  city: value("EINVOICE_SELLER_CITY", "101"),
  country: value("EINVOICE_SELLER_COUNTRY", "ET"),
  legalName: value(
    "EINVOICE_SELLER_LEGAL_NAME",
    "Empire Technological solution"
  ),
  vatNumber: value("EINVOICE_SELLER_VAT_NUMBER", "43256663343256663322"),
  email: value("EINVOICE_SELLER_EMAIL", "seretse@empire.et"),
  phone: value("EINVOICE_SELLER_PHONE", "+251976524241"),
  region: value("EINVOICE_SELLER_REGION", "1"),
  subCity: value("EINVOICE_SELLER_SUBCITY", "A"),
  wereda: value("EINVOICE_SELLER_WEREDA", "13"),
  houseNumber: value("EINVOICE_SELLER_HOUSE_NUMBER", "101"),
  locality: value("EINVOICE_SELLER_LOCALITY", "Bole"),
}

if (!seller.businessName) {
  console.error("EINVOICE_SELLER_BUSINESS_NAME is required")
  process.exit(1)
}

const businessId = process.argv[2]?.trim()
if (!businessId) {
  console.error(
    "Usage: node prisma/seed-seller.mjs <businessId>"
  )
  process.exit(1)
}

const business = await prisma.business.findUnique({
  where: { id: businessId },
  select: { id: true },
})
if (!business) {
  console.error(`Business not found: ${businessId}`)
  process.exit(1)
}

try {
  const profile = await prisma.sellerProfile.upsert({
    where: { businessId },
    create: { businessId, ...seller },
    update: seller,
  })
  console.log(`Upserted seller profile for business ${businessId} (${profile.id})`)
} finally {
  await prisma.$disconnect()
}
