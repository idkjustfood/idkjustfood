import { count } from "drizzle-orm"

import { schema, type Database } from "@workspace/database"

import { householdStore } from "./households/store.js"

export const SIGNUP_MODES = ["first-user-only", "invite", "open"] as const
export type SignupMode = (typeof SIGNUP_MODES)[number]

/** Header the app sends with a sign-up that comes from a household invite link. */
export const INVITE_HEADER = "x-invite-id"

/**
 * Reads SIGNUP_MODE. Empty means the safe default, `first-user-only`.
 * A typo throws, so a server never ends up more open than its owner meant.
 */
export function signupModeFromEnv(
  env: Record<string, string | undefined>
): SignupMode {
  const value = env.SIGNUP_MODE?.trim().toLowerCase()
  if (!value) return "first-user-only"
  if ((SIGNUP_MODES as readonly string[]).includes(value)) {
    return value as SignupMode
  }
  throw new Error(
    `Invalid SIGNUP_MODE "${env.SIGNUP_MODE}". Use one of: ${SIGNUP_MODES.join(", ")}.`
  )
}

export type SignupDecision =
  { allowed: true; firstUser: boolean } | { allowed: false; reason: string }

/** Decides whether a new account may be created right now. */
export function signupPolicy(db: Database, mode: SignupMode) {
  async function hasUsers() {
    const [row] = await db.select({ n: count() }).from(schema.user)
    return (row?.n ?? 0) > 0
  }

  return {
    mode,
    hasUsers,

    /** Whether the sign-up screen can work without an invite link. */
    async isOpen() {
      if (mode === "open") return true
      // Without any user yet, the first account can always be created.
      return !(await hasUsers())
    },

    async decide(inviteId: string | null | undefined): Promise<SignupDecision> {
      const firstUser = !(await hasUsers())
      // The very first account is always allowed: it becomes the admin.
      if (firstUser || mode === "open") return { allowed: true, firstUser }
      if (mode === "invite") {
        if (inviteId && (await householdStore(db).findInvite(inviteId))) {
          return { allowed: true, firstUser }
        }
        return {
          allowed: false,
          reason: "Registration is closed. You need an invite link to sign up.",
        }
      }
      return {
        allowed: false,
        reason: "Registration is closed. Ask the server owner for access.",
      }
    },
  }
}

export type SignupPolicy = ReturnType<typeof signupPolicy>
