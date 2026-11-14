/** Same minimum as at sign-up (`validateCredentials`) and the server's Better Auth default. */
export const MIN_PASSWORD_LENGTH = 8

export type PasswordProblem =
  | "currentMissing"
  | "tooShort"
  | "mismatch"
  | "sameAsCurrent"

/**
 * Checks the change-password form before it is sent. Returns a code that the screen turns into a
 * translated text, or null when the values are fine.
 */
export function validatePasswordChange(values: {
  current: string
  next: string
  repeat: string
}): PasswordProblem | null {
  if (!values.current) return "currentMissing"
  if (values.next.length < MIN_PASSWORD_LENGTH) return "tooShort"
  if (values.next !== values.repeat) return "mismatch"
  if (values.next === values.current) return "sameAsCurrent"
  return null
}

type ChangeError = { code?: string; message?: string; status?: number } | null | undefined

/** Better Auth answers a wrong current password with INVALID_PASSWORD. */
export function isWrongCurrentPassword(error: ChangeError) {
  if (!error) return false
  if (error.code === "INVALID_PASSWORD") return true
  return /invalid password/i.test(error.message ?? "")
}
