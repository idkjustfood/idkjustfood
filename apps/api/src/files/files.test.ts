import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

// `createApp` comes first on purpose: it adds `.openapi()` to Zod, which the schemas need.
import { createApp } from "../app.js"
import type { StoredFile } from "@workspace/schemas"
import { client, createTestDb, testEnv } from "../test-helpers.js"
import { cleanFileName } from "./routes.js"
import { localDiskStorage } from "./storage.js"

let api: ReturnType<typeof client>
let olivia: string
let dir: string

async function body<T>(res: Response) {
  return (await res.json()) as T
}

function build(env: Record<string, string> = {}) {
  return createTestDb().then((db) =>
    client(
      createApp(db, { ...testEnv, ...env }, { storage: localDiskStorage(dir) })
    )
  )
}

function form(
  content: BlobPart = "hello",
  name = "warranty.pdf",
  type = "application/pdf",
  householdId?: string
) {
  const data = new FormData()
  data.append("file", new File([content], name, { type }))
  if (householdId) data.append("householdId", householdId)
  return data
}

const upload = (data: FormData, cookie = olivia) =>
  api.app.request("/api/files", {
    method: "POST",
    headers: { origin: testEnv.BETTER_AUTH_URL, cookie },
    body: data,
  })

async function addFile(data = form(), cookie = olivia) {
  const res = await upload(data, cookie)
  expect(res.status).toBe(201)
  return (await body<{ file: StoredFile }>(res)).file
}

async function household(owner: string) {
  const res = await api.post("/api/households", owner, { name: "Home" })
  const id = (await body<{ household: { id: string } }>(res)).household.id
  const member = await api.signUp("Sam")
  const invite = await api.post(`/api/households/${id}/invites`, owner)
  const { invite: link } = await body<{ invite: { id: string } }>(invite)
  await api.post(`/api/invites/${link.id}/accept`, member)
  return { id, member }
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "idkjustfood-files-"))
  api = await build()
  olivia = await api.signUp("Olivia")
})

afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe("files", () => {
  test("need a signed-in user", async () => {
    expect((await api.get("/api/files")).status).toBe(401)
    expect((await upload(form(), "")).status).toBe(401)
    expect((await api.get("/api/files/x/content")).status).toBe(401)
  })

  test("an uploaded file is saved on the local disk and can be downloaded", async () => {
    const file = await addFile(form("the warranty"))
    expect(file.name).toBe("warranty.pdf")
    expect(file.sizeBytes).toBe(12)
    expect(file.householdId).toBeNull()

    // On disk under a generated name, not the name of the upload.
    const stored = readdirSync(dir)
    expect(stored).toHaveLength(1)
    expect(stored[0]).not.toContain("warranty")

    const res = await api.get(`/api/files/${file.id}/content`, olivia)
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("application/pdf")
    expect(res.headers.get("content-disposition")).toContain("attachment")
    expect(res.headers.get("x-content-type-options")).toBe("nosniff")
    expect(await res.text()).toBe("the warranty")
  })

  test("a personal file is hidden from everyone else, household members included", async () => {
    const { id, member } = await household(olivia)
    const file = await addFile()
    for (const path of [
      `/api/files/${file.id}`,
      `/api/files/${file.id}/content`,
    ]) {
      expect((await api.get(path, member)).status).toBe(404)
    }
    expect((await api.del(`/api/files/${file.id}`, member)).status).toBe(404)
    const list = await body<{ files: StoredFile[] }>(
      await api.get("/api/files", member)
    )
    expect(list.files).toEqual([])
    // Asking for the personal space of a household is not a way in either.
    const inHousehold = await body<{ files: StoredFile[] }>(
      await api.get(`/api/files?householdId=${id}`, member)
    )
    expect(inHousehold.files).toEqual([])
  })

  test("a household file is seen by every member and by nobody outside", async () => {
    const { id, member } = await household(olivia)
    const outsider = await api.signUp("Eve")
    const file = await addFile(form("x", "contract.pdf", "application/pdf", id))
    expect(file.householdId).toBe(id)

    expect(
      (await api.get(`/api/files/${file.id}/content`, member)).status
    ).toBe(200)
    const list = await body<{ files: StoredFile[] }>(
      await api.get(`/api/files?householdId=${id}`, member)
    )
    expect(list.files.map((f) => f.id)).toEqual([file.id])

    expect((await api.get(`/api/files/${file.id}`, outsider)).status).toBe(404)
    expect(
      (await api.get(`/api/files/${file.id}/content`, outsider)).status
    ).toBe(404)
    expect(
      (await api.get(`/api/files?householdId=${id}`, outsider)).status
    ).toBe(404)
  })

  test("the list of a person holds their files and their households' files", async () => {
    const { id, member } = await household(olivia)
    const mine = await addFile()
    const shared = await addFile(form("x", "shared.pdf", "application/pdf", id))
    const list = await body<{ files: StoredFile[] }>(
      await api.get("/api/files", olivia)
    )
    expect(list.files.map((f) => f.id).sort()).toEqual(
      [mine.id, shared.id].sort()
    )
    const sam = await body<{ files: StoredFile[] }>(
      await api.get("/api/files", member)
    )
    expect(sam.files.map((f) => f.id)).toEqual([shared.id])
  })

  test("you cannot upload to a household you are not in", async () => {
    const { id } = await household(olivia)
    const outsider = await api.signUp("Eve")
    const res = await upload(
      form("x", "a.pdf", "application/pdf", id),
      outsider
    )
    expect(res.status).toBe(404)
    expect(readdirSync(dir)).toHaveLength(0)
  })

  test("deleting removes the entry and the file on disk", async () => {
    const file = await addFile()
    expect((await api.del(`/api/files/${file.id}`, olivia)).status).toBe(204)
    expect(readdirSync(dir)).toHaveLength(0)
    expect((await api.get(`/api/files/${file.id}`, olivia)).status).toBe(404)
  })

  test("in a household the uploader or an admin may delete, other members may not", async () => {
    const { id, member } = await household(olivia)
    const file = await addFile(form("x", "a.pdf", "application/pdf", id))
    const res = await api.del(`/api/files/${file.id}`, member)
    expect(res.status).toBe(403)
    expect(readdirSync(dir)).toHaveLength(1)
    // Olivia made the household, so she is its owner and uploaded the file.
    const theirs = await addFile(
      form("y", "b.pdf", "application/pdf", id),
      member
    )
    expect((await api.del(`/api/files/${theirs.id}`, olivia)).status).toBe(204)
    expect((await api.del(`/api/files/${file.id}`, olivia)).status).toBe(204)
    expect(readdirSync(dir)).toHaveLength(0)
  })

  test("empty, too large and not allowed files are rejected", async () => {
    api = await build({ FILES_MAX_MB: "0.001" })
    olivia = await api.signUp("Olivia")
    expect((await upload(form(""))).status).toBe(400)
    const big = await upload(form("x".repeat(5000)))
    expect(big.status).toBe(400)
    expect((await body<{ error: string }>(big)).error).toContain("too large")
    const html = await upload(form("<script>", "page.html", "text/html"))
    expect(html.status).toBe(400)
    expect((await body<{ error: string }>(html)).error).toContain("not allowed")
    expect(readdirSync(dir)).toHaveLength(0)
  })

  test("the server owner sets the allowed types", async () => {
    api = await build({ FILES_ALLOWED_TYPES: "application/pdf" })
    olivia = await api.signUp("Olivia")
    expect((await upload(form())).status).toBe(201)
    expect((await upload(form("x", "a.png", "image/png"))).status).toBe(400)
  })

  test("the type comes from the extension when the upload has none", async () => {
    const file = await addFile(form("x", "scan.PDF", ""))
    expect(file.mimeType).toBe("application/pdf")
  })

  test("a file name is never a path", async () => {
    expect(cleanFileName("../../etc/passwd")).toBe("passwd")
    expect(cleanFileName("C:\\Users\\me\\bill.pdf")).toBe("bill.pdf")
    expect(cleanFileName("..")).toBe("file")
    expect(cleanFileName("")).toBe("file")
    const file = await addFile(form("x", "../../evil.pdf"))
    expect(file.name).toBe("evil.pdf")
    expect(existsSync(join(dir, "..", "evil.pdf"))).toBe(false)
  })

  test("the storage refuses keys that could leave its folder", async () => {
    const storage = localDiskStorage(dir)
    await expect(
      storage.put("../escape", new Uint8Array([1]))
    ).rejects.toThrow()
    await expect(storage.read("a/b")).rejects.toThrow()
    await expect(storage.remove("..")).rejects.toThrow()
  })
})
