import { PrismaClient } from "@prisma/client"
import { loadEnv } from "./load-env.mjs"

loadEnv()

const prisma = new PrismaClient()

function value(name, fallback) {
  const v = process.env[name]?.trim()
  return v === undefined ? fallback : v
}

const seller = {
  city: value("EINVOICE_SELLER_CITY", "101"),
  country: value("EINVOICE_SELLER_COUNTRY", "ET"),
  email: value("EINVOICE_SELLER_EMAIL", "seretse@empire.et"),
  phone: value("EINVOICE_SELLER_PHONE", "+251976524241"),
  region: value("EINVOICE_SELLER_REGION", "1"),
  wereda: value("EINVOICE_SELLER_WEREDA", "13"),
  houseNumber: value("EINVOICE_SELLER_HOUSE_NUMBER", "101"),
}

async function firstBusinessId() {
  const first = await prisma.business.findFirst({ select: { id: true } })
  return first?.id ?? null
}

const businessId = process.argv[2]?.trim() ?? (await firstBusinessId())
if (!businessId) {
  console.log("No business found; skipping seller fields seed.")
  process.exit(0)
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
  const updated = await prisma.business.update({
    where: { id: businessId },
    data: seller,
  })
  console.log(`Updated seller fields for business ${businessId} (${updated.name})`)
} finally {
  await prisma.$disconnect()
}
