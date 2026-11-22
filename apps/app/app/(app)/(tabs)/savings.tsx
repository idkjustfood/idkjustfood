import { Plus, Target, Trash2 } from "lucide-react-native"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Pressable, Text, View } from "react-native"

import {
  monthlySavingsNeeded,
  parseCents,
  savingsProgress,
  todayString,
  type SavingsGoal,
} from "@workspace/schemas"

import { AmountField, DayField } from "@/components/money-parts"
import { ProgressBar, StateTag } from "@/components/money-progress"
import { MoneyScreen, type MoneyContext } from "@/components/money-screen"
import { EmptyState } from "@/components/states"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { Sheet } from "@/components/ui/sheet"
import { amountInputText, formatMoney, shortDay } from "@/lib/money-format"

/**
 * Savings: goals with a target amount and an optional day. Money is put into a goal or taken out
 * of it, and the screen shows the progress and how much to put aside each month.
 */
export default function Savings() {
  const { t } = useTranslation("money")
  const [form, setForm] = useState<SavingsGoal | "new" | null>(null)
  const [detail, setDetail] = useState<string | null>(null)
  return (
    <MoneyScreen
      title={t("savings.title")}
      subtitle={t("savings.subtitle")}
      actions={
        <Button size="sm" icon={Plus} label={t("savings.add")} onPress={() => setForm("new")} />
      }
    >
      {(context) => (
        <SavingsBody
          context={context}
          form={form}
          setForm={setForm}
          detail={detail}
          setDetail={setDetail}
        />
      )}
    </MoneyScreen>
  )
}

function SavingsBody({
  context,
  form,
  setForm,
  detail,
  setDetail,
}: {
  context: MoneyContext
  form: SavingsGoal | "new" | null
  setForm: (form: SavingsGoal | "new" | null) => void
  detail: string | null
  setDetail: (id: string | null) => void
}) {
  const { t } = useTranslation("money")
  const { money, householdId, actions, today } = context
  const open = money.goals.find((g) => g.id === detail)

  return (
    <>
      {money.goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title={t("savings.empty.title")}
          message={t("savings.empty.message")}
          action={t("savings.add")}
          onAction={() => setForm("new")}
        />
      ) : (
        <View className="gap-3">
          {money.goals.map((goal) => {
            const progress = savingsProgress(goal, money.savingsEntries)
            const monthly = monthlySavingsNeeded(goal, progress, today)
            return (
              <Pressable
                key={goal.id}
                role="button"
                accessibilityLabel={t("savings.open", { name: goal.name })}
                onPress={() => setDetail(goal.id)}
                className="gap-2 rounded-lg border border-border bg-card p-4 active:bg-accent"
              >
                <View className="flex-row items-center justify-between gap-3">
                  <Text className="flex-1 text-base font-semibold text-foreground">
                    {goal.name}
                  </Text>
                  {progress.reached && <StateTag label={t("savings.reached")} tone="ok" />}
                </View>
                <ProgressBar
                  share={progress.share}
                  label={t("savings.percent", { percent: Math.round(progress.share * 100) })}
                />
                <Text className="text-sm text-foreground">
                  {t("savings.savedOf", {
                    saved: formatMoney(progress.savedCents, money.currency),
                    target: formatMoney(goal.targetCents, money.currency),
                  })}
                </Text>
                {goal.targetDate && (
                  <Text className="text-sm text-muted-foreground">
                    {monthly !== null
                      ? t("savings.perMonth", {
                          amount: formatMoney(monthly, money.currency),
                          day: shortDay(goal.targetDate),
                        })
                      : progress.reached
                        ? t("savings.byDay", { day: shortDay(goal.targetDate) })
                        : t("savings.dayPassed", { day: shortDay(goal.targetDate) })}
                  </Text>
                )}
              </Pressable>
            )
          })}
        </View>
      )}

      <GoalDetail
        key={detail ?? "closed"}
        goal={open}
        context={context}
        onClose={() => setDetail(null)}
        onEdit={() => {
          if (open) setForm(open)
        }}
      />
      <GoalForm
        key={form === null ? "closed" : form === "new" ? "new" : form.id}
        goal={form === null || form === "new" ? null : form}
        open={form !== null}
        currency={money.currency}
        onClose={() => setForm(null)}
        onSave={(values) => {
          if (form && form !== "new") actions.editGoal(form.id, values)
          else actions.addGoal(values, householdId)
          setForm(null)
        }}
        onDelete={() => {
          if (form && form !== "new") {
            actions.removeGoal(form.id)
            setDetail(null)
          }
          setForm(null)
        }}
      />
    </>
  )
}

/** One goal: put money in, take money out, and the history. */
function GoalDetail({
  goal,
  context,
  onClose,
  onEdit,
}: {
  goal: SavingsGoal | undefined
  context: MoneyContext
  onClose: () => void
  onEdit: () => void
}) {
  const { t } = useTranslation("money")
  const { money, actions } = context
  const [amount, setAmount] = useState("")
  const cents = parseCents(amount)
  const valid = cents !== null && cents > 0
  const history = goal
    ? money.savingsEntries
        .filter((e) => e.goalId === goal.id)
        .sort((a, b) => b.date.localeCompare(a.date))
    : []
  const progress = goal ? savingsProgress(goal, money.savingsEntries) : null
  const move = (sign: 1 | -1) => {
    if (!goal || !valid) return
    actions.saveToGoal(goal.id, sign * cents, todayString())
    setAmount("")
  }

  return (
    <Sheet open={!!goal} onClose={onClose} title={goal?.name ?? ""}>
      {goal && progress && (
        <>
          <Text className="text-base text-foreground">
            {t("savings.savedOf", {
              saved: formatMoney(progress.savedCents, money.currency),
              target: formatMoney(goal.targetCents, money.currency),
            })}
          </Text>
          <AmountField
            label={t("amountIn", { currency: money.currency })}
            value={amount}
            onChange={setAmount}
            onSubmit={() => move(1)}
          />
          <View className="flex-row gap-3">
            <Button
              variant="outline"
              label={t("savings.takeOut")}
              className="flex-1"
              disabled={!valid}
              onPress={() => move(-1)}
            />
            <Button
              label={t("savings.putIn")}
              className="flex-1"
              disabled={!valid}
              onPress={() => move(1)}
            />
          </View>
          <View className="gap-2">
            <Text className="text-sm font-medium text-foreground">
              {t("savings.history")}
            </Text>
            {history.length === 0 ? (
              <Text className="text-muted-foreground">{t("savings.noHistory")}</Text>
            ) : (
              history.map((entry) => (
                <View
                  key={entry.id}
                  className="min-h-12 flex-row items-center gap-2 rounded-md border border-border bg-card pl-4"
                >
                  <Text className="flex-1 text-base text-foreground">
                    {entry.amountCents > 0
                      ? t("savings.putInEntry", { amount: formatMoney(entry.amountCents, money.currency) })
                      : t("savings.takeOutEntry", { amount: formatMoney(-entry.amountCents, money.currency) })}
                  </Text>
                  <Text className="text-sm text-muted-foreground">{shortDay(entry.date)}</Text>
                  <Pressable
                    role="button"
                    accessibilityLabel={t("savings.deleteEntry")}
                    onPress={() => actions.removeSavings(entry.id)}
                    className="h-12 w-12 items-center justify-center active:bg-accent"
                  >
                    <Icon as={Trash2} className="text-destructive" />
                  </Pressable>
                </View>
              ))
            )}
          </View>
          <Button variant="outline" label={t("savings.editGoal")} onPress={onEdit} />
        </>
      )}
    </Sheet>
  )
}

type Values = { name: string; targetCents: number; targetDate: string | null }

function GoalForm({
  goal,
  open,
  currency,
  onClose,
  onSave,
  onDelete,
}: {
  goal: SavingsGoal | null
  open: boolean
  currency: string
  onClose: () => void
  onSave: (values: Values) => void
  onDelete: () => void
}) {
  const { t } = useTranslation("money")
  const [name, setName] = useState(goal?.name ?? "")
  const [target, setTarget] = useState(goal ? amountInputText(goal.targetCents) : "")
  const [targetDate, setTargetDate] = useState<string | null>(goal?.targetDate ?? null)
  const cents = parseCents(target)
  const valid = name.trim() !== "" && cents !== null && cents > 0
  const save = () => {
    if (valid) onSave({ name: name.trim(), targetCents: cents, targetDate })
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={goal ? t("savings.form.editTitle") : t("savings.form.newTitle")}
    >
      <Input
        label={t("savings.form.name")}
        value={name}
        onChangeText={setName}
        placeholder={t("savings.form.placeholder")}
        maxLength={200}
        autoFocus={!goal}
      />
      <AmountField
        label={t("savings.form.target", { currency })}
        value={target}
        onChange={setTarget}
        onSubmit={save}
      />
      {targetDate === null ? (
        <Button
          variant="outline"
          label={t("savings.form.addDay")}
          onPress={() => setTargetDate(todayString())}
        />
      ) : (
        <View className="gap-2">
          <DayField label={t("savings.form.day")} date={targetDate} onChange={setTargetDate} />
          <Button
            variant="ghost"
            label={t("savings.form.noDay")}
            onPress={() => setTargetDate(null)}
          />
        </View>
      )}
      <View className="flex-row gap-3">
        {goal && (
          <Button
            variant="outline"
            label={t("form.delete")}
            className="flex-1"
            onPress={onDelete}
          />
        )}
        <Button
          label={goal ? t("form.save") : t("savings.form.create")}
          className="flex-1"
          disabled={!valid}
          onPress={save}
        />
      </View>
    </Sheet>
  )
}
