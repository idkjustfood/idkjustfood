import { useWindowDimensions } from "react-native"

/** From this width on, the app shows a side bar instead of a bottom tab bar. */
export const WIDE_BREAKPOINT = 768

export function useIsWide() {
  return useWindowDimensions().width >= WIDE_BREAKPOINT
}

/** How many cards fit next to each other: 1 on phones, 2 on tablets, 3 on desktops. */
export function useColumns() {
  const { width } = useWindowDimensions()
  if (width >= 1280) return 3
  if (width >= 640) return 2
  return 1
}
