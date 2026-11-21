import { router } from "expo-router"
import {
  Camera,
  Clock,
  FileText,
  Globe,
  PenLine,
  Video,
  type LucideIcon,
} from "lucide-react-native"
import { useTranslation } from "react-i18next"
import { Pressable, Text, View } from "react-native"

import type { Recipe } from "@workspace/schemas"

import { TagBadge } from "@/components/tag-badge"
import { cardTags } from "@/lib/recipe-filters"
import { categoryIcons } from "@/components/ui/cozy-icons"
import { Icon } from "@/components/ui/icon"
import { formatMinutes } from "@/lib/format"
import i18n from "@/lib/i18n"
import { useTheme } from "@/lib/theme"
import { cn } from "@/lib/utils"

export const sourceIcons: Record<string, LucideIcon> = {
  manual: PenLine,
  import: FileText,
  video: Video,
  website: Globe,
  photo: Camera,
  text: FileText,
}

const sourceKinds = ["manual", "import", "video", "website", "photo", "text"]

/** The name of a kind of source ("Video", "Website") in the current language. */
const kindName = (kind: string) =>
  i18n.t(`recipes:sources.${sourceKinds.includes(kind) ? kind : "other"}`)

export const sourceName = (recipe: Recipe) =>
  recipe.source.label ?? kindName(recipe.source.kind)

// Written out in full so Tailwind finds every class.
const covers = [
  "bg-tone-peach",
  "bg-tone-butter",
  "bg-tone-sage",
  "bg-tone-sage",
  "bg-tone-sky",
  "bg-tone-rose",
  "bg-tone-peach",
]

function coverFor(id: string) {
  let hash = 0
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return covers[hash % covers.length]!
}

/** Total time, or null when neither prep nor cooking time is known. */
export function totalMinutes(recipe: Recipe) {
  if (recipe.prepMinutes === null && recipe.cookMinutes === null) return null
  return (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0)
}

/** Placeholder cover until recipes have real images. */
export function RecipeCover({
  recipe,
  className,
}: {
  recipe: Pick<Recipe, "id" | "title"> & Partial<Pick<Recipe, "tags">>
  className?: string
}) {
  const { theme } = useTheme()
  // With the cozy icons, a recipe of a known kind (soup, pasta, ...) gets its illustration.
  const category =
    theme.icons === "cozy"
      ? recipe.tags?.find((tag) => categoryIcons[tag])
      : undefined
  return (
    <View
      className={cn("items-center justify-center", coverFor(recipe.id), className)}
    >
      {category ? (
        <Icon
          as={categoryIcons[category]!}
          size={40}
          className="text-foreground/60"
        />
      ) : (
        <Text className="text-4xl font-bold text-foreground/30">
          {recipe.title.charAt(0).toUpperCase()}
        </Text>
      )}
    </View>
  )
}

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  useTranslation()
  const { cardStyle } = useTheme()
  const total = totalMinutes(recipe)
  const { shown, more } = cardTags(recipe.tags)
  return (
    <Pressable
      role="link"
      accessibilityLabel={recipe.title}
      onPress={() => router.push(`/recipe/${recipe.id}`)}
      style={cardStyle}
      className="flex-1 flex-row overflow-hidden rounded-lg border border-border bg-card active:opacity-80 web:hover:border-ring"
    >
      <RecipeCover recipe={recipe} className="w-24" />
      <View className="flex-1 gap-1.5 p-3">
        <Text
          numberOfLines={2}
          className="text-base font-semibold text-foreground"
        >
          {recipe.title}
        </Text>
        <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
          {/* The time is always shown. When the recipe says none, that is said instead of guessed. */}
          <View className="flex-row items-center gap-1">
            <Icon as={Clock} size={14} className="text-foreground" />
            <Text
              className={cn(
                "text-sm",
                total !== null
                  ? "font-medium text-foreground"
                  : "text-muted-foreground"
              )}
            >
              {total !== null
                ? formatMinutes(total)
                : i18n.t("recipes:list.timeUnknown")}
            </Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Icon
              as={sourceIcons[recipe.source.kind] ?? FileText}
              size={14}
              className="text-muted-foreground"
            />
            <Text className="text-sm text-muted-foreground">
              {kindName(recipe.source.kind)}
            </Text>
          </View>
        </View>
        {shown.length > 0 && (
          // Two tags at most keep the cards short; the recipe page shows them all.
          <View className="flex-row flex-wrap items-center gap-1.5">
            {shown.map((tag) => (
              <TagBadge key={tag} tag={tag} />
            ))}
            {more > 0 && (
              <Text className="text-xs text-muted-foreground">
                {i18n.t("recipes:list.moreTags", { count: more })}
              </Text>
            )}
          </View>
        )}
      </View>
    </Pressable>
  )
}
