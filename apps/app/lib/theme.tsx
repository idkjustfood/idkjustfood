import { DarkTheme, DefaultTheme, type Theme } from "expo-router"
import { colorScheme, useColorScheme, vars } from "nativewind"
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react"
import { Platform, View, type TextStyle, type ViewStyle } from "react-native"

import type { Appearance } from "@/lib/app-state"
import {
  getTheme,
  themeVariables,
  type ColorToken,
  type ThemeDefinition,
} from "@/lib/themes"

type ThemeContext = {
  theme: ThemeDefinition
  scheme: "light" | "dark"
  /** A colour token as a CSS colour, for the few places that need a value, not a class. */
  color: (token: ColorToken) => string
  /** Style for headings and titles (the theme's handwritten font). */
  headingStyle: TextStyle
  /** Style for cards: the theme's organic corners and soft shadow. */
  cardStyle: ViewStyle
}

const hsl = (value: string) => `hsl(${value.replace(/\s+/g, ", ")})`

function build(theme: ThemeDefinition, scheme: "light" | "dark"): ThemeContext {
  const { cardRadii, shadow } = theme.shape
  return {
    theme,
    scheme,
    color: (token) => hsl(theme[scheme][token]),
    headingStyle: theme.headingFont ? { fontFamily: theme.headingFont } : {},
    cardStyle: {
      ...(cardRadii && {
        borderTopLeftRadius: cardRadii[0],
        borderTopRightRadius: cardRadii[1],
        borderBottomRightRadius: cardRadii[2],
        borderBottomLeftRadius: cardRadii[3],
      }),
      ...(shadow !== "transparent" && {
        shadowColor: shadow,
        shadowOpacity: 1,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
        elevation: 1,
      }),
    },
  }
}

const Context = createContext<ThemeContext>(build(getTheme(null), "light"))

/** The selected theme and what screens and components need from it. */
export function useTheme() {
  return useContext(Context)
}

/**
 * Puts the theme's tokens on everything below it. Tokens are CSS variables, so
 * a class such as `bg-card` follows the theme without any screen knowing about it.
 */
export function AppThemeProvider({
  themeId,
  scheme,
  children,
}: {
  themeId: string
  scheme: "light" | "dark"
  children: ReactNode
}) {
  const value = useMemo(
    () => build(getTheme(themeId), scheme),
    [themeId, scheme]
  )
  const style = useMemo(
    () => vars(themeVariables(value.theme, scheme)),
    [value.theme, scheme]
  )
  // Sheets and dialogs render outside this view on the web, so the tokens are
  // also put on the page itself.
  useEffect(() => {
    if (Platform.OS !== "web") return
    const root = document.documentElement
    const variables = themeVariables(value.theme, scheme)
    for (const [name, text] of Object.entries(variables))
      root.style.setProperty(name, text)
    root.style.colorScheme = scheme
  }, [value.theme, scheme])

  return (
    <Context value={value}>
      <View style={[{ flex: 1 }, style]}>{children}</View>
    </Context>
  )
}

/** Navigation colours (headers, tab bar) from the theme's tokens. */
export function navTheme({ color, scheme }: ThemeContext): Theme {
  const base = scheme === "dark" ? DarkTheme : DefaultTheme
  return {
    ...base,
    colors: {
      background: color("background"),
      border: color("border"),
      card: color("background"),
      notification: color("destructive"),
      primary: color("primary"),
      text: color("foreground"),
    },
  }
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
