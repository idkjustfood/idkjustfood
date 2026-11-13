import { useEffect, useState } from "react"

import { API_URL } from "@/lib/auth-client"

export type SocialProvider = "google" | "github"
export type SignupMode = "first-user-only" | "invite" | "open"

export type AuthConfig = {
  socialProviders: SocialProvider[]
  signupMode: SignupMode
  /** Whether anyone can register right now. In `invite` mode this is false. */
  signupOpen: boolean
  /** False until the server has answered. */
  loaded: boolean
}

// Until the server answers, show the sign-up form rather than a false "closed".
const initial: AuthConfig = {
  socialProviders: [],
  signupMode: "open",
  signupOpen: true,
  loaded: false,
}

/** Asks the API which sign-in and sign-up options this server has turned on. */
export function useAuthConfig() {
  const [config, setConfig] = useState<AuthConfig>(initial)

  useEffect(() => {
    let cancelled = false
    fetch(`${API_URL}/api/config`)
      .then((res) => (res.ok ? res.json() : {}))
      .then(
        (data: {
          socialProviders?: string[]
          signupMode?: SignupMode
          signupOpen?: boolean
        }) => {
          if (cancelled) return
          setConfig({
            socialProviders: (data.socialProviders ?? []).filter(
              (p): p is SocialProvider => p === "google" || p === "github"
            ),
            signupMode: data.signupMode ?? "open",
            signupOpen: data.signupOpen ?? true,
            loaded: true,
          })
        }
      )
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return config
}

/** Just the social sign-in options. Empty until the server answers. */
export function useSocialProviders() {
  return useAuthConfig().socialProviders
}
