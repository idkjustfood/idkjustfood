import { Plus, Receipt, Settings } from "lucide-react-native"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Pressable, Text, View } from "react-native"

import {
  balances,
  monthOf,
  parseCents,
  settleUp,
  spendingByCategory,
  sumCents,
  todayString,
  type Currency,
  type Expense,
  type ExpenseSplit,
} from "@workspace/schemas"

import {
  AmountField,
  CategoryField,
  categoryName,
  DayField,
  MonthSwitcher,
} from "@/components/money-parts"
import { MoneyScreen, type MoneyContext } from "@/components/money-screen"
import { MoneySettingsSheet } from "@/components/money-settings-sheet"
import { ShareFields, useShare } from "@/components/share-fields"
import { EmptyState } from "@/components/states"
import { Button } from "@/components/ui/button"
import { Chip } from "@/components/ui/chip"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { SearchField } from "@/components/ui/search-field"
import { Sheet } from "@/components/ui/sheet"
import { useMembers } from "@/lib/households"
import { amountInputText, formatMoney, shortDay } from "@/lib/money-format"
import { filterExpenses } from "@/lib/money-view"
import { cn } from "@/lib/utils"

/**
 * Expenses: what was spent this month, by category, with a list to search, change and delete. In a
 * household it also says who paid and who owes whom.
 */
export default function Expenses() {
  const { t } = useTranslation("money")
  const [form, setForm] = useState<Expense | "new" | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <MoneyScreen
      title={t("expenses.title")}
      subtitle={t("expenses.subtitle")}
      actions={
        <View className="flex-row gap-2">
          <Pressable
            role="button"
            accessibilityLabel={t("settings.title")}
            onPress={() => setSettingsOpen(true)}
            className="h-10 w-10 items-center justify-center rounded-md border border-border bg-card active:bg-accent"
          >
            <Icon as={Settings} className="text-foreground" />
          </Pressable>
          <Button
            size="sm"
            icon={Plus}
            label={t("expenses.add")}
            onPress={() => setForm("new")}
          />
        </View>
      }
    >
      {(context) => (
        <ExpensesBody
          context={context}
          form={form}
          setForm={setForm}
          settingsOpen={settingsOpen}
          setSettingsOpen={setSettingsOpen}
        />
      )}
    </MoneyScreen>
  )
}

function ExpensesBody({
  context,
  form,
  setForm,
  settingsOpen,
  setSettingsOpen,
}: {
  context: MoneyContext
  form: Expense | "new" | null
  setForm: (form: Expense | "new" | null) => void
  settingsOpen: boolean
  setSettingsOpen: (open: boolean) => void
}) {
  const { t } = useTranslation("money")
  const { money, householdId, actions, today } = context
  const [month, setMonth] = useState(() => monthOf(today))
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const { data: members = [] } = useMembers(householdId ?? undefined)

  const inMonth = useMemo(
    () => filterExpenses(money.expenses, { month, categoryId: null, search: "" }),
    [money.expenses, month]
  )
  const shown = useMemo(
    () => filterExpenses(money.expenses, { month, categoryId, search }),
    [money.expenses, month, categoryId, search]
  )
  const byCategory = spendingByCategory(inMonth)
  const nameOf = (id: string | null) =>
    categoryName(t, money.categories.find((c) => c.id === id))
  const memberName = (userId: string) =>
    members.find((m) => m.userId === userId)?.name ?? t("expenses.someone")

  const memberIds = members.map((m) => m.userId)
  const owes = householdId
    ? settleUp(balances(money.expenses, memberIds))
    : []

  return (
    <>
      <MonthSwitcher month={month} onChange={setMonth} />

      <View className="gap-3 rounded-lg border border-border bg-card p-4">
        <Text className="text-sm text-muted-foreground">{t("expenses.spent")}</Text>
        <Text
          role="heading"
          className="text-3xl font-semibold text-foreground"
          accessibilityLabel={t("expenses.spentTotal", {
            amount: formatMoney(sumCents(inMonth), money.currency),
          })}
        >
          {formatMoney(sumCents(inMonth), money.currency)}
        </Text>
        {byCategory.length > 0 && (
          <View className="gap-1.5">
            {byCategory.map(({ categoryId: id, cents }) => (
              <View key={id ?? "none"} className="flex-row justify-between gap-3">
                <Text className="flex-1 text-sm text-foreground">{nameOf(id)}</Text>
                <Text className="text-sm text-muted-foreground">
                  {formatMoney(cents, money.currency)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {householdId && (
        <View className="gap-2 rounded-lg border border-border bg-card p-4">
          <Text className="text-base font-semibold text-foreground">
            {t("expenses.whoOwes")}
          </Text>
          {owes.length === 0 ? (
            <Text className="text-muted-foreground">{t("expenses.allEven")}</Text>
          ) : (
            owes.map((payment) => (
              <Text
                key={`${payment.from}-${payment.to}`}
                className="text-foreground"
              >
                {t("expenses.owes", {
                  from: memberName(payment.from),
                  to: memberName(payment.to),
                  amount: formatMoney(payment.cents, money.currency),
                })}
              </Text>
            ))
          )}
          <Text className="text-sm text-muted-foreground">
            {t("expenses.splitNote")}
          </Text>
        </View>
      )}

      <SearchField
        value={search}
        onChangeText={setSearch}
        placeholder={t("expenses.search")}
      />
      <View className="flex-row flex-wrap gap-2">
        <Chip
          label={t("expenses.allCategories")}
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
        <Chip
          label={t("uncategorized")}
          selected={categoryId === "none"}
          onPress={() => setCategoryId("none")}
        />
      </View>

      {shown.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={t("expenses.empty.title")}
          message={
            inMonth.length === 0
              ? t("expenses.empty.message")
              : t("expenses.empty.filtered")
          }
          action={inMonth.length === 0 ? t("expenses.add") : undefined}
          onAction={() => setForm("new")}
        />
      ) : (
        <View className="gap-2">
          {shown.map((expense) => (
            <Pressable
              key={expense.id}
              role="button"
              accessibilityLabel={t("expenses.edit", {
                name: expense.note || nameOf(expense.categoryId),
              })}
              onPress={() => setForm(expense)}
              className="min-h-16 flex-row items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 active:bg-accent"
            >
              <View className="flex-1 gap-0.5">
                <Text className="text-base text-foreground">
                  {expense.note || nameOf(expense.categoryId)}
                </Text>
                <Text className="text-sm text-muted-foreground">
                  {[
                    shortDay(expense.date),
                    expense.note ? nameOf(expense.categoryId) : null,
                    householdId ? memberName(expense.paidBy) : null,
                    householdId && expense.split
                      ? t("expenses.sharedList", {
                          names: Object.entries(expense.split)
                            .map(([id, p]) => `${memberName(id)} ${p}%`)
                            .join(", "),
                        })
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
              <Text className="text-base font-semibold text-foreground">
                {formatMoney(expense.amountCents, money.currency)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <ExpenseForm
        // A new key resets the fields each time the form opens for another expense.
        key={form === null ? "closed" : form === "new" ? "new" : form.id}
        expense={form === null || form === "new" ? null : form}
        open={form !== null}
        context={context}
        members={members.map((m) => ({ id: m.userId, name: m.name }))}
        onClose={() => setForm(null)}
        onSave={(values) => {
          if (form && form !== "new") actions.editExpense(form.id, values)
          else actions.addExpense(values, householdId)
          setMonth(monthOf(values.date))
          setForm(null)
        }}
        onDelete={() => {
          if (form && form !== "new") actions.removeExpense(form.id)
          setForm(null)
        }}
      />
      <MoneySettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        context={context}
      />
    </>
  )
}

type Values = {
  amountCents: number
  categoryId: string | null
  date: string
  note: string
  paidBy: string
  /** Null is equally between all members. */
  split: ExpenseSplit | null
}

function ExpenseForm({
  expense,
  open,
  context,
  members,
  onClose,
  onSave,
  onDelete,
}: {
  expense: Expense | null
  open: boolean
  context: MoneyContext
  members: { id: string; name: string }[]
  onClose: () => void
  onSave: (values: Values) => void
  onDelete: () => void
}) {
  const { t } = useTranslation("money")
  const { money, householdId, actions } = context
  const [amount, setAmount] = useState(
    expense ? amountInputText(expense.amountCents) : ""
  )
  const [categoryId, setCategoryId] = useState<string | null>(
    expense?.categoryId ?? null
  )
  const [date, setDate] = useState(expense?.date ?? todayString())
  const [note, setNote] = useState(expense?.note ?? "")
  const share = useShare(members, {
    paidBy: expense?.paidBy ?? actions.me,
    split: expense?.split ?? null,
  })

  const cents = parseCents(amount)
  const shared = !!householdId && members.length > 0
  const valid = cents !== null && cents > 0 && (!shared || share.valid)
  const save = () => {
    if (!valid) return
    onSave({
      amountCents: cents,
      categoryId,
      date,
      note: note.trim(),
      paidBy: share.paidBy,
      split: shared ? share.split : null,
    })
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={expense ? t("expenses.form.editTitle") : t("expenses.form.newTitle")}
    >
      <AmountField
        label={t("amountIn", { currency: money.currency as Currency })}
        value={amount}
        onChange={setAmount}
        autoFocus={!expense}
        onSubmit={save}
      />
      <CategoryField
        categories={money.categories}
        value={categoryId}
        onChange={setCategoryId}
      />
      <DayField label={t("day")} date={date} onChange={setDate} />
      <Input
        label={t("expenses.form.note")}
        value={note}
        onChangeText={setNote}
        placeholder={t("expenses.form.notePlaceholder")}
        maxLength={500}
        onSubmitEditing={save}
      />
      {shared && <ShareFields share={share} />}
      <View className={cn("flex-row gap-3")}>
        {expense && (
          <Button
            variant="outline"
            label={t("form.delete")}
            className="flex-1"
            onPress={onDelete}
          />
        )}
        <Button
          label={expense ? t("form.save") : t("expenses.form.create")}
          className="flex-1"
          disabled={!valid}
          onPress={save}
        />
      </View>
    </Sheet>
  )
}
