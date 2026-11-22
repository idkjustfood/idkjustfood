import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Text, View } from "react-native"

import type { ExpenseSplit } from "@workspace/schemas"

import { Chip } from "@/components/ui/chip"
import { Input } from "@/components/ui/input"
import {
  modeOf,
  parsePercent,
  percentsOf,
  percentsValid,
  splitFor,
  type SplitMode,
} from "@/lib/expense-split"

type Member = { id: string; name: string }

/**
 * Who paid and how it is shared, for an expense or a bill in a household. Holds the choices and
 * returns what to save: `paidBy`, the `split` (null is equally) and whether the input is usable.
 */
export function useShare(
  members: readonly Member[],
  initial: { paidBy: string; split: ExpenseSplit | null }
) {
  const ids = members.map((m) => m.id)
  const [paidBy, setPaidBy] = useState(initial.paidBy)
  const [mode, setMode] = useState<SplitMode>(
    modeOf(initial.split, initial.paidBy, ids)
  )
  // What the person typed. Members can arrive after the form opened, so the rest starts from the saved split.
  const [typed, setTexts] = useState<Record<string, string>>({})
  const start = percentsOf(initial.split, ids)
  const texts = Object.fromEntries(
    ids.map((id) => [id, typed[id] ?? String(start[id])])
  )
  const percents = Object.fromEntries(
    ids.map((id) => [id, parsePercent(texts[id]!)])
  )
  const valid = mode !== "custom" || percentsValid(percents)
  return {
    members,
    paidBy,
    setPaidBy,
    mode,
    setMode,
    texts,
    setTexts,
    total: Object.values(percents).reduce(
      (a, b) => a + (Number.isNaN(b) ? 0 : b),
      0
    ),
    valid,
    /** The split to save. Only meaningful when `valid`. */
    split: splitFor(mode, paidBy, ids, percents),
  }
}

export type Share = ReturnType<typeof useShare>

const modes: SplitMode[] = ["equal", "alone", "others", "custom"]

export function ShareFields({ share }: { share: Share }) {
  const { t } = useTranslation("money")
  const { members, paidBy, mode } = share
  if (members.length === 0) return null
  return (
    <>
      <View className="gap-2">
        <Text className="text-sm font-medium text-foreground">
          {t("expenses.form.paidBy")}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {members.map((member) => (
            <Chip
              key={member.id}
              label={member.name}
              selected={paidBy === member.id}
              onPress={() => share.setPaidBy(member.id)}
            />
          ))}
        </View>
      </View>
      <View className="gap-2">
        <Text className="text-sm font-medium text-foreground">
          {t("expenses.form.sharing")}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {modes.map((m) => (
            <Chip
              key={m}
              label={t(`expenses.form.mode.${m}`)}
              selected={mode === m}
              onPress={() => share.setMode(m)}
            />
          ))}
        </View>
        <Text className="text-sm text-muted-foreground">
          {t(`expenses.form.modeHint.${mode}`)}
        </Text>
      </View>
      {mode === "custom" && (
        <View className="gap-2">
          {members.map((member) => (
            <Input
              key={member.id}
              label={t("expenses.form.percentFor", { name: member.name })}
              value={share.texts[member.id] ?? ""}
              onChangeText={(text) =>
                share.setTexts((all) => ({ ...all, [member.id]: text }))
              }
              keyboardType="number-pad"
              inputMode="numeric"
              maxLength={3}
            />
          ))}
          <Text
            className={
              share.valid
                ? "text-sm text-muted-foreground"
                : "text-sm text-destructive"
            }
          >
            {t("expenses.form.percentTotal", { total: share.total })}
          </Text>
        </View>
      )}
    </>
  )
}
