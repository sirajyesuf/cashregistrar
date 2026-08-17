export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string }

export function notFound(error: string): ServiceResult<never> {
  return { ok: false, status: 404, error }
}

export function forbidden(error: string): ServiceResult<never> {
  return { ok: false, status: 403, error }
}

export function badRequest(error: string): ServiceResult<never> {
  return { ok: false, status: 400, error }
}

export function conflict(error: string): ServiceResult<never> {
  return { ok: false, status: 409, error }
}
