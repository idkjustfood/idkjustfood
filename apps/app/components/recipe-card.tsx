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
import { Pressable, Text, View } from "react-native"

import type { Recipe } from "@workspace/schemas"

import { Icon } from "@/components/ui/icon"
import { formatMinutes } from "@/lib/format"
import { cn } from "@/lib/utils"

export const sourceIcons: Record<string, LucideIcon> = {
  manual: PenLine,
  import: FileText,
  video: Video,
  website: Globe,
  photo: Camera,
  text: FileText,
}

const sourceNames: Record<string, string> = {
  manual: "Written by hand",
  import: "Imported",
  video: "Video",
  website: "Website",
  photo: "Photo",
  text: "Pasted text",
}

export const sourceName = (recipe: Recipe) =>
  recipe.source.label ?? sourceNames[recipe.source.kind] ?? "Recipe"

// Written out in full so Tailwind finds every class.
const covers = [
  "bg-amber-200 dark:bg-amber-900",
  "bg-yellow-200 dark:bg-yellow-900",
  "bg-lime-200 dark:bg-lime-900",
  "bg-emerald-200 dark:bg-emerald-900",
  "bg-sky-200 dark:bg-sky-900",
  "bg-rose-200 dark:bg-rose-900",
  "bg-orange-200 dark:bg-orange-900",
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
  recipe: Pick<Recipe, "id" | "title">
  className?: string
}) {
  return (
    <View
      className={cn("items-center justify-center", coverFor(recipe.id), className)}
    >
      <Text className="text-4xl font-bold text-foreground/30">
        {recipe.title.charAt(0).toUpperCase()}
      </Text>
    </View>
  )
}

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  const total = totalMinutes(recipe)
  return (
    <Pressable
      role="link"
      accessibilityLabel={recipe.title}
      onPress={() => router.push(`/recipe/${recipe.id}`)}
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
        <View className="flex-row items-center gap-3">
          {total !== null && (
            <View className="flex-row items-center gap-1">
              <Icon as={Clock} size={14} className="text-muted-foreground" />
              <Text className="text-sm text-muted-foreground">
                {formatMinutes(total)}
              </Text>
            </View>
          )}
          <View className="flex-row items-center gap-1">
            <Icon
              as={sourceIcons[recipe.source.kind] ?? FileText}
              size={14}
              className="text-muted-foreground"
            />
            <Text className="text-sm text-muted-foreground">
              {sourceNames[recipe.source.kind] ?? "Recipe"}
            </Text>
          </View>
        </View>
        {recipe.tags.length > 0 && (
          <Text numberOfLines={1} className="text-sm text-muted-foreground">
            {recipe.tags.join(" · ")}
          </Text>
        )}
      </View>
    </Pressable>
  )
}
