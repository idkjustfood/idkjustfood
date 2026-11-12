import { useEffect, useState } from "react"

import { API_URL } from "@/lib/auth-client"

export type SocialProvider = "google" | "github"

/** Asks the API which social sign-in options are turned on. Empty until it answers. */
export function useSocialProviders() {
  const [providers, setProviders] = useState<SocialProvider[]>([])

  useEffect(() => {
    let cancelled = false
    fetch(`${API_URL}/api/config`)
      .then((res) => (res.ok ? res.json() : { socialProviders: [] }))
      .then((data: { socialProviders?: string[] }) => {
        if (cancelled) return
        setProviders(
          (data.socialProviders ?? []).filter(
            (p): p is SocialProvider => p === "google" || p === "github"
          )
        )
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return providers
}
