import { mkdir, rm } from "node:fs/promises"
import { join, resolve } from "node:path"

/**
 * Where the bytes of files are kept. The API only talks to this interface, so another storage
 * (for example a network disk) can be added without touching the routes.
 */
export type FileStorage = {
  /** Saves the bytes under `key`. */
  put(key: string, data: Uint8Array): Promise<void>
  /** The stored bytes, or undefined when nothing is stored under `key`. */
  read(key: string): Promise<Blob | undefined>
  /** Removes the bytes. Removing something that is not there is fine. */
  remove(key: string): Promise<void>
}

/** A generated key is only letters, digits and dashes, so it can never leave the folder. */
const SAFE_KEY = /^[a-zA-Z0-9-]{1,100}$/

function checkKey(key: string) {
  if (!SAFE_KEY.test(key)) throw new Error("Invalid storage key")
}

/** Keeps files in one folder on the disk of the server. Nothing leaves the machine. */
export function localDiskStorage(directory: string): FileStorage {
  const root = resolve(directory)
  const pathOf = (key: string) => {
    checkKey(key)
    return join(root, key)
  }

  return {
    async put(key, data) {
      const path = pathOf(key)
      await mkdir(root, { recursive: true })
      await Bun.write(path, data)
    },
    async read(key) {
      const file = Bun.file(pathOf(key))
      return (await file.exists()) ? file : undefined
    },
    async remove(key) {
      await rm(pathOf(key), { force: true })
    },
  }
}

/** The folder for files: `FILES_DIR`, or `./data/files` next to where the API runs. */
export function filesDirectoryFromEnv(env: { FILES_DIR?: string }) {
  return env.FILES_DIR?.trim() || "./data/files"
}
