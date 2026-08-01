import { createSign } from "node:crypto"

export type SignedRequest = {
  request: unknown
  signature: string
  certificate: string
}

export function signAndWrap(
  privateKey: string,
  certificatePem: string,
  request: unknown
): SignedRequest {
  const requestJson = JSON.stringify(request)
  const signer = createSign("RSA-SHA256")
  signer.update(requestJson)
  signer.end()
  const signature = signer.sign(privateKey, "base64")
  const certificate = Buffer.from(certificatePem, "utf8").toString("base64")
  return { request, signature, certificate }
}
