import * as React from "react"
import { Text } from "react-native"

import { useTheme } from "@/lib/theme"

/** A heading in the theme's heading font. Use it instead of a bare `<Text role="heading">`. */
export function Heading({
  style,
  ...props
}: React.ComponentProps<typeof Text>) {
  const { headingStyle } = useTheme()
  return <Text role="heading" {...props} style={[headingStyle, style]} />
}
