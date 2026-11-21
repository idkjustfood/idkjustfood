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
 * The classes of a group's color: one of the theme's pastel tones, so tags follow
 * the theme. Written out in full (not built from the name) so Tailwind sees every class. `soft` is a quiet badge, `strong` the
 * filled look of a chosen tag.
 */
const colorClasses: Record<
  TagGroup,
  { soft: string; softText: string; strong: string; strongText: string }
> = {
  cuisine: {
    soft: "border-tone-peach-foreground/20 bg-tone-peach",
    softText: "text-tone-peach-foreground",
    strong: "border-tone-peach-foreground bg-tone-peach-foreground",
    strongText: "text-tone-peach",
  },
  dish: {
    soft: "border-tone-sky-foreground/20 bg-tone-sky",
    softText: "text-tone-sky-foreground",
    strong: "border-tone-sky-foreground bg-tone-sky-foreground",
    strongText: "text-tone-sky",
  },
  diet: {
    soft: "border-tone-sage-foreground/20 bg-tone-sage",
    softText: "text-tone-sage-foreground",
    strong: "border-tone-sage-foreground bg-tone-sage-foreground",
    strongText: "text-tone-sage",
  },
  nutrition: {
    soft: "border-tone-lavender-foreground/20 bg-tone-lavender",
    softText: "text-tone-lavender-foreground",
    strong: "border-tone-lavender-foreground bg-tone-lavender-foreground",
    strongText: "text-tone-lavender",
  },
  time: {
    soft: "border-tone-butter-foreground/20 bg-tone-butter",
    softText: "text-tone-butter-foreground",
    strong: "border-tone-butter-foreground bg-tone-butter-foreground",
    strongText: "text-tone-butter",
  },
  meal: {
    soft: "border-tone-rose-foreground/20 bg-tone-rose",
    softText: "text-tone-rose-foreground",
    strong: "border-tone-rose-foreground bg-tone-rose-foreground",
    strongText: "text-tone-rose",
  },
}

export function tagColors(tag: TagKey) {
  return colorClasses[tagGroup(tag)]
}

export { groupTags, tagGroupColors, tagGroupKeys, tagsByGroup }
