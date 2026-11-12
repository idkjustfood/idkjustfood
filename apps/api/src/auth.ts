import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { organization } from "better-auth/plugins"

import type { Database } from "@workspace/database"

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
export function createAuth(db: Database, env: AuthEnv) {
  const trustedOrigins = [env.APP_URL].filter((url): url is string => !!url)

  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins,
    database: drizzleAdapter(db, { provider: "pg" }),
    emailAndPassword: { enabled: true },
    socialProviders: socialProvidersFromEnv(env),
    // Organizations are used as households later.
    plugins: [organization()],
  })
}

export type Auth = ReturnType<typeof createAuth>
