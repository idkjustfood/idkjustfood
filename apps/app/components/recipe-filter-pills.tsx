import { ChevronDown } from "lucide-react-native"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Pressable, ScrollView, Text, View } from "react-native"

import {
  tagGroupKeys,
  tagsByGroup,
  type TagGroup,
  type TagKey,
} from "@workspace/schemas"

import { TagChip } from "@/components/tag-badge"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { SearchField } from "@/components/ui/search-field"
import { Sheet } from "@/components/ui/sheet"
import { tagGroupName, tagName } from "@/lib/tags"
import { cn } from "@/lib/utils"

/** Lists longer than this get a search field in their picker. */
const SEARCH_FROM = 8

/**
 * One scrolling row of pills, one per group of tags except the meal (which has
 * its own tabs): Cuisine, Diet, Time, ... A pill opens a picker for its group
 * and shows the choice once there is one. Only tags some recipe has are offered.
 */
export function RecipeFilterPills({
  available,
  value,
  onChange,
  resultCount,
}: {
  available: TagKey[]
  value: TagKey[]
  onChange: (tags: TagKey[]) => void
  resultCount: number
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState<TagGroup | null>(null)
  const [search, setSearch] = useState("")

  const groups = tagGroupKeys
    .filter((group) => group !== "meal")
    .map((group) => ({
      group,
      tags: (tagsByGroup[group] as readonly TagKey[]).filter((tag) =>
        available.includes(tag)
      ),
    }))
    .filter((entry) => entry.tags.length > 0)

  if (groups.length === 0) return null

  const current = groups.find((entry) => entry.group === open)
  const word = search.trim().toLowerCase()
  const listed = (current?.tags ?? []).filter(
    (tag) => !word || tagName(tag).toLowerCase().includes(word)
  )

  function close() {
    setOpen(null)
    setSearch("")
  }

  function toggle(tag: TagKey) {
    onChange(
      value.includes(tag) ? value.filter((x) => x !== tag) : [...value, tag]
    )
  }

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2 px-4"
        className="-mx-4"
      >
        {groups.map(({ group, tags }) => {
          const chosen = tags.filter((tag) => value.includes(tag))
          const label =
            chosen.length === 0
              ? tagGroupName(group)
              : chosen.length === 1
                ? tagName(chosen[0]!)
                : `${tagName(chosen[0]!)} ${t("recipes:list.moreTags", { count: chosen.length - 1 })}`
          return (
            <Pressable
              key={group}
              role="button"
              accessibilityLabel={tagGroupName(group)}
              aria-expanded={open === group}
              onPress={() => setOpen(group)}
              className={cn(
                "h-10 flex-row items-center gap-1 rounded-full border pl-4 pr-3 active:opacity-80",
                chosen.length > 0
                  ? "border-primary bg-primary"
                  : "border-border bg-background"
              )}
            >
              <Text
                className={cn(
                  "text-sm font-medium",
                  chosen.length > 0
                    ? "text-primary-foreground"
                    : "text-foreground"
                )}
              >
                {label}
              </Text>
              <Icon
                as={ChevronDown}
                size={16}
                className={
                  chosen.length > 0
                    ? "text-primary-foreground"
                    : "text-muted-foreground"
                }
              />
            </Pressable>
          )
        })}
        {value.length > 0 && (
          <Pressable
            role="button"
            onPress={() => onChange([])}
            className="h-10 justify-center rounded-full px-3 active:opacity-80"
          >
            <Text className="text-sm font-medium text-muted-foreground">
              {t("recipes:list.reset")}
            </Text>
          </Pressable>
        )}
      </ScrollView>

      <Sheet
        open={open !== null}
        onClose={close}
        title={open ? tagGroupName(open) : ""}
      >
        {current && current.tags.length >= SEARCH_FROM && (
          <SearchField
            value={search}
            onChangeText={setSearch}
            placeholder={t("recipes:list.filterSearch")}
          />
        )}
        <ScrollView className="max-h-80">
          <View className="flex-row flex-wrap gap-2">
            {listed.map((tag) => (
              <TagChip
                key={tag}
                tag={tag}
                selected={value.includes(tag)}
                onPress={() => toggle(tag)}
              />
            ))}
          </View>
        </ScrollView>
        <View className="flex-row gap-3">
          {current?.tags.some((tag) => value.includes(tag)) && (
            <Button
              variant="outline"
              label={t("recipes:list.filtersClear")}
              onPress={() =>
                onChange(value.filter((tag) => !current.tags.includes(tag)))
              }
            />
          )}
          <Button
            className="flex-1"
            label={t("recipes:list.filtersShow", { count: resultCount })}
            onPress={close}
          />
        </View>
      </Sheet>
    </>
  )
}
