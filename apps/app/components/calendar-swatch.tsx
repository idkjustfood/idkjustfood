import type { CalendarColor } from "@workspace/schemas"
import { View } from "react-native"

import { calendarTone } from "@/lib/calendar-colors"
import { cn } from "@/lib/utils"

/**
 * The colour of a calendar entry as a small rounded block. Colour is never the only sign:
 * the title always stands next to it.
 */
export function CalendarSwatch({
  color,
  className,
}: {
  color: CalendarColor
  className?: string
}) {
  return (
    <View
      className={cn(
        "h-6 w-6 rounded-md border",
        calendarTone[color].bg,
        calendarTone[color].border,
        className
      )}
    />
  )
}
