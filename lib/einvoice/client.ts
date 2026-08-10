import { getConfig } from "./config"
import { loadKeys } from "./keys"
import { signAndWrap } from "./sign"
import { forceLogin, forceRefresh, getValidToken } from "./token"

export async function eimsRouteHandler(
  path: string,
  request: Request,
  businessId: string
): Promise<Response> {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  try {
    const { status, data } = await callEims(path, payload, businessId)
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
  businessId: string,
  extraHeaders: Record<string, string> = {},
  retried = false
): Promise<EimsCallResult> {
  const cfg = await getConfig(businessId)
  const { privateKey, certificate } = loadKeys()

  let accessToken: string
  try {
    accessToken = await getValidToken(businessId)
  } catch (err) {
    if (!retried) {
      await forceRefresh(businessId)
      return callEims(path, payload, businessId, extraHeaders, true)
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
    await forceLogin(businessId)
    return callEims(path, payload, businessId, extraHeaders, true)
  }

  return {
    status: res.status,
    ok: res.ok,
    data,
    retryAfter: res.headers.get("retry-after"),
  }
}
