import { PrismaClient } from "@prisma/client"
import { loadEnv } from "./load-env.mjs"

loadEnv()

const prisma = new PrismaClient()

const DEFAULT_ADMIN_EMAIL = "seretse@empire.et"

/**
 * Promotes a user to the admin role so the /admin area is reachable.
 *
 * Mirrors the seller seeder: idempotent, uses an env var with a sensible
 * default, and never fails the combined `prisma db seed` run.
 *
 * - ADMIN_EMAIL (optional) - email to promote; defaults to DEFAULT_ADMIN_EMAIL.
 * - On a fresh database the first registered user is already auto-promoted by
 *   the auth bootstrap hook, so a missing user here is skipped, not an error.
 *
 * Run: npm run seed:admin   (or ADMIN_EMAIL=you@example.com npm run seed:admin)
 */
async function main() {
  const email = (process.env.ADMIN_EMAIL ?? DEFAULT_ADMIN_EMAIL)
    .trim()
    .toLowerCase()

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    console.log(
      `Admin user "${email}" not found — skipping (the first registered user is made admin automatically).`
    )
    return
  }

  const updated = await prisma.user.update({
    where: { email },
    data: { role: "admin" },
  })
  console.log(`Promoted ${updated.email} to admin`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
