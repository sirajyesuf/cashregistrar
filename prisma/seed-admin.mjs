import { PrismaClient } from "@prisma/client"
import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { loadEnv } from "./load-env.mjs"

loadEnv()

const prisma = new PrismaClient()

const DEFAULT_ADMIN_EMAIL = "seretse@empire.et"
const DEFAULT_ADMIN_PASSWORD = "123456789"
const DEFAULT_ADMIN_NAME = "Admin"
const ADMIN_ROLE = "ADMIN"

/**
 * Minimal better-auth instance used only to create the user so the password
 * is hashed exactly like normal sign-ups. (The app's full config lives in
 * lib/auth.ts; this seed cannot import TypeScript modules.)
 */
const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "mysql" }),
  emailAndPassword: { enabled: true, minPasswordLength: 5 },
  secret: process.env.BETTER_AUTH_SECRET ?? process.env.AUTH_SECRET,
})

/**
 * Ensures an admin account exists for the /admin area.
 *
 * Like the seller seeder: idempotent and env-driven.
 * - ADMIN_EMAIL   (optional) - email of the admin; defaults to DEFAULT_ADMIN_EMAIL.
 * - ADMIN_PASSWORD (optional) - password used when creating a missing user;
 *   defaults to DEFAULT_ADMIN_PASSWORD.
 * - ADMIN_NAME    (optional) - display name for a newly created user.
 *
 * If the user already exists they are promoted to admin; if not, the user is
 * created (via better-auth, so the password hash matches normal sign-ups) and
 * then promoted.
 *
 * Run: npm run seed:admin   (or ADMIN_EMAIL=you@example.com npm run seed:admin)
 */
async function main() {
  const email = (process.env.ADMIN_EMAIL ?? DEFAULT_ADMIN_EMAIL)
    .trim()
    .toLowerCase()
  const password = process.env.ADMIN_PASSWORD ?? DEFAULT_ADMIN_PASSWORD
  const name = (process.env.ADMIN_NAME ?? DEFAULT_ADMIN_NAME).trim()

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    await prisma.user.update({ where: { email }, data: { role: ADMIN_ROLE } })
    console.log(`Promoted ${email} to ${ADMIN_ROLE}`)
    return
  }

  const created = await auth.api.signUpEmail({ body: { name, email, password } })
  if (!created?.user?.id) {
    throw new Error(`Could not create user ${email}`)
  }
  await prisma.user.update({
    where: { id: created.user.id },
    data: { role: ADMIN_ROLE },
  })
  console.log(`Created ${email} as ${ADMIN_ROLE} (name: ${name})`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
