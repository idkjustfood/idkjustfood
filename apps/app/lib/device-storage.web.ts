/** The web version of `device-storage.ts`: the browser's local storage. */
export const deviceStorage = {
  read: async (key: string): Promise<string | null> =>
    globalThis.localStorage?.getItem(key) ?? null,
  write: async (key: string, value: string): Promise<void> => {
    globalThis.localStorage?.setItem(key, value)
  },
}
