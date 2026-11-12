import { DarkTheme, DefaultTheme, type Theme } from "expo-router"
import { colorScheme, useColorScheme } from "nativewind"
import { useEffect } from "react"
import { Platform } from "react-native"

import type { Appearance } from "@/lib/app-state"

/** Navigation colours, kept in line with the tokens in global.css. */
export const NAV_THEME: Record<"light" | "dark", Theme> = {
  light: {
    ...DefaultTheme,
    colors: {
      background: "hsl(0, 0%, 100%)",
      border: "hsl(0, 0%, 89.8%)",
      card: "hsl(0, 0%, 100%)",
      notification: "hsl(0, 72%, 51%)",
      primary: "hsl(226, 70%, 40%)",
      text: "hsl(0, 0%, 3.9%)",
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      background: "hsl(0, 0%, 3.9%)",
      border: "hsl(0, 0%, 14.9%)",
      card: "hsl(0, 0%, 3.9%)",
      notification: "hsl(0, 70%, 55%)",
      primary: "hsl(226, 70%, 55%)",
      text: "hsl(0, 0%, 98%)",
    },
  },
}

/**
 * Applies the chosen appearance and returns the scheme in use.
 * On the web NativeWind's "class" dark mode does not follow the system by itself,
 * so we resolve "system" with a media query and set the class.
 */
export function useAppearance(appearance: Appearance): "light" | "dark" {
  const { colorScheme: current } = useColorScheme()

  useEffect(() => {
    if (Platform.OS !== "web") {
      colorScheme.set(appearance)
      return
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const apply = () =>
      colorScheme.set(
        appearance === "system"
          ? media.matches
            ? "dark"
            : "light"
          : appearance
      )
    apply()
    media.addEventListener("change", apply)
    return () => media.removeEventListener("change", apply)
  }, [appearance])

  return current === "dark" ? "dark" : "light"
}
