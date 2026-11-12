import { lookup as dnsLookup } from "node:dns/promises"
import { isIP } from "node:net"

import { ExtractionError } from "../errors.js"

/** True for an IPv4 address in a range that is not on the public internet. */
function isPrivateIPv4(address: string) {
  const [a = 0, b = 0, c = 0] = address.split(".").map(Number)
  return (
    a === 0 || // "this" network
    a === 10 || // private
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local, cloud metadata
    (a === 172 && b >= 16 && b <= 31) || // private
    (a === 192 && b === 0 && c === 0) || // IETF protocol assignments
    (a === 192 && b === 168) || // private
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    a >= 224 // multicast, reserved, broadcast
  )
}

/** True for an IPv6 address that is local, private or maps to a private IPv4 one. */
function isPrivateIPv6(address: string) {
  const value = address
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .split("%")[0]!
  if (value === "::" || value === "::1") return true
  // IPv4-mapped (::ffff:10.0.0.1 or ::ffff:0a00:0001) and IPv4-compatible forms.
  const dotted = /^(?:::ffff:|::)(\d+\.\d+\.\d+\.\d+)$/.exec(value)
  if (dotted) return isPrivateIPv4(dotted[1]!)
  const hex = /^(?:::ffff:|::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(value)
  if (hex) {
    const high = parseInt(hex[1]!, 16)
    const low = parseInt(hex[2]!, 16)
    return isPrivateIPv4(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`)
  }
  const first = parseInt(value.split(":")[0] || "0", 16)
  return (
    (first & 0xfe00) === 0xfc00 || // unique local fc00::/7
    (first & 0xffc0) === 0xfe80 || // link-local fe80::/10
    (first & 0xff00) === 0xff00 // multicast
  )
}

/** True when an IP address is loopback, private, link-local or otherwise not public. */
export function isPrivateAddress(address: string) {
  const bare = address.replace(/^\[|\]$/g, "")
  const version = isIP(bare)
  if (version === 4) return isPrivateIPv4(bare)
  if (version === 6) return isPrivateIPv6(bare)
  return true
}

const refused = () =>
  new ExtractionError(
    "private_address",
    "That link points to a local or private network address, so it can't be fetched."
  )

export type LookupAddresses = (host: string) => Promise<string[]>

const systemLookup: LookupAddresses = async (host) =>
  (await dnsLookup(host, { all: true })).map((entry) => entry.address)

/**
 * Throws unless the URL is http(s) and its host resolves only to public addresses.
 * Returns the parsed URL.
 */
export async function assertPublicUrl(
  value: string,
  lookup: LookupAddresses = systemLookup
) {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new ExtractionError("invalid_input", "That is not a valid link.")
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ExtractionError(
      "invalid_input",
      "Only http and https links work."
    )
  }
  if (url.username || url.password) {
    throw new ExtractionError(
      "invalid_input",
      "Links with a user name or password are not supported."
    )
  }

  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase()
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    throw refused()
  }
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw refused()
    return url
  }

  let addresses: string[]
  try {
    addresses = await lookup(host)
  } catch {
    throw new ExtractionError(
      "page_unreachable",
      `Could not find a website at ${host}.`
    )
  }
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw refused()
  }
  return url
}

export type SafeFetchOptions = {
  /** Give up after this many milliseconds. */
  timeoutMs?: number
  /** Stop reading after this many bytes. */
  maxBytes?: number
  maxRedirects?: number
  lookup?: LookupAddresses
  fetch?: (url: string, init?: RequestInit) => Promise<Response>
}

const tooBig = () =>
  new ExtractionError("page_unreachable", "That web page is too large to read.")

async function readLimited(response: Response, maxBytes: number) {
  const declared = Number(response.headers.get("content-length"))
  if (declared > maxBytes) throw tooBig()
  if (!response.body) return ""
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > maxBytes) {
      await reader.cancel()
      throw tooBig()
    }
    chunks.push(value)
  }
  return new TextDecoder().decode(Buffer.concat(chunks))
}

/**
 * Downloads a web page as text. Every address (also after a redirect) is checked
 * to be public, and the time and size are limited.
 *
 * Known limit: the name is resolved once for the check and again by `fetch`, so a
 * DNS server that changes its answer between the two could get through. Run the
 * worker without access to internal services if that matters to you.
 */
export async function fetchPublicPage(
  value: string,
  {
    timeoutMs = 10_000,
    maxBytes = 2_000_000,
    maxRedirects = 5,
    lookup,
    fetch: fetchImpl = fetch,
  }: SafeFetchOptions = {}
): Promise<{ url: string; html: string }> {
  // A plain timer (not AbortSignal.timeout) so it keeps running and can be cleared.
  const controller = new AbortController()
  const signal = controller.signal
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let current = (await assertPublicUrl(value, lookup)).toString()

  try {
    for (let hop = 0; hop <= maxRedirects; hop++) {
      const response = await fetchImpl(current, {
        redirect: "manual",
        signal,
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; idkjustfood recipe reader)",
          accept: "text/html,application/xhtml+xml",
        },
      })

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location")
        if (!location) break
        current = (
          await assertPublicUrl(new URL(location, current).toString(), lookup)
        ).toString()
        continue
      }
      if (!response.ok) {
        throw new ExtractionError(
          "page_unreachable",
          `The website answered with an error (${response.status}).`
        )
      }
      const type = response.headers.get("content-type") ?? ""
      if (type && !/html|xml|text\/plain/i.test(type)) {
        throw new ExtractionError(
          "no_recipe_found",
          "That link is not a web page."
        )
      }
      return { url: current, html: await readLimited(response, maxBytes) }
    }
  } catch (cause) {
    if (cause instanceof ExtractionError) throw cause
    throw new ExtractionError(
      "page_unreachable",
      signal.aborted
        ? "The website took too long to answer."
        : "The website could not be reached."
    )
  } finally {
    clearTimeout(timer)
  }
  throw new ExtractionError(
    "page_unreachable",
    "The website sent too many redirects."
  )
}
