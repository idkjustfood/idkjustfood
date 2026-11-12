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
    readonly status: number,
    /** A short code from the server, like `unsupported_link`, when it sent one. */
    readonly code?: string
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
    error?: { error: string; code?: string } | unknown
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
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : undefined
    throw new ApiError(message, response.status, code)
  }
  return data as T
}

/** A picture chosen on the phone or in the browser, ready to upload. */
export type PickedImage = {
  uri: string
  name: string
  mimeType: string
  /** Set by the browser's file picker. */
  file?: Blob
}

/**
 * Sends a picture and fields as a multipart form (openapi-fetch cannot send files).
 * Answers like `call` does: the JSON data, or an `ApiError` with the server's message.
 */
export async function uploadImage<T>(
  path: string,
  image: PickedImage,
  fields: Record<string, string | undefined> = {}
): Promise<T> {
  const form = new FormData()
  if (Platform.OS === "web") {
    const blob = image.file ?? (await (await fetch(image.uri)).blob())
    form.append("image", blob, image.name)
  } else {
    form.append("image", {
      uri: image.uri,
      name: image.name,
      type: image.mimeType,
    } as unknown as Blob)
  }
  for (const [key, value] of Object.entries(fields)) {
    if (value) form.append(key, value)
  }

  const headers: Record<string, string> = {}
  if (Platform.OS !== "web") {
    const { getCookie } = authClient as { getCookie?: () => Promise<string> }
    const cookie = await getCookie?.()
    if (cookie) headers.cookie = cookie
  }

  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      body: form,
      headers,
      credentials: Platform.OS === "web" ? "include" : "omit",
    })
  } catch {
    throw new ApiError("Could not reach the server. Check your connection.", 0)
  }
  const body = (await response.json().catch(() => null)) as {
    error?: string
    code?: string
  } | null
  if (!response.ok) {
    throw new ApiError(
      body?.error ?? `Something went wrong (${response.status}).`,
      response.status,
      body?.code
    )
  }
  return body as T
}
