type AuthError = { message?: string; status?: number } | null | undefined

/** Turns an error from the API (or the network) into a sentence for the person. */
export function readableAuthError(error: AuthError, fallback: string) {
  if (!error) return fallback
  const message = error.message ?? ""
  if (error.status === 401 || error.status === 403)
    return "Wrong email or password."
  if (error.status === 422 || /already exists/i.test(message))
    return "An account with this email already exists."
  if (error.status === 0 || /network|fetch|failed to/i.test(message))
    return "Can't reach the server. Check your connection and the API address."
  return message || fallback
}

export function validateCredentials(values: {
  name?: string
  email: string
  password: string
}) {
  if (values.name !== undefined && !values.name.trim())
    return "Enter your name."
  if (!/^\S+@\S+\.\S+$/.test(values.email.trim()))
    return "Enter a valid email address."
  if (values.password.length < 8)
    return "The password needs at least 8 characters."
  return null
}
