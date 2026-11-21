import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Directory, File, Paths } from "expo-file-system"
import * as Sharing from "expo-sharing"
import { Platform } from "react-native"

import {
  api,
  ApiError,
  call,
  uploadDocument,
  type PickedImage,
  type Schemas,
} from "@/lib/api/client"
import { useAppState } from "@/lib/app-state"
import { API_URL, authClient } from "@/lib/auth-client"
import { cacheFileName } from "@/lib/document-view"
import i18n from "@/lib/i18n"

export type StoredFile = Schemas["StoredFile"]
export type FileFolder = Schemas["FileFolder"]

/** The space is a household id, or null for the person's own documents. */
type Space = string | null

const key = (space: Space, demo: boolean) =>
  ["documents", { space, demo }] as const
const folderKey = (space: Space, demo: boolean) =>
  ["document-folders", { space, demo }] as const

/**
 * The documents of a space. Documents are kept on the server, not on the phone, so they need a
 * connection. The demo has no server and shows none.
 */
export function useDocuments(space: Space) {
  const { demo } = useAppState()
  return useQuery({
    queryKey: key(space, demo),
    queryFn: async (): Promise<StoredFile[]> => {
      if (demo) return []
      // Without a household the server lists every document the person may see, so keep the
      // personal ones here.
      const { files } = await call(
        api.GET("/api/files", {
          params: { query: { householdId: space ?? undefined } },
        })
      )
      return files.filter((file) => file.householdId === space)
    },
  })
}

/** The folders of a space, with the same rules as `useDocuments`. */
export function useDocumentFolders(space: Space) {
  const { demo } = useAppState()
  return useQuery({
    queryKey: folderKey(space, demo),
    queryFn: async (): Promise<FileFolder[]> => {
      if (demo) return []
      const { folders } = await call(
        api.GET("/api/file-folders", {
          params: { query: { householdId: space ?? undefined } },
        })
      )
      return folders.filter((folder) => folder.householdId === space)
    },
  })
}

/**
 * Uploads a document to the space: personal when `space` is null, shared with the household
 * otherwise. `name` is what the person called it, `folderId` null means the root.
 */
export function useUploadDocument(space: Space) {
  const client = useQueryClient()
  const { demo } = useAppState()
  return useMutation({
    mutationFn: async (input: {
      file: PickedImage
      name: string
      folderId: string | null
    }) => {
      if (demo) throw new ApiError(i18n.t("common:demoOnly"), 0)
      return uploadDocument<{ file: StoredFile }>("/api/files", input.file, {
        householdId: space ?? undefined,
        name: input.name.trim(),
        folderId: input.folderId ?? undefined,
      })
    },
    onSuccess: () => client.invalidateQueries({ queryKey: key(space, demo) }),
  })
}

export function useRenameDocument(space: Space) {
  const client = useQueryClient()
  const { demo } = useAppState()
  return useMutation({
    mutationFn: async (input: { fileId: string; name: string }) => {
      if (demo) throw new ApiError(i18n.t("common:demoOnly"), 0)
      await call(
        api.PATCH("/api/files/{fileId}", {
          params: { path: { fileId: input.fileId } },
          body: { name: input.name.trim() },
        })
      )
    },
    onSuccess: () => client.invalidateQueries({ queryKey: key(space, demo) }),
  })
}

export type FolderInput = { name: string; color: FileFolder["color"] }

export function useCreateFolder(space: Space) {
  const client = useQueryClient()
  const { demo } = useAppState()
  return useMutation({
    mutationFn: async (input: FolderInput) => {
      if (demo) throw new ApiError(i18n.t("common:demoOnly"), 0)
      const { folder } = await call(
        api.POST("/api/file-folders", {
          body: {
            name: input.name.trim(),
            color: input.color,
            householdId: space ?? undefined,
          },
        })
      )
      return folder
    },
    onSuccess: () =>
      client.invalidateQueries({ queryKey: folderKey(space, demo) }),
  })
}

export function useUpdateFolder(space: Space) {
  const client = useQueryClient()
  const { demo } = useAppState()
  return useMutation({
    mutationFn: async (input: FolderInput & { folderId: string }) => {
      if (demo) throw new ApiError(i18n.t("common:demoOnly"), 0)
      await call(
        api.PATCH("/api/file-folders/{folderId}", {
          params: { path: { folderId: input.folderId } },
          body: { name: input.name.trim(), color: input.color },
        })
      )
    },
    onSuccess: () =>
      client.invalidateQueries({ queryKey: folderKey(space, demo) }),
  })
}

/** Deletes a folder and the documents in it. */
export function useDeleteFolder(space: Space) {
  const client = useQueryClient()
  const { demo } = useAppState()
  return useMutation({
    mutationFn: async (folderId: string) => {
      if (demo) throw new ApiError(i18n.t("common:demoOnly"), 0)
      await call(
        api.DELETE("/api/file-folders/{folderId}", {
          params: { path: { folderId } },
        })
      )
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: folderKey(space, demo) })
      return client.invalidateQueries({ queryKey: key(space, demo) })
    },
  })
}

export function useDeleteDocument(space: Space) {
  const client = useQueryClient()
  const { demo } = useAppState()
  return useMutation({
    mutationFn: async (fileId: string) => {
      if (demo) throw new ApiError(i18n.t("common:demoOnly"), 0)
      await call(
        api.DELETE("/api/files/{fileId}", { params: { path: { fileId } } })
      )
    },
    onSuccess: () => client.invalidateQueries({ queryKey: key(space, demo) }),
  })
}

const contentUrl = (file: StoredFile) =>
  `${API_URL}/api/files/${encodeURIComponent(file.id)}/content`

/**
 * Opens a document. On the web the browser downloads it. On a phone it is downloaded into the
 * cache and handed to the share sheet, where the person picks an app that can open it.
 */
export async function openDocument(file: StoredFile) {
  try {
    if (Platform.OS === "web") {
      const response = await fetch(contentUrl(file), { credentials: "include" })
      if (!response.ok)
        throw new ApiError(i18n.t("documents:openError"), response.status)
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement("a")
      link.href = url
      link.download = file.name
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
      return
    }
    const { getCookie } = authClient as { getCookie?: () => Promise<string> }
    const cookie = await getCookie?.()
    const destination = new File(
      new Directory(Paths.cache),
      cacheFileName(file.id, file.name)
    )
    const saved = await File.downloadFileAsync(contentUrl(file), destination, {
      headers: cookie ? { cookie } : {},
      idempotent: true,
    })
    await Sharing.shareAsync(saved.uri, { mimeType: file.mimeType })
  } catch (cause) {
    if (cause instanceof ApiError) throw cause
    throw new ApiError(i18n.t("documents:openError"), 0)
  }
}
