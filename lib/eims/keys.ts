import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

const PROD_KEY_PATH = "/app/storage/eims-cert/private_key.key"
const PROD_CERT_PATH = "/app/storage/eims-cert/certificate.crt"
const DEV_KEY_PATH = resolve(process.cwd(), ".keys/eims/private_key.key")
const DEV_CERT_PATH = resolve(process.cwd(), ".keys/eims/certificate.crt")

export type EimsKeyPair = {
  privateKey: string
  certificate: string
}

function resolveSecretPath(envPath: string | undefined, devPath: string, prodPath: string): string {
  if (envPath) return envPath
  if (existsSync(devPath)) return devPath
  return prodPath
}

export function loadKeys(): EimsKeyPair {
  const keyPath = resolveSecretPath(
    process.env.EIMS_KEY_PATH,
    DEV_KEY_PATH,
    PROD_KEY_PATH
  )
  const certPath = resolveSecretPath(
    process.env.EIMS_CERT_PATH,
    DEV_CERT_PATH,
    PROD_CERT_PATH
  )

  if (!existsSync(keyPath)) {
    throw new Error(
      `EIMS private key not found at ${keyPath}. Run "node scripts/eims-keys.mjs" ` +
        "(saving the issued certificate) or set EIMS_KEY_PATH / EIMS_CERT_PATH."
    )
  }
  if (!existsSync(certPath)) {
    throw new Error(
      `EIMS certificate not found at ${certPath}. Save the issued certificate there ` +
        "or set EIMS_CERT_PATH."
    )
  }

  return {
    privateKey: readFileSync(keyPath, "utf8"),
    certificate: readFileSync(certPath, "utf8"),
  }
}
