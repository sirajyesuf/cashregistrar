import { execFileSync } from "node:child_process"

/**
 * Prisma `db seed` entry point (package.json "prisma.seed").
 * Runs every seed in order. Each child inherits the parent env (Prisma CLI
 * loads .env, and the individual scripts also self-load it as a fallback).
 */
for (const script of ["prisma/seed-seller.mjs", "prisma/seed-admin.mjs"]) {
  execFileSync(process.execPath, [script], { stdio: "inherit" })
}
