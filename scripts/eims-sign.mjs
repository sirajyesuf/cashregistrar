import { createSign } from "node:crypto"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

const DEFAULT_DIR = fileURLToPath(new URL("../.keys/einvoice/", import.meta.url))
const KEY_PATH = process.env.EINVOICE_KEY_PATH ?? `${DEFAULT_DIR}private_key.key`
const CERT_PATH = process.env.EINVOICE_CERT_PATH ?? `${DEFAULT_DIR}certificate.crt`
const TOKEN_PATH = `${dirname(KEY_PATH)}/token.json`

const DEFAULT_BASE_URL = "https://core.mor.gov.et"

function parseArgs(argv) {
  const opts = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg.startsWith("--")) {
      const key = arg.slice(2)
      const next = argv[i + 1]
      if (next !== undefined && !next.startsWith("--")) {
        opts[key] = next
        i++
      } else {
        opts[key] = true
      }
    } else {
      opts._.push(arg)
    }
  }
  return opts
}

function resolvePath(flagPath, defaultPath) {
  return flagPath ? flagPath : defaultPath
}

function readSecret(path, name) {
  if (!existsSync(path)) {
    console.error(`Missing ${name} at ${path}\nRun "node scripts/eims-keys.mjs" first (then save your issued certificate).`)
    process.exit(1)
  }
  return readFileSync(path, "utf8")
}

function buildConfig(args) {
  const privateKey = readSecret(resolvePath(args["key"], KEY_PATH), "private key")
  const certificate = readSecret(resolvePath(args["cert"], CERT_PATH), "certificate")

  const value = (name, flag) => args[flag] ?? process.env[name] ?? ""
  const cfg = {
    baseUrl: (value("EINVOICE_BASE_URL", "base-url") || DEFAULT_BASE_URL).replace(/\/+$/, ""),
    clientId: value("EINVOICE_CLIENT_ID", "client-id"),
    clientSecret: value("EINVOICE_CLIENT_SECRET", "client-secret"),
    apiKey: value("EINVOICE_API_KEY", "api-key"),
    tin: value("EINVOICE_TIN", "tin"),
  }

  return { privateKey, certificate, cfg }
}

function signAndWrap(privateKey, certificatePem, requestObj) {
  const requestJson = JSON.stringify(requestObj)
  const signer = createSign("RSA-SHA512")
  signer.update(requestJson)
  signer.end()
  const signature = signer.sign(privateKey, "base64")
  const certificate = Buffer.from(certificatePem, "utf8").toString("base64")
  return { request: requestObj, signature, certificate }
}

function loadToken() {
  if (!existsSync(TOKEN_PATH)) return null
  return JSON.parse(readFileSync(TOKEN_PATH, "utf8"))
}

function saveToken(token) {
  writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2))
}

function readRequestData(dataFlag) {
  if (!dataFlag) {
    console.error('Missing --data <file.json> with the request payload to sign.')
    process.exit(1)
  }
  if (!existsSync(dataFlag)) {
    console.error(`Data file not found: ${dataFlag}`)
    process.exit(1)
  }
  return JSON.parse(readFileSync(dataFlag, "utf8"))
}

function printResponse(res, body) {
  console.log(`HTTP ${res.status} ${res.statusText}`)
  console.log(body)
}

async function doLogin({ privateKey, certificate, cfg }) {
  if (!cfg.clientId || !cfg.clientSecret || !cfg.apiKey || !cfg.tin) {
    console.error("Login needs EINVOICE_CLIENT_ID, EINVOICE_CLIENT_SECRET, EINVOICE_API_KEY, EINVOICE_TIN (env or --client-id/--client-secret/--api-key/--tin).")
    process.exit(1)
  }
  const requestObj = {
    clientId: cfg.clientId,
    clientSecret: cfg.clientSecret,
    apikey: cfg.apiKey,
    tin: cfg.tin,
  }
  const body = JSON.stringify(signAndWrap(privateKey, certificate, requestObj))
  const res = await fetch(`${cfg.baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  })
  const text = await res.text()
  if (res.ok) {
    let parsed = {}
    try {
      parsed = JSON.parse(text)
    } catch {}
    const accessToken = parsed?.data?.accessToken ?? parsed?.accessToken
    if (accessToken) {
      saveToken({ ...parsed.data, obtainedAt: new Date().toISOString() })
      console.log(`Login OK. Token cached at ${TOKEN_PATH}`)
      console.log(`accessToken: ${accessToken.slice(0, 40)}...`)
      return
    }
  }
  printResponse(res, text)
  process.exit(1)
}

async function doCall({ privateKey, certificate, cfg }, args) {
  const endpoint = args._[1]
  if (!endpoint) {
    console.error('Usage: node scripts/eims-sign.mjs call <endpoint> --data <file.json>\n  e.g. node scripts/eims-sign.mjs call /v1/register --data invoice.json')
    process.exit(1)
  }
  const token = loadToken()
  if (!token?.accessToken) {
    console.error("No cached token. Run: node scripts/eims-sign.mjs login")
    process.exit(1)
  }
  const requestObj = readRequestData(args["data"])
  const body = JSON.stringify(signAndWrap(privateKey, certificate, requestObj))
  const res = await fetch(`${cfg.baseUrl}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token.accessToken}`,
    },
    body,
  })
  printResponse(res, await res.text())
  if (res.status === 401) {
    console.log("\nToken rejected (expired?). Re-run: node scripts/eims-sign.mjs login")
  }
}

function doWrap({ privateKey, certificate }, args) {
  let requestObj
  if (args["data"]) {
    requestObj = readRequestData(args["data"])
  } else {
    requestObj = {
      clientId: args["client-id"] ?? process.env.EINVOICE_CLIENT_ID ?? "{{clientId}}",
      clientSecret: args["client-secret"] ?? process.env.EINVOICE_CLIENT_SECRET ?? "{{clientSecret}}",
      apikey: args["api-key"] ?? process.env.EINVOICE_API_KEY ?? "{{apiKey}}",
      tin: args["tin"] ?? process.env.EINVOICE_TIN ?? "{{tin}}",
    }
  }
  console.log(JSON.stringify(signAndWrap(privateKey, certificate, requestObj), null, 2))
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const command = args._[0] ?? "wrap"
  const { privateKey, certificate, cfg } = buildConfig(args)

  switch (command) {
    case "login":
      await doLogin({ privateKey, certificate, cfg })
      break
    case "call":
      await doCall({ privateKey, certificate, cfg }, args)
      break
    case "wrap":
    default:
      doWrap({ privateKey, certificate }, args)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
