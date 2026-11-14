import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake"

const tag = "cooking-mode"

/** iOS and Android: keeps the screen on until `release` is called. */
export const keepAwake = {
  /** Resolves `false` when the screen cannot be kept on. */
  async hold(): Promise<boolean> {
    try {
      await activateKeepAwakeAsync(tag)
      return true
    } catch {
      return false
    }
  },
  release() {
    void deactivateKeepAwake(tag)
  },
}
