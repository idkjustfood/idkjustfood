import { useTranslation } from "react-i18next"
import { Text, View } from "react-native"

import { tagGroupKeys, tagsByGroup, type TagKey } from "@workspace/schemas"

import { TagChip } from "@/components/tag-badge"
import { tagGroupName } from "@/lib/tags"

/**
 * Choose the tags of a recipe from the fixed list, grouped. There is no way to
 * type a new tag. The tags stay in the order of the list.
 */
export function TagPicker({
  value,
  onChange,
}: {
  value: TagKey[]
  onChange: (tags: TagKey[]) => void
}) {
  const { t } = useTranslation()

  function toggle(tag: TagKey) {
    onChange(value.includes(tag) ? value.filter((x) => x !== tag) : [...value, tag])
  }

  return (
    <View className="gap-3">
      <View className="gap-1">
        <Text className="text-sm font-medium text-foreground">
          {t("recipes:form.tags")}
        </Text>
        <Text className="text-sm text-muted-foreground">
          {t("recipes:form.tagsHelp")}
        </Text>
      </View>
      {tagGroupKeys.map((group) => (
        <View key={group} className="gap-2">
          <Text className="text-xs font-medium uppercase text-muted-foreground">
            {tagGroupName(group)}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {(tagsByGroup[group] as readonly TagKey[]).map((tag) => (
              <TagChip
                key={tag}
                tag={tag}
                selected={value.includes(tag)}
                onPress={() => toggle(tag)}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  )
}
