import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { bodyLimit } from "hono/body-limit"

import type { Database } from "@workspace/database"
import {
  DEFAULT_ALLOWED_FILE_TYPES,
  DEFAULT_MAX_FILE_MB,
  FileUpdateSchema,
  FolderInputSchema,
  FolderSchema,
  FolderUpdateSchema,
  isAllowedFileType,
  StoredFileSchema,
  type Folder,
  type StoredFile,
} from "@workspace/schemas"

import type { Auth, AuthEnv } from "../auth.js"
import { requireSession, type AuthVariables } from "../session.js"
import {
  localDiskStorage,
  filesDirectoryFromEnv,
  type FileStorage,
} from "./storage.js"
import { fileStore, type FileRow, type FolderRow } from "./store.js"

const ErrorSchema = z
  .object({ error: z.string().openapi({ example: "File not found" }) })
  .openapi("Error")

const FileBody = StoredFileSchema.openapi("StoredFile")
const FolderBody = FolderSchema.openapi("FileFolder")

const json = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { "application/json": { schema } },
  description,
})
const error = (description: string) => json(ErrorSchema, description)

const signedIn = { 401: error("Not signed in") }
const tags = ["Files"]
const security = [{ cookieAuth: [] }]
const notFound = error("The file doesn't exist, or you can't see it")

const folderNotFound = error("The folder doesn't exist, or you can't see it")
const folderId = z.object({
  folderId: z.string().openapi({ param: { name: "folderId", in: "path" } }),
})

const fileId = z.object({
  fileId: z.string().openapi({ param: { name: "fileId", in: "path" } }),
})

/** The settings of the files feature, read from the environment. */
export function fileLimitsFromEnv(env: AuthEnv) {
  const mb = Number(env.FILES_MAX_MB)
  const maxMb = Number.isFinite(mb) && mb > 0 ? mb : DEFAULT_MAX_FILE_MB
  const listed = (env.FILES_ALLOWED_TYPES ?? "")
    .split(",")
    .map((type) => type.trim())
    .filter(Boolean)
  return {
    maxBytes: Math.floor(maxMb * 1024 * 1024),
    allowedTypes: listed.length > 0 ? listed : DEFAULT_ALLOWED_FILE_TYPES,
  }
}

const UploadBody = z
  .object({
    file: z.file().openapi({
      type: "string",
      format: "binary",
      description:
        "The file. The size limit and the allowed types are set by the server (`FILES_MAX_MB`, `FILES_ALLOWED_TYPES`).",
    }),
    householdId: z.string().optional().openapi({
      description:
        "Share the file with this household. Leave out to keep it personal.",
    }),
    name: z.string().optional().openapi({
      description:
        "The name to give the file. Leave out to use the name of the uploaded file.",
    }),
    folderId: z
      .string()
      .optional()
      .openapi({
        description:
          "Put the file in this folder. Leave out to put it in the root. The folder must belong " +
          "to the same space (the same household, or your own folders).",
      }),
  })
  .openapi("FileUpload")

const listFiles = createRoute({
  method: "get",
  path: "/files",
  tags,
  security,
  summary: "List files",
  description:
    "Your own files and the files of your households. With `householdId`, only the files of " +
    "that household. Newest first.",
  request: { query: z.object({ householdId: z.string().optional() }) },
  responses: {
    200: json(z.object({ files: z.array(FileBody) }), "The files"),
    404: error("Household not found, or you are not a member"),
    ...signedIn,
  },
})

const uploadFile = createRoute({
  method: "post",
  path: "/files",
  tags,
  security,
  summary: "Upload a file",
  description:
    "Stores the file on the server's own disk. Without `householdId` the file is personal: only " +
    "you can see it, not even the members of your households. With `householdId` every " +
    "member of that household can see it.",
  request: {
    body: {
      content: { "multipart/form-data": { schema: UploadBody } },
      required: true,
    },
  },
  responses: {
    201: json(z.object({ file: FileBody }), "Stored"),
    400: error("Empty, too large or not an allowed type"),
    404: error("Household not found, or you are not a member"),
    ...signedIn,
  },
})

const getFile = createRoute({
  method: "get",
  path: "/files/{fileId}",
  tags,
  security,
  summary: "Get the details of a file",
  request: { params: fileId },
  responses: {
    200: json(z.object({ file: FileBody }), "The file's details"),
    404: notFound,
    ...signedIn,
  },
})

const downloadFile = createRoute({
  method: "get",
  path: "/files/{fileId}/content",
  tags,
  security,
  summary: "Download a file",
  description:
    "The bytes of the file, sent as a download with the type it was stored with.",
  request: { params: fileId },
  responses: {
    200: {
      description: "The file",
      content: {
        "application/octet-stream": {
          schema: z.string().openapi({ type: "string", format: "binary" }),
        },
      },
    },
    404: notFound,
    ...signedIn,
  },
})

const deleteFile = createRoute({
  method: "delete",
  path: "/files/{fileId}",
  tags,
  security,
  summary: "Delete a file",
  description:
    "Removes the file from the disk. A personal file can be deleted by its owner. A household " +
    "file can be deleted by the person who uploaded it and by the household's owners and admins.",
  request: { params: fileId },
  responses: {
    204: { description: "Deleted" },
    403: error("A household member who may see the file, but not delete it"),
    404: notFound,
    ...signedIn,
  },
})

const updateFile = createRoute({
  method: "patch",
  path: "/files/{fileId}",
  tags,
  security,
  summary: "Rename or move a file",
  description:
    "Changes the name, the folder, or both. `folderId: null` moves the file to the root. " +
    "Allowed for the same people who may delete the file.",
  request: {
    params: fileId,
    body: {
      content: { "application/json": { schema: FileUpdateSchema } },
      required: true,
    },
  },
  responses: {
    200: json(z.object({ file: FileBody }), "The updated file"),
    400: error("The folder is not in the same space as the file"),
    403: error("A household member who may see the file, but not change it"),
    404: notFound,
    ...signedIn,
  },
})

const listFolders = createRoute({
  method: "get",
  path: "/file-folders",
  tags,
  security,
  summary: "List folders",
  description:
    "Your own folders and the folders of your households. With `householdId`, only the folders " +
    "of that household. Sorted by name.",
  request: { query: z.object({ householdId: z.string().optional() }) },
  responses: {
    200: json(z.object({ folders: z.array(FolderBody) }), "The folders"),
    404: error("Household not found, or you are not a member"),
    ...signedIn,
  },
})

const createFolder = createRoute({
  method: "post",
  path: "/file-folders",
  tags,
  security,
  summary: "Create a folder",
  request: {
    body: {
      content: { "application/json": { schema: FolderInputSchema } },
      required: true,
    },
  },
  responses: {
    201: json(z.object({ folder: FolderBody }), "Created"),
    404: error("Household not found, or you are not a member"),
    ...signedIn,
  },
})

const updateFolder = createRoute({
  method: "patch",
  path: "/file-folders/{folderId}",
  tags,
  security,
  summary: "Rename a folder or change its colour",
  description:
    "`color: null` goes back to the default look. Allowed for the person who made the folder " +
    "and for the household's owners and admins.",
  request: {
    params: folderId,
    body: {
      content: { "application/json": { schema: FolderUpdateSchema } },
      required: true,
    },
  },
  responses: {
    200: json(z.object({ folder: FolderBody }), "The updated folder"),
    403: error("A household member who may see the folder, but not change it"),
    404: folderNotFound,
    ...signedIn,
  },
})

const deleteFolder = createRoute({
  method: "delete",
  path: "/file-folders/{folderId}",
  tags,
  security,
  summary: "Delete a folder",
  description:
    "Deletes the folder and every file in it, from the database and from the disk. Allowed for " +
    "the person who made the folder and for the household's owners and admins.",
  request: { params: folderId },
  responses: {
    204: { description: "Deleted" },
    403: error("A household member who may see the folder, but not delete it"),
    404: folderNotFound,
    ...signedIn,
  },
})

type Env = { Variables: AuthVariables }

const toFile = (row: FileRow): StoredFile => ({
  id: row.id,
  name: row.name,
  mimeType: row.mimeType,
  sizeBytes: row.sizeBytes,
  householdId: row.organizationId,
  folderId: row.folderId,
  uploadedBy: row.userId,
  createdAt: row.createdAt.toISOString(),
})

const toFolder = (row: FolderRow): Folder => ({
  id: row.id,
  name: row.name,
  color: row.color as Folder["color"],
  householdId: row.organizationId,
  createdBy: row.userId,
  createdAt: row.createdAt.toISOString(),
})

/** What a type is called when the phone or browser did not say. */
const typeByExtension: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

/** Only the last part of a name, with control characters removed. A name is never a path. */
export function cleanFileName(name: string) {
  const last = name.split(/[\\/]/).pop() ?? ""
  // eslint-disable-next-line no-control-regex
  const cleaned = last.replace(/[\u0000-\u001f\u007f]/g, "").trim()
  return (cleaned.slice(0, 200) || "file").replace(/^\.+$/, "file")
}

function typeOf(file: File, name: string) {
  const declared = file.type.split(";")[0]?.trim().toLowerCase()
  if (declared && declared !== "application/octet-stream") return declared
  const extension = name.split(".").pop()?.toLowerCase() ?? ""
  return typeByExtension[extension] ?? "application/octet-stream"
}

/** A download name that works with any characters in it. */
const attachment = (name: string) =>
  `attachment; filename*=UTF-8''${encodeURIComponent(name).replace(/['()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())}`

/** File endpoints. Mounted under /api. Files are kept on the server's disk by `storage`. */
export function fileRoutes(
  db: Database,
  auth: Auth,
  env: AuthEnv,
  storage: FileStorage = localDiskStorage(filesDirectoryFromEnv(env))
) {
  const store = fileStore(db)
  const { maxBytes, allowedTypes } = fileLimitsFromEnv(env)
  const limitText = `${Math.round((maxBytes / 1024 / 1024) * 10) / 10} MB`

  const app = new OpenAPIHono<Env>({
    defaultHook: (result, c) => {
      if (!result.success) {
        const issue = result.error.issues[0]
        const field = issue?.path.join(".")
        return c.json(
          { error: field ? `${field}: ${issue?.message}` : "Invalid request" },
          400
        )
      }
    },
  })

  for (const path of [
    "/files",
    "/files/*",
    "/file-folders",
    "/file-folders/*",
  ]) {
    app.use(path, requireSession(auth))
  }
  // Stop huge uploads before they are read into memory.
  app.use("/files", async (c, next) => {
    if (c.req.method !== "POST") return next()
    return bodyLimit({
      maxSize: maxBytes + 64 * 1024,
      onError: (c) =>
        c.json(
          { error: `The file is too large. The limit is ${limitText}.` },
          400
        ),
    })(c, next)
  })

  app.openapi(listFiles, async (c) => {
    const { householdId } = c.req.valid("query")
    const userId = c.get("user").id
    const rows = householdId
      ? await store.forSpace(userId, householdId)
      : await store.listForUser(userId)
    if (!rows) return c.json({ error: "Household not found" }, 404)
    return c.json({ files: rows.map(toFile) }, 200)
  })

  app.openapi(uploadFile, async (c) => {
    const {
      file,
      householdId,
      name: chosenName,
      folderId,
    } = c.req.valid("form")
    const userId = c.get("user").id
    if (!(await store.mayUse(userId, householdId || null))) {
      return c.json({ error: "Household not found" }, 404)
    }
    if (
      !(await store.folderFits(folderId || null, userId, householdId || null))
    ) {
      return c.json({ error: "Folder not found" }, 400)
    }
    if (file.size === 0) return c.json({ error: "The file is empty." }, 400)
    if (file.size > maxBytes) {
      return c.json(
        { error: `The file is too large. The limit is ${limitText}.` },
        400
      )
    }
    const name = cleanFileName(chosenName?.trim() || file.name)
    const mimeType = typeOf(file, cleanFileName(file.name))
    if (!isAllowedFileType(mimeType, allowedTypes)) {
      return c.json({ error: "This type of file is not allowed here." }, 400)
    }

    const data = new Uint8Array(await file.arrayBuffer())
    const row = await store.create(userId, {
      name,
      mimeType,
      sizeBytes: data.byteLength,
      householdId: householdId || null,
      folderId: folderId || null,
    })
    try {
      await storage.put(row.storageKey, data)
    } catch (cause) {
      await store.remove(row.id)
      throw cause
    }
    return c.json({ file: toFile(row) }, 201)
  })

  app.openapi(getFile, async (c) => {
    const found = await store.access(
      c.req.valid("param").fileId,
      c.get("user").id
    )
    if (!found) return c.json({ error: "File not found" }, 404)
    return c.json({ file: toFile(found.row) }, 200)
  })

  app.openapi(downloadFile, async (c) => {
    const found = await store.access(
      c.req.valid("param").fileId,
      c.get("user").id
    )
    const bytes = found && (await storage.read(found.row.storageKey))
    if (!found || !bytes) return c.json({ error: "File not found" }, 404)
    return new Response(bytes.stream(), {
      headers: {
        "content-type": found.row.mimeType,
        "content-length": String(bytes.size),
        "content-disposition": attachment(found.row.name),
        "x-content-type-options": "nosniff",
        "content-security-policy": "sandbox",
        "cache-control": "private, no-store",
      },
    }) as never
  })

  app.openapi(updateFile, async (c) => {
    const found = await store.access(
      c.req.valid("param").fileId,
      c.get("user").id
    )
    if (!found) return c.json({ error: "File not found" }, 404)
    if (!found.mayDelete) {
      return c.json(
        {
          error:
            "Only the person who uploaded it or a household admin can change this file.",
        },
        403
      )
    }
    const { name, folderId } = c.req.valid("json")
    if (
      folderId !== undefined &&
      !(await store.folderFits(
        folderId,
        found.row.userId,
        found.row.organizationId
      ))
    ) {
      return c.json({ error: "Folder not found" }, 400)
    }
    const row = await store.updateFile(found.row.id, {
      name: name === undefined ? undefined : cleanFileName(name),
      folderId,
    })
    return c.json({ file: toFile(row!) }, 200)
  })

  app.openapi(deleteFile, async (c) => {
    const found = await store.access(
      c.req.valid("param").fileId,
      c.get("user").id
    )
    if (!found) return c.json({ error: "File not found" }, 404)
    if (!found.mayDelete) {
      return c.json(
        {
          error:
            "Only the person who uploaded it or a household admin can delete this file.",
        },
        403
      )
    }
    await store.remove(found.row.id)
    await storage.remove(found.row.storageKey)
    return c.body(null, 204)
  })

  app.openapi(listFolders, async (c) => {
    const { householdId } = c.req.valid("query")
    const rows = await store.listFolders(c.get("user").id, householdId)
    if (!rows) return c.json({ error: "Household not found" }, 404)
    return c.json({ folders: rows.map(toFolder) }, 200)
  })

  app.openapi(createFolder, async (c) => {
    const { name, color, householdId } = c.req.valid("json")
    const userId = c.get("user").id
    if (!(await store.mayUse(userId, householdId || null))) {
      return c.json({ error: "Household not found" }, 404)
    }
    const row = await store.createFolder(userId, {
      name: cleanFileName(name),
      color: color ?? null,
      householdId: householdId || null,
    })
    return c.json({ folder: toFolder(row) }, 201)
  })

  app.openapi(updateFolder, async (c) => {
    const found = await store.folderAccess(
      c.req.valid("param").folderId,
      c.get("user").id
    )
    if (!found) return c.json({ error: "Folder not found" }, 404)
    if (!found.mayManage) {
      return c.json(
        {
          error:
            "Only the person who made the folder or a household admin can change it.",
        },
        403
      )
    }
    const { name, color } = c.req.valid("json")
    const row = await store.updateFolder(found.row.id, {
      name: name === undefined ? undefined : cleanFileName(name),
      color,
    })
    return c.json({ folder: toFolder(row!) }, 200)
  })

  app.openapi(deleteFolder, async (c) => {
    const found = await store.folderAccess(
      c.req.valid("param").folderId,
      c.get("user").id
    )
    if (!found) return c.json({ error: "Folder not found" }, 404)
    if (!found.mayManage) {
      return c.json(
        {
          error:
            "Only the person who made the folder or a household admin can delete it.",
        },
        403
      )
    }
    const keys = await store.removeFolder(found.row.id)
    await Promise.all(keys.map((key) => storage.remove(key)))
    return c.body(null, 204)
  })

  return app
}
