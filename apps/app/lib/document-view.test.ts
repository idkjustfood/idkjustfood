import { describe, expect, test } from "bun:test"

import {
  cacheFileName,
  documentKind,
  filesInFolder,
  isValidName,
  sortFolders,
  suggestedName,
  mayDeleteDocument,
  sizeParts,
} from "./document-view"

describe("documentKind", () => {
  test("tells pdf, image, text and other apart", () => {
    expect(documentKind("application/pdf")).toBe("pdf")
    expect(documentKind("image/heic")).toBe("image")
    expect(documentKind("text/csv")).toBe("text")
    expect(documentKind("application/zip")).toBe("other")
  })
})

describe("sizeParts", () => {
  test("picks the unit and rounds", () => {
    expect(sizeParts(0)).toEqual({ value: 0, unit: "bytes" })
    expect(sizeParts(1023)).toEqual({ value: 1023, unit: "bytes" })
    expect(sizeParts(1536)).toEqual({ value: 1.5, unit: "kb" })
    expect(sizeParts(5 * 1024 * 1024)).toEqual({ value: 5, unit: "mb" })
    expect(sizeParts(3 * 1024 ** 3)).toEqual({ value: 3, unit: "gb" })
  })
})

describe("cacheFileName", () => {
  test("keeps the extension and drops path characters", () => {
    expect(cacheFileName("a1", "Warranty 2026.pdf")).toBe(
      "a1-Warranty 2026.pdf"
    )
    expect(cacheFileName("a1", "../x/y.pdf")).toBe("a1-__x_y.pdf")
    expect(cacheFileName("a1", ".hidden")).toBe("a1-_hidden")
  })
})

describe("mayDeleteDocument", () => {
  const personal = { uploadedBy: "me", householdId: null }
  const shared = { uploadedBy: "sam", householdId: "h1" }
  test("personal files only by their owner", () => {
    expect(mayDeleteDocument(personal, "me", undefined)).toBe(true)
    expect(mayDeleteDocument(personal, "other", "owner")).toBe(false)
  })
  test("household files by the uploader or an owner or admin", () => {
    expect(mayDeleteDocument(shared, "sam", "member")).toBe(true)
    expect(mayDeleteDocument(shared, "me", "member")).toBe(false)
    expect(mayDeleteDocument(shared, "me", "owner")).toBe(true)
    expect(mayDeleteDocument(shared, "me", "member,admin")).toBe(true)
  })
})

describe("names", () => {
  test("the upload name starts as the file name", () => {
    expect(suggestedName("  scan 12.pdf ")).toBe("scan 12.pdf")
  })

  test("a name needs a visible character", () => {
    expect(isValidName("Lease")).toBe(true)
    expect(isValidName("   ")).toBe(false)
    expect(isValidName("")).toBe(false)
  })
})

describe("folders", () => {
  test("are sorted by name, ignoring case", () => {
    const names = sortFolders([{ name: "taxes" }, { name: "Bills" }]).map(
      (folder) => folder.name
    )
    expect(names).toEqual(["Bills", "taxes"])
  })

  test("files are found per folder, with null meaning the root", () => {
    const files = [
      { id: "a", folderId: null },
      { id: "b", folderId: "f1" },
    ]
    expect(filesInFolder(files, null).map((f) => f.id)).toEqual(["a"])
    expect(filesInFolder(files, "f1").map((f) => f.id)).toEqual(["b"])
  })
})
