import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { admin } from "better-auth/plugins"
import { adminAc, userAc } from "better-auth/plugins/admin/access"
import { prisma } from "@/lib/db"

function splitOrigins(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "mysql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 5,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "OWNER",
        input: false,
        returned: true,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        // The first registered user becomes the admin so the /admin area
        // is reachable without any manual setup.
        before: async (user) => {
          const count = await prisma.user.count()
          return { data: { ...user, role: count === 0 ? "ADMIN" : "OWNER" } }
        },
      },
    },
  },
  plugins: [
    admin({
      defaultRole: "OWNER",
      adminRoles: ["ADMIN"],
      // Better Auth's default permission map uses lowercase role names, but
      // the application stores roles as the uppercase Prisma enum values.
      // Keep the values unified so admin endpoints (including impersonation)
      // can resolve permissions for an ADMIN session.
      roles: {
        ADMIN: adminAc,
        OWNER: userAc,
        MANAGER: userAc,
        CASHIER: userAc,
      },
    }),
  ],
  secret: process.env.BETTER_AUTH_SECRET ?? process.env.AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: splitOrigins(process.env.BETTER_AUTH_TRUSTED_ORIGINS),
})
