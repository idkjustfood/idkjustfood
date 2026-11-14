import i18n from "@/lib/i18n"

type AuthError = { message?: string; status?: number } | null | undefined

/** Turns an error from the API (or the network) into a sentence for the person. */
export function readableAuthError(error: AuthError, fallback: string) {
  if (!error) return fallback
  const message = error.message ?? ""
  // The server says why sign-up is closed; show that, not "wrong password".
  if (/registration is closed/i.test(message))
    return i18n.t("auth:errors.registrationClosed")
  if (error.status === 401 || error.status === 403)
    return i18n.t("auth:errors.wrongCredentials")
  if (error.status === 422 || /already exists/i.test(message))
    return i18n.t("auth:errors.emailTaken")
  if (error.status === 0 || /network|fetch|failed to/i.test(message))
    return i18n.t("auth:errors.network")
  return message || fallback
}

export function validateCredentials(values: {
  name?: string
  email: string
  password: string
}) {
  if (values.name !== undefined && !values.name.trim())
    return i18n.t("auth:validation.name")
  if (!/^\S+@\S+\.\S+$/.test(values.email.trim()))
    return i18n.t("auth:validation.email")
  if (values.password.length < 8) return i18n.t("auth:validation.password")
  return null
}
