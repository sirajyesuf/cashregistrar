type FieldErrorShape = { message?: string }

/**
 * Normalizes @tanstack/react-form errors (which can be strings, Zod issues,
 * or `Error`-like objects) to the `{ message?: string }` shape consumed by
 * the shadcn `FieldError` component.
 */
export function toFieldErrors(
  errors: readonly unknown[] | undefined
): (FieldErrorShape | undefined)[] {
  if (!errors) return []
  return errors.map((error) => {
    if (typeof error === "string") return { message: error }
    if (error && typeof error === "object" && "message" in error) {
      const message = (error as { message?: unknown }).message
      return typeof message === "string" ? { message } : undefined
    }
    return undefined
  })
}