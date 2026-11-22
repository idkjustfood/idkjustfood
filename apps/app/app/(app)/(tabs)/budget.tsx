import { PiggyBank, Plus } from "lucide-react-native"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Pressable, Text, View } from "react-native"

import {
  monthOf,
  parseCents,
  type BudgetProgress,
} from "@workspace/schemas"

import {
  AmountField,
  categoryName,
  MonthSwitcher,
} from "@/components/money-parts"
import { ProgressBar, StateTag } from "@/components/money-progress"
import { MoneyScreen, type MoneyContext } from "@/components/money-screen"
import { EmptyState } from "@/components/states"
import { Button } from "@/components/ui/button"
import { Chip } from "@/components/ui/chip"
import { Sheet } from "@/components/ui/sheet"
import { amountInputText, formatMoney } from "@/lib/money-format"
import { budgetsForMonth } from "@/lib/money-view"

/**
 * Budget: how much the person wants to spend per month, in total and per category, and how much
 * of it is spent. The spending comes from Expenses: nothing is entered twice.
 */
export default function Budget() {
  const { t } = useTranslation("money")
  const [form, setForm] = useState<{ categoryId: string | null } | "new" | null>(null)
  return (
    <MoneyScreen
      title={t("budget.title")}
      subtitle={t("budget.subtitle")}
      actions={
        <Button size="header" icon={Plus} label={t("budget.add")} onPress={() => setForm("new")} />
      }
    >
      {(context) => <BudgetBody context={context} form={form} setForm={setForm} />}
    </MoneyScreen>
  )
}

function BudgetBody({
  context,
  form,
  setForm,
}: {
  context: MoneyContext
  form: { categoryId: string | null } | "new" | null
  setForm: (form: { categoryId: string | null } | "new" | null) => void
}) {
  const { t } = useTranslation("money")
  const { money, householdId, actions, today } = context
  const [month, setMonth] = useState(() => monthOf(today))
  const rows = budgetsForMonth(money.budgets, money.expenses, month)
  const nameOf = (id: string | null) =>
    id === null
      ? t("budget.total")
      : categoryName(t, money.categories.find((c) => c.id === id))

  return (
    <>
      <MonthSwitcher month={month} onChange={setMonth} />

      {rows.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title={t("budget.empty.title")}
          message={t("budget.empty.message")}
          action={t("budget.add")}
          onAction={() => setForm("new")}
        />
      ) : (
        <View className="gap-3">
          {rows.map((row) => (
            <BudgetCard
              key={row.budgetId}
              row={row}
              name={nameOf(row.categoryId)}
              currency={money.currency}
              onPress={() => setForm({ categoryId: row.categoryId })}
            />
          ))}
        </View>
      )}

      <BudgetForm
        key={form === null ? "closed" : form === "new" ? "new" : (form.categoryId ?? "total")}
        open={form !== null}
        categoryId={form === null || form === "new" ? undefined : form.categoryId}
        context={context}
        onClose={() => setForm(null)}
        onSave={(categoryId, amountCents) => {
          const existing = money.budgets.find((b) => b.categoryId === categoryId)
          actions.setBudget(categoryId, amountCents, householdId, existing?.id)
          setForm(null)
        }}
        onDelete={(budgetId) => {
          actions.removeBudget(budgetId)
          setForm(null)
        }}
      />
    </>
  )
}

function BudgetCard({
  row,
  name,
  currency,
  onPress,
}: {
  row: BudgetProgress
  name: string
  currency: Parameters<typeof formatMoney>[1]
  onPress: () => void
}) {
  const { t } = useTranslation("money")
  const percent = Math.round(row.share * 100)
  return (
    <Pressable
      role="button"
      accessibilityLabel={t("budget.edit", { name })}
      onPress={onPress}
      className="gap-2 rounded-lg border border-border bg-card p-4 active:bg-accent"
    >
      <View className="flex-row items-center justify-between gap-3">
        <Text className="flex-1 text-base font-semibold text-foreground">{name}</Text>
        <StateTag
          label={t(`budget.state.${row.state}`)}
          tone={row.state === "ok" ? "ok" : row.state === "nearly" ? "warning" : "danger"}
        />
      </View>
      <ProgressBar
        share={row.share}
        tone={row.state === "over" ? "danger" : row.state === "nearly" ? "warning" : "primary"}
        label={t("budget.percent", { percent })}
      />
      <View className="flex-row justify-between gap-3">
        <Text className="text-sm text-muted-foreground">
          {t("budget.spentOf", {
            spent: formatMoney(row.spentCents, currency),
            budget: formatMoney(row.budgetCents, currency),
          })}
        </Text>
        <Text className="text-sm font-medium text-foreground">
          {row.leftCents >= 0
            ? t("budget.left", { amount: formatMoney(row.leftCents, currency) })
            : t("budget.overBy", { amount: formatMoney(-row.leftCents, currency) })}
        </Text>
      </View>
    </Pressable>
  )
}

function BudgetForm({
  open,
  categoryId: initial,
  context,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean
  /** The budget being changed: a category id, null for the total, undefined for a new one. */
  categoryId: string | null | undefined
  context: MoneyContext
  onClose: () => void
  onSave: (categoryId: string | null, amountCents: number) => void
  onDelete: (budgetId: string) => void
}) {
  const { t } = useTranslation("money")
  const { money } = context
  const existing =
    initial === undefined ? undefined : money.budgets.find((b) => b.categoryId === initial)
  const [categoryId, setCategoryId] = useState<string | null>(initial ?? null)
  const current = money.budgets.find((b) => b.categoryId === categoryId)
  const [amount, setAmount] = useState(existing ? amountInputText(existing.amountCents) : "")
  const cents = parseCents(amount)
  const valid = cents !== null && cents > 0
  const save = () => {
    if (valid) onSave(categoryId, cents)
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={existing ? t("budget.form.editTitle") : t("budget.form.newTitle")}
    >
      {!existing && (
        <View className="gap-2">
          <Text className="text-sm font-medium text-foreground">
            {t("budget.form.for")}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <Chip
              label={t("budget.total")}
              selected={categoryId === null}
              onPress={() => setCategoryId(null)}
            />
            {money.categories.map((category) => (
              <Chip
                key={category.id}
                label={categoryName(t, category)}
                selected={categoryId === category.id}
                onPress={() => setCategoryId(category.id)}
              />
            ))}
          </View>
          {current && (
            <Text className="text-sm text-muted-foreground">
              {t("budget.form.alreadySet", {
                amount: formatMoney(current.amountCents, money.currency),
              })}
            </Text>
          )}
        </View>
      )}
      <AmountField
        label={t("budget.form.perMonth", { currency: money.currency })}
        value={amount}
        onChange={setAmount}
        autoFocus
        onSubmit={save}
      />
      <Text className="text-sm text-muted-foreground">{t("budget.form.hint")}</Text>
      <View className="flex-row gap-3">
        {existing && (
          <Button
            variant="outline"
            label={t("form.delete")}
            className="flex-1"
            onPress={() => onDelete(existing.id)}
          />
        )}
        <Button
          label={t("form.save")}
          className="flex-1"
          disabled={!valid}
          onPress={save}
        />
      </View>
    </Sheet>
  )
}
