import { useTranslation } from "react-i18next"
import { Text, View } from "react-native"

import { tagGroupKeys, tagsByGroup, type TagKey } from "@workspace/schemas"

import { TagChip } from "@/components/tag-badge"
import { Button } from "@/components/ui/button"
import { Sheet } from "@/components/ui/sheet"
import { tagGroupName } from "@/lib/tags"

/**
 * The filters besides the meal: cuisine, dish, diet, nutrition and time, as
 * wrapping chips under headings. Only tags that some recipe has are offered.
 */
export function RecipeFilterSheet({
  open,
  onClose,
  available,
  value,
  onChange,
  resultCount,
}: {
  open: boolean
  onClose: () => void
  available: TagKey[]
  value: TagKey[]
  onChange: (tags: TagKey[]) => void
  resultCount: number
}) {
  const { t } = useTranslation()
  const groups = tagGroupKeys
    .filter((group) => group !== "meal")
    .map((group) => ({
      group,
      tags: (tagsByGroup[group] as readonly TagKey[]).filter((tag) =>
        available.includes(tag)
      ),
    }))
    .filter((entry) => entry.tags.length > 0)

  return (
    <Sheet open={open} onClose={onClose} title={t("recipes:list.filtersTitle")}>
      {groups.length === 0 && (
        <Text className="text-sm text-muted-foreground">
          {t("recipes:list.filtersEmpty")}
        </Text>
      )}
      {groups.map(({ group, tags }) => (
        <View key={group} className="gap-2">
          <Text className="text-xs font-medium uppercase text-muted-foreground">
            {tagGroupName(group)}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {tags.map((tag) => (
              <TagChip
                key={tag}
                tag={tag}
                selected={value.includes(tag)}
                onPress={() =>
                  onChange(
                    value.includes(tag)
                      ? value.filter((x) => x !== tag)
                      : [...value, tag]
                  )
                }
              />
            ))}
          </View>
        </View>
      ))}
      <View className="flex-row gap-3">
        {value.length > 0 && (
          <Button
            variant="outline"
            label={t("recipes:list.filtersClear")}
            onPress={() => onChange([])}
          />
        )}
        <Button
          className="flex-1"
          label={t("recipes:list.filtersShow", { count: resultCount })}
          onPress={onClose}
        />
      </View>
    </Sheet>
  )
}
