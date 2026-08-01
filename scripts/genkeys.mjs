import { randomBytes } from "node:crypto"
import { writeFileSync } from "node:fs"

const OUT_DIR = new URL("../.keys/", import.meta.url)

const secret = randomBytes(32).toString("base64")

writeFileSync(new URL("auth-secret.txt", OUT_DIR), secret)
console.log("AUTH_SECRET (paste into .env / Coolify):")
console.log(secret)
