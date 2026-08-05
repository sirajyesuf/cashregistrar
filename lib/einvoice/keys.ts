import { existsSync, readFileSync } from "node:fs"

export type EimsKeyPair = {
  privateKey: string
  certificate: string
}

export function loadKeys(): EimsKeyPair {
  const keyPath = process.env.EINVOICE_KEY_PATH
  const certPath = process.env.EINVOICE_CERT_PATH

  if (!keyPath) {
    throw new Error(
      "EINVOICE_KEY_PATH is required. Set it to the path of the EIMS private key file."
    )
  }
  if (!certPath) {
    throw new Error(
      "EINVOICE_CERT_PATH is required. Set it to the path of the EIMS certificate file."
    )
  }

  if (!existsSync(keyPath)) {
    throw new Error(
      `EIMS private key not found at ${keyPath}. Check EINVOICE_KEY_PATH.`
    )
  }
  if (!existsSync(certPath)) {
    throw new Error(
      `EIMS certificate not found at ${certPath}. Check EINVOICE_CERT_PATH.`
    )
  }

  return {
    privateKey: readFileSync(keyPath, "utf8"),
    certificate: readFileSync(certPath, "utf8"),
  }
}
