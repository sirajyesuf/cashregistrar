import { NextResponse } from "next/server"

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED")
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = "Forbidden") {
    super(message, 403, "FORBIDDEN")
  }
}

export class NotFoundError extends ApiError {
  constructor(message = "Not found") {
    super(message, 404, "NOT_FOUND")
  }
}

export class ConflictError extends ApiError {
  constructor(message = "Conflict") {
    super(message, 409, "CONFLICT")
  }
}

export class BadRequestError extends ApiError {
  constructor(message = "Bad request") {
    super(message, 400, "BAD_REQUEST")
  }
}

export class ValidationError extends ApiError {
  constructor(message = "Validation failed") {
    super(message, 422, "VALIDATION_ERROR")
  }
}

/** Flat error body for the internal API: { error, code }. */
export function errorResponse(error: unknown): NextResponse | null {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status }
    )
  }
  return null
}

/** Envelope error body for the public API: { error: { code, message } }. */
export function publicErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status }
    )
  }
  return null
}

/** Build a public-envelope error response for route-level checks (404/403). */
export function publicError(
  status: number,
  code: string,
  message: string
): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status })
}

/**
 * Runs a service call and maps thrown ApiErrors to a ready-to-return
 * NextResponse. Non-ApiErrors are rethrown so unexpected failures surface
 * as 500s rather than leaking details to callers.
 */
export async function withService<T>(
  fn: () => Promise<T>,
  serialize: (error: unknown) => NextResponse | null = errorResponse
): Promise<{ data: T } | { error: NextResponse }> {
  try {
    return { data: await fn() }
  } catch (error) {
    const response = serialize(error)
    if (response) return { error: response }
    throw error
  }
}