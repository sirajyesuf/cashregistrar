import { getConfig } from "./config"
import { loadKeys } from "./keys"
import { signAndWrap } from "./sign"
import { forceLogin, forceRefresh, getValidToken } from "./token"

export async function eimsRouteHandler(
  path: string,
  request: Request
): Promise<Response> {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  try {
    const { status, data } = await callEims(path, payload)
    return Response.json(data, { status })
  } catch (err) {
    const message = err instanceof Error ? err.message : "EIMS request failed"
    return Response.json({ error: message }, { status: 500 })
  }
}

export type EimsCallResult = {
  status: number
  ok: boolean
  data: unknown
  retryAfter: string | null
}

export async function callEims(
  path: string,
  payload: unknown,
  extraHeaders: Record<string, string> = {},
  retried = false
): Promise<EimsCallResult> {
  const cfg = getConfig()
  const { privateKey, certificate } = loadKeys()

  let accessToken: string
  try {
    accessToken = await getValidToken()
  } catch (err) {
    if (!retried) {
      await forceRefresh()
      return callEims(path, payload, extraHeaders, true)
    }
    throw err
  }

  const wrapped = signAndWrap(privateKey, certificate, payload)
  const res = await fetch(`${cfg.baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...extraHeaders,
    },
    body: JSON.stringify(wrapped),
  })

  const text = await res.text()
  let data: unknown = text
  try {
    data = JSON.parse(text)
  } catch {
    // keep raw text
  }

  if (res.status === 401 && !retried) {
    await forceLogin()
    return callEims(path, payload, extraHeaders, true)
  }

  return {
    status: res.status,
    ok: res.ok,
    data,
    retryAfter: res.headers.get("retry-after"),
  }
}
