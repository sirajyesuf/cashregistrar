import { execFileSync } from "node:child_process"
import { generateKeyPairSync } from "node:crypto"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const OUT_DIR = new URL("../.keys/eims/", import.meta.url)
const CONF_PATH = new URL("einvoice.cnf", OUT_DIR)
const KEY_PATH = new URL("private_key.key", OUT_DIR)
const CSR_PATH = new URL("csr.pem", OUT_DIR)

const KEY_BITS = 3024

const config = {
  country: process.env.EIMS_COUNTRY ?? "ET",
  state: process.env.EIMS_STATE ?? "Addis Ababa",
  locality: process.env.EIMS_LOCALITY ?? "Addis Ababa",
  org: process.env.EIMS_ORG,
  ou: process.env.EIMS_OU ?? process.env.EIMS_ORG,
  tin: process.env.EIMS_TIN,
  systemNumber: process.env.EIMS_SYSTEM_NUMBER,
  email: process.env.EIMS_EMAIL,
}

const missing = Object.entries(config)
  .filter(([k, v]) => !["country", "state", "locality", "ou"].includes(k) && !v)
  .map(([k]) => k)
if (missing.length > 0) {
  console.error(
    `Missing required env vars: ${missing.join(", ")}\n` +
      "  EIMS_ORG, EIMS_TIN, EIMS_SYSTEM_NUMBER, EIMS_EMAIL are required.\n" +
      "  Optional: EIMS_OU, EIMS_COUNTRY, EIMS_STATE, EIMS_LOCALITY"
  )
  process.exit(1)
}

try {
  execFileSync("openssl", ["version"], { stdio: "pipe" })
} catch {
  console.error("openssl is not installed or not on PATH. See the install guide in the EIMS doc.")
  process.exit(1)
}

mkdirSync(fileURLToPath(OUT_DIR), { recursive: true })

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: KEY_BITS,
  publicExponent: 0x10001,
})
writeFileSync(KEY_PATH, privateKey.export({ type: "pkcs8", format: "pem" }))
console.log(`Wrote ${fileURLToPath(KEY_PATH)} (${KEY_BITS}-bit RSA, no passphrase)`)

const cnf = [
  "[ req ]",
  `default_bits = ${KEY_BITS}`,
  "distinguished_name = req_distinguished_name",
  "prompt = no",
  "[ req_distinguished_name ]",
  `C = ${config.country}`,
  `ST = ${config.state}`,
  `L = ${config.locality}`,
  `O = ${config.org}`,
  `OU = ${config.ou}`,
  `CN = ${config.tin}`,
  `serialNumber = ${config.systemNumber}`,
  `emailAddress = ${config.email}`,
  "",
].join("\n")
writeFileSync(CONF_PATH, cnf)
console.log(`Wrote ${fileURLToPath(CONF_PATH)}`)

execFileSync(
  "openssl",
  [
    "req",
    "-new",
    "-key",
    fileURLToPath(KEY_PATH),
    "-out",
    fileURLToPath(CSR_PATH),
    "-config",
    fileURLToPath(CONF_PATH),
  ],
  { stdio: "inherit" }
)

if (!existsSync(CSR_PATH)) {
  console.error("openssl req did not produce a CSR. Check the errors above.")
  process.exit(1)
}

console.log("\nDone. Next steps:")
console.log(`  1. Email ${fileURLToPath(CSR_PATH)} + the Certificate Request Form to ica@insa.gov.et`)
console.log("  2. Save the issued certificate as .keys/eims/certificate.crt")
console.log("  3. Deploy .keys/eims/ (private_key.key + certificate.crt) to the VPS")
console.log("     as a Docker-mounted volume (e.g. /app/storage/eims-cert/).")
