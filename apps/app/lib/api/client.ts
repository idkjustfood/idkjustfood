import createClient, { type Middleware } from "openapi-fetch"
import { Platform } from "react-native"

import { API_URL, authClient } from "@/lib/auth-client"

import type { components, paths } from "./schema"

export type Schemas = components["schemas"]

/**
 * On phones the session lives in secure storage instead of a browser cookie,
 * so it is added to every request by hand. The web sends the cookie itself.
 */
const sessionCookie: Middleware = {
  async onRequest({ request }) {
    if (Platform.OS === "web") return request
    const { getCookie } = authClient as { getCookie?: () => Promise<string> }
    const cookie = await getCookie?.()
    if (cookie) request.headers.set("cookie", cookie)
    return request
  },
}

/**
 * Typed client for the idkjustfood API, generated from apps/api/openapi.json.
 * After changing an API route, run `bun run openapi` in apps/api and
 * `bun run api:generate` in apps/app.
 */
export const api = createClient<paths>({
  baseUrl: API_URL,
  credentials: Platform.OS === "web" ? "include" : "omit",
})
api.use(sessionCookie)

/** An API answer that was not a success. `message` is meant for people. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}

/**
 * Unwraps an openapi-fetch result: returns the data, or throws an `ApiError`
 * with the server's message.
 */
export async function call<T>(
  request: Promise<{
    data?: T
    error?: { error: string } | unknown
    response: Response
  }>
): Promise<T> {
  let result
  try {
    result = await request
  } catch {
    throw new ApiError("Could not reach the server. Check your connection.", 0)
  }
  const { data, error, response } = result
  if (!response.ok) {
    const message =
      error && typeof error === "object" && "error" in error
        ? String(error.error)
        : `Something went wrong (${response.status}).`
    throw new ApiError(message, response.status)
  }
  return data as T
}
