import { Platform } from "react-native"

/**
 * Remembers an invite link that was opened while signed out, so the person
 * comes back to it after logging in or registering. On the web it also
 * survives the page reload of a social sign-in.
 */
const KEY = "idkjustfood.pendingInvite"
let pending: string | null = null

function webStorage() {
  if (Platform.OS !== "web") return null
  try {
    return globalThis.sessionStorage ?? null
  } catch {
    return null
  }
}

export function setPendingInvite(inviteId: string | null) {
  pending = inviteId
  try {
    if (inviteId) webStorage()?.setItem(KEY, inviteId)
    else webStorage()?.removeItem(KEY)
  } catch {
    // Storage can be blocked; the in-memory value still works.
  }
}

/** Returns the remembered invite and forgets it. */
export function takePendingInvite() {
  let value = pending
  try {
    value ??= webStorage()?.getItem(KEY) ?? null
  } catch {
    // Ignore blocked storage.
  }
  setPendingInvite(null)
  return value
}
