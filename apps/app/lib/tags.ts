import {
  groupTags,
  tagGroup,
  tagGroupColors,
  tagGroupKeys,
  tagsByGroup,
  type TagGroup,
  type TagKey,
} from "@workspace/schemas"

import i18n from "@/lib/i18n"

/** The name of a tag in the current language ("Italienisch" in German). */
export function tagName(tag: TagKey) {
  return i18n.t(`common:tags.${tag}`)
}

/** The name of a group of tags in the current language ("Küche"). */
export function tagGroupName(group: TagGroup) {
  return i18n.t(`common:tagGroups.${group}`)
}

/**
 * The classes of a group's color. Written out in full (not built from the color
 * name) so Tailwind sees every class. `soft` is a quiet badge, `strong` the
 * filled look of a chosen tag.
 */
const colorClasses: Record<
  TagGroup,
  { soft: string; softText: string; strong: string; strongText: string }
> = {
  cuisine: {
    soft: "border-orange-200 bg-orange-100 dark:border-orange-900 dark:bg-orange-950",
    softText: "text-orange-900 dark:text-orange-200",
    strong: "border-orange-600 bg-orange-600 dark:border-orange-500 dark:bg-orange-500",
    strongText: "text-white dark:text-orange-950",
  },
  dish: {
    soft: "border-sky-200 bg-sky-100 dark:border-sky-900 dark:bg-sky-950",
    softText: "text-sky-900 dark:text-sky-200",
    strong: "border-sky-600 bg-sky-600 dark:border-sky-500 dark:bg-sky-500",
    strongText: "text-white dark:text-sky-950",
  },
  diet: {
    soft: "border-green-200 bg-green-100 dark:border-green-900 dark:bg-green-950",
    softText: "text-green-900 dark:text-green-200",
    strong: "border-green-700 bg-green-700 dark:border-green-500 dark:bg-green-500",
    strongText: "text-white dark:text-green-950",
  },
  nutrition: {
    soft: "border-violet-200 bg-violet-100 dark:border-violet-900 dark:bg-violet-950",
    softText: "text-violet-900 dark:text-violet-200",
    strong: "border-violet-600 bg-violet-600 dark:border-violet-500 dark:bg-violet-500",
    strongText: "text-white dark:text-violet-950",
  },
  time: {
    soft: "border-amber-200 bg-amber-100 dark:border-amber-900 dark:bg-amber-950",
    softText: "text-amber-900 dark:text-amber-200",
    strong: "border-amber-600 bg-amber-600 dark:border-amber-500 dark:bg-amber-500",
    strongText: "text-white dark:text-amber-950",
  },
  meal: {
    soft: "border-rose-200 bg-rose-100 dark:border-rose-900 dark:bg-rose-950",
    softText: "text-rose-900 dark:text-rose-200",
    strong: "border-rose-600 bg-rose-600 dark:border-rose-500 dark:bg-rose-500",
    strongText: "text-white dark:text-rose-950",
  },
}

export function tagColors(tag: TagKey) {
  return colorClasses[tagGroup(tag)]
}

export { groupTags, tagGroupColors, tagGroupKeys, tagsByGroup }
