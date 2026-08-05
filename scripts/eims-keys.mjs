import { execFileSync } from "node:child_process"
import { generateKeyPairSync } from "node:crypto"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

const DEFAULT_DIR = fileURLToPath(new URL("../.keys/einvoice/", import.meta.url))
const KEY_PATH = process.env.EINVOICE_KEY_PATH ?? `${DEFAULT_DIR}private_key.key`
const CONF_PATH = process.env.EINVOICE_CNF_PATH ?? `${DEFAULT_DIR}einvoice.cnf`
const CSR_PATH = process.env.EINVOICE_CSR_PATH ?? `${DEFAULT_DIR}csr.pem`

const KEY_BITS = 3024

const config = {
  country: process.env.EIMS_COUNTRY ?? "ET",
  state: process.env.EIMS_STATE ?? "Addis Ababa",
  locality: process.env.EIMS_LOCALITY ?? "Addis Ababa",
  org: process.env.EIMS_ORG,
  ou: process.env.EIMS_OU ?? process.env.EIMS_ORG,
  tin: process.env.EINVOICE_TIN,
  systemNumber: process.env.EIMS_SYSTEM_NUMBER,
  email: process.env.EIMS_EMAIL,
}

const missing = Object.entries(config)
  .filter(([k, v]) => !["country", "state", "locality", "ou"].includes(k) && !v)
  .map(([k]) => k)
if (missing.length > 0) {
  console.error(
    `Missing required env vars: ${missing.join(", ")}\n` +
      "  EIMS_ORG, EINVOICE_TIN, EIMS_SYSTEM_NUMBER, EIMS_EMAIL are required.\n" +
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

for (const p of [KEY_PATH, CONF_PATH, CSR_PATH]) {
  mkdirSync(dirname(p), { recursive: true })
}

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: KEY_BITS,
  publicExponent: 0x10001,
})
writeFileSync(KEY_PATH, privateKey.export({ type: "pkcs8", format: "pem" }))
console.log(`Wrote ${KEY_PATH} (${KEY_BITS}-bit RSA, no passphrase)`)

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
console.log(`Wrote ${CONF_PATH}`)

execFileSync(
  "openssl",
  [
    "req",
    "-new",
    "-key",
    KEY_PATH,
    "-out",
    CSR_PATH,
    "-config",
    CONF_PATH,
  ],
  { stdio: "inherit" }
)

if (!existsSync(CSR_PATH)) {
  console.error("openssl req did not produce a CSR. Check the errors above.")
  process.exit(1)
}

console.log("\nDone. Next steps:")
console.log(`  1. Email ${CSR_PATH} + the Certificate Request Form to ica@insa.gov.et`)
console.log(`  2. Save the issued certificate and set EINVOICE_CERT_PATH to it`)
console.log(`  3. Deploy the key/cert files and set EINVOICE_KEY_PATH / EINVOICE_CERT_PATH on the VPS`)
