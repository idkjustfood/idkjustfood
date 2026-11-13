import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { expo } from "@better-auth/expo"
import { APIError } from "better-auth/api"
import { admin, organization } from "better-auth/plugins"

import type { Database } from "@workspace/database"

import {
  INVITE_HEADER,
  signupModeFromEnv,
  signupPolicy,
  type SignupPolicy,
} from "./signup-mode.js"

export type AuthEnv = Record<string, string | undefined>

/**
 * Social providers that have both a client ID and a secret set.
 * Providers without keys are left out, so self-hosters can skip them.
 */
export function socialProvidersFromEnv(env: AuthEnv) {
  const providers: Record<string, { clientId: string; clientSecret: string }> =
    {}
  const googleId = env.GOOGLE_CLIENT_ID
  const googleSecret = env.GOOGLE_CLIENT_SECRET
  if (googleId && googleSecret) {
    providers.google = { clientId: googleId, clientSecret: googleSecret }
  }
  const githubId = env.GITHUB_CLIENT_ID
  const githubSecret = env.GITHUB_CLIENT_SECRET
  if (githubId && githubSecret) {
    providers.github = { clientId: githubId, clientSecret: githubSecret }
  }
  return providers
}

/** Creates the Better Auth instance. Reads its settings from `env`. */
export function createAuth(
  db: Database,
  env: AuthEnv,
  policy: SignupPolicy = signupPolicy(db, signupModeFromEnv(env))
) {
  // The native app sends its own scheme as origin; Expo Go uses exp://.
  const trustedOrigins = [env.APP_URL, "idkjustfood://", "exp://"].filter(
    (url): url is string => !!url
  )

  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins,
    database: drizzleAdapter(db, { provider: "pg" }),
    emailAndPassword: { enabled: true },
    socialProviders: socialProvidersFromEnv(env),
    databaseHooks: {
      user: {
        create: {
          // Runs for every new account (email and social). Existing users are
          // never affected, so they can sign in in every mode.
          before: async (user, ctx) => {
            const inviteId = ctx?.request?.headers.get(INVITE_HEADER)
            const decision = await policy.decide(inviteId)
            if (!decision.allowed) {
              throw new APIError("FORBIDDEN", { message: decision.reason })
            }
            // The first account runs the server.
            return {
              data: { ...user, role: decision.firstUser ? "admin" : "user" },
            }
          },
        },
      },
    },
    // Organizations are used as households. The admin plugin adds the
    // user role that marks the server admin.
    plugins: [expo(), organization(), admin()],
  })
}

export type Auth = ReturnType<typeof createAuth>
