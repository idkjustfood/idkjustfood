import { describe, expect, test } from "bun:test"

import {
  assertPublicUrl,
  fetchPublicPage,
  isPrivateAddress,
} from "./public-url.js"

const publicHost = async () => ["93.184.216.34"]

describe("isPrivateAddress", () => {
  test("private and local addresses", () => {
    for (const address of [
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "255.255.255.255",
      "::1",
      "::",
      "fe80::1",
      "fc00::1",
      "fd12:3456::1",
      "::ffff:10.0.0.1",
      "::ffff:7f00:1",
      "[::1]",
    ]) {
      expect(isPrivateAddress(address)).toBe(true)
    }
  })

  test("public addresses", () => {
    for (const address of [
      "93.184.216.34",
      "8.8.8.8",
      "172.32.0.1",
      "2606:2800:220:1::1",
    ]) {
      expect(isPrivateAddress(address)).toBe(false)
    }
  })
})

describe("assertPublicUrl", () => {
  test("refuses local and private network addresses", async () => {
    for (const url of [
      "http://localhost:3001/health",
      "http://api.localhost/",
      "http://127.0.0.1/",
      "http://[::1]/",
      "http://10.0.0.5/admin",
      "http://169.254.169.254/latest/meta-data/",
      "http://192.168.0.1/",
      "http://2130706433/", // 127.0.0.1 written as one number
      "http://0x7f.0.0.1/",
      "http://printer.local/",
    ]) {
      await expect(assertPublicUrl(url, publicHost)).rejects.toMatchObject({
        code: "private_address",
      })
    }
  })

  test("refuses a name that resolves to a private address", async () => {
    await expect(
      assertPublicUrl("https://sneaky.example.com/", async () => [
        "93.184.216.34",
        "10.0.0.1",
      ])
    ).rejects.toMatchObject({ code: "private_address" })
  })

  test("refuses other schemes and links with a password", async () => {
    await expect(
      assertPublicUrl("file:///etc/passwd", publicHost)
    ).rejects.toMatchObject({
      code: "invalid_input",
    })
    await expect(
      assertPublicUrl("https://user:pw@example.com/", publicHost)
    ).rejects.toMatchObject({
      code: "invalid_input",
    })
  })

  test("accepts a public site", async () => {
    const url = await assertPublicUrl("https://example.com/recipe", publicHost)
    expect(url.hostname).toBe("example.com")
  })
})

describe("fetchPublicPage", () => {
  const html = (body: string, init: ResponseInit = {}) =>
    new Response(body, { headers: { "content-type": "text/html" }, ...init })

  test("returns the page", async () => {
    const page = await fetchPublicPage("https://example.com/a", {
      lookup: publicHost,
      fetch: async () => html("<p>hi</p>"),
    })
    expect(page).toEqual({ url: "https://example.com/a", html: "<p>hi</p>" })
  })

  test("refuses a redirect to a private address", async () => {
    let calls = 0
    await expect(
      fetchPublicPage("https://example.com/a", {
        lookup: publicHost,
        fetch: async () => {
          calls++
          return new Response(null, {
            status: 302,
            headers: { location: "http://169.254.169.254/" },
          })
        },
      })
    ).rejects.toMatchObject({ code: "private_address" })
    expect(calls).toBe(1)
  })

  test("follows safe redirects, but not forever", async () => {
    await expect(
      fetchPublicPage("https://example.com/a", {
        lookup: publicHost,
        fetch: async () =>
          new Response(null, {
            status: 301,
            headers: { location: "https://example.com/a" },
          }),
      })
    ).rejects.toMatchObject({ code: "page_unreachable" })
  })

  test("stops when the page is too large", async () => {
    await expect(
      fetchPublicPage("https://example.com/a", {
        lookup: publicHost,
        maxBytes: 100,
        fetch: async () => html("x".repeat(1000)),
      })
    ).rejects.toMatchObject({ message: "That web page is too large to read." })
  })

  test("stops when the site is too slow", async () => {
    await expect(
      fetchPublicPage("https://example.com/a", {
        lookup: publicHost,
        timeoutMs: 20,
        fetch: (_url, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(new Error("aborted"))
            )
          }),
      })
    ).rejects.toMatchObject({ message: "The website took too long to answer." })
  })

  test("refuses things that are not web pages", async () => {
    await expect(
      fetchPublicPage("https://example.com/a.zip", {
        lookup: publicHost,
        fetch: async () =>
          new Response("zip", {
            headers: { "content-type": "application/zip" },
          }),
      })
    ).rejects.toMatchObject({ code: "no_recipe_found" })
  })
})
