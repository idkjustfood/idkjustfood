import type { ReactNode } from "react"
import { View } from "react-native"

import { useColumns } from "@/lib/layout"

/** Lays items out in 1, 2 or 3 columns depending on the screen width. */
export function Grid<T>({
  items,
  keyOf,
  render,
}: {
  items: T[]
  keyOf: (item: T) => string
  render: (item: T) => ReactNode
}) {
  const columns = useColumns()
  const rows: T[][] = []
  for (let i = 0; i < items.length; i += columns)
    rows.push(items.slice(i, i + columns))

  return (
    <View className="gap-3">
      {rows.map((row) => (
        <View key={row.map(keyOf).join()} className="flex-row gap-3">
          {row.map((item) => (
            <View key={keyOf(item)} className="flex-1">
              {render(item)}
            </View>
          ))}
          {/* Keep the last row's cards the same width as the others. */}
          {Array.from({ length: columns - row.length }, (_, i) => (
            <View key={`spacer-${i}`} className="flex-1" />
          ))}
        </View>
      ))}
    </View>
  )
}
