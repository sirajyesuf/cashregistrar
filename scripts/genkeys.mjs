import { exportJWK, exportPKCS8, generateKeyPair } from "jose"
import { writeFileSync } from "node:fs"

const OUT_DIR = new URL("../.keys/", import.meta.url)

const keys = await generateKeyPair("RS256", { extractable: true })
const privateKey = await exportPKCS8(keys.privateKey)
const publicKey = await exportJWK(keys.publicKey)
const jwks = JSON.stringify({ keys: [{ use: "sig", ...publicKey }] })

writeFileSync(new URL("privkey.txt", OUT_DIR), privateKey)
writeFileSync(new URL("jwks.json", OUT_DIR), jwks)
console.log("private key len:", privateKey.length)
console.log("jwks valid JSON check:")
JSON.parse(jwks)
console.log("VALID")
