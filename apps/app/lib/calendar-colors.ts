import type { CalendarColor } from "@workspace/schemas"

/**
 * The classes that draw each entry colour. Written out in full, because Tailwind only finds class
 * names it can read in the source. They are design tokens (`tone-*`), so every theme draws the
 * colours in its own way, and nothing here is a hardcoded colour.
 */
export const calendarTone: Record<
  CalendarColor,
  { bg: string; text: string; border: string }
> = {
  rose: { bg: "bg-tone-rose", text: "text-tone-rose-foreground", border: "border-tone-rose-foreground" },
  peach: { bg: "bg-tone-peach", text: "text-tone-peach-foreground", border: "border-tone-peach-foreground" },
  butter: { bg: "bg-tone-butter", text: "text-tone-butter-foreground", border: "border-tone-butter-foreground" },
  sage: { bg: "bg-tone-sage", text: "text-tone-sage-foreground", border: "border-tone-sage-foreground" },
  sky: { bg: "bg-tone-sky", text: "text-tone-sky-foreground", border: "border-tone-sky-foreground" },
  lavender: { bg: "bg-tone-lavender", text: "text-tone-lavender-foreground", border: "border-tone-lavender-foreground" },
}
