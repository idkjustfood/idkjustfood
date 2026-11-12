import { router } from "expo-router"
import {
  Camera,
  Clock,
  FileText,
  Globe,
  Video,
  type LucideIcon,
} from "lucide-react-native"
import { Pressable, Text, View } from "react-native"

import { Icon } from "@/components/ui/icon"
import { formatMinutes } from "@/lib/format"
import type { Recipe, SourceKind } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

export const sourceIcons: Record<SourceKind, LucideIcon> = {
  video: Video,
  website: Globe,
  photo: Camera,
  text: FileText,
}

/** Placeholder cover until recipes have real images. */
export function RecipeCover({
  recipe,
  className,
}: {
  recipe: Recipe
  className?: string
}) {
  return (
    <View
      className={cn("items-center justify-center", recipe.cover, className)}
    >
      <Text className="text-4xl font-bold text-foreground/30">
        {recipe.title.charAt(0)}
      </Text>
    </View>
  )
}

export function RecipeCard({ recipe }: { recipe: Recipe }) {
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
          <View className="flex-row items-center gap-1">
            <Icon as={Clock} size={14} className="text-muted-foreground" />
            <Text className="text-sm text-muted-foreground">
              {formatMinutes(recipe.prepMinutes + recipe.cookMinutes)}
            </Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Icon
              as={sourceIcons[recipe.source.kind]}
              size={14}
              className="text-muted-foreground"
            />
            <Text className="text-sm capitalize text-muted-foreground">
              {recipe.source.kind}
            </Text>
          </View>
        </View>
        <Text numberOfLines={1} className="text-sm text-muted-foreground">
          {recipe.tags.join(" · ")}
        </Text>
      </View>
    </Pressable>
  )
}
