import { CalendarClock, Check, Plus } from "lucide-react-native"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Pressable, Text, View } from "react-native"

import {
  addDays,
  billRepeats,
  daysUntilBill,
  parseCents,
  type Bill,
  type BillRepeat,
} from "@workspace/schemas"

import {
  AmountField,
  CategoryField,
  categoryName,
  DayField,
} from "@/components/money-parts"
import { PayBillSheet } from "@/components/pay-bill-sheet"
import { StateTag } from "@/components/money-progress"
import { MoneyScreen, type MoneyContext } from "@/components/money-screen"
import { EmptyState } from "@/components/states"
import { Button } from "@/components/ui/button"
import { Chip } from "@/components/ui/chip"
import { Input } from "@/components/ui/input"
import { Sheet } from "@/components/ui/sheet"
import { amountInputText, formatMoney, shortDay } from "@/lib/money-format"
import { billsByDue } from "@/lib/money-view"

/**
 * Bills: things that have to be paid, once or on a repeat (rent, phone, insurance). "Mark as paid"
 * adds the expense and moves the bill to its next day. Due bills also show on Today.
 */
export default function Bills() {
  const { t } = useTranslation("money")
  const [form, setForm] = useState<Bill | "new" | null>(null)
  return (
    <MoneyScreen
      title={t("bills.title")}
      subtitle={t("bills.subtitle")}
      actions={
        <Button size="sm" icon={Plus} label={t("bills.add")} onPress={() => setForm("new")} />
      }
    >
      {(context) => <BillsBody context={context} form={form} setForm={setForm} />}
    </MoneyScreen>
  )
}

function BillsBody({
  context,
  form,
  setForm,
}: {
  context: MoneyContext
  form: Bill | "new" | null
  setForm: (form: Bill | "new" | null) => void
}) {
  const { t } = useTranslation("money")
  const [paying, setPaying] = useState<Bill | null>(null)
  const { money, householdId, actions, today } = context
  const bills = billsByDue(money.bills)

  return (
    <>
      {bills.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title={t("bills.empty.title")}
          message={t("bills.empty.message")}
          action={t("bills.add")}
          onAction={() => setForm("new")}
        />
      ) : (
        <View className="gap-3">
          {bills.map((bill) => {
            const days = daysUntilBill(bill, today)
            const overdue = days !== null && days < 0
            const due = days !== null && days <= 0
            return (
              <View
                key={bill.id}
                className="gap-3 rounded-lg border border-border bg-card p-4"
              >
                <Pressable
                  role="button"
                  accessibilityLabel={t("bills.edit", { name: bill.title })}
                  onPress={() => setForm(bill)}
                  className="gap-1"
                >
                  <View className="flex-row items-center justify-between gap-3">
                    <Text className="flex-1 text-base font-semibold text-foreground">
                      {bill.title}
                    </Text>
                    <Text className="text-base font-semibold text-foreground">
                      {formatMoney(bill.amountCents, money.currency)}
                    </Text>
                  </View>
                  <Text className="text-sm text-muted-foreground">
                    {[
                      t(`bills.repeat.${bill.repeat}`),
                      bill.categoryId
                        ? categoryName(t, money.categories.find((c) => c.id === bill.categoryId))
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </Pressable>
                <View className="flex-row items-center justify-between gap-3">
                  {bill.nextDue === null ? (
                    <StateTag label={t("bills.paid")} tone="ok" />
                  ) : (
                    <View className="gap-1">
                      <StateTag
                        label={
                          overdue
                            ? t("bills.overdue", { count: -days })
                            : days === 0
                              ? t("bills.dueToday")
                              : t("bills.dueIn", { count: days! })
                        }
                        tone={overdue ? "danger" : due ? "warning" : "ok"}
                      />
                      <Text className="text-sm text-muted-foreground">
                        {shortDay(bill.nextDue)}
                      </Text>
                    </View>
                  )}
                  {bill.nextDue !== null && (
                    <Button
                      size="sm"
                      icon={Check}
                      label={t("bills.markPaid")}
                      accessibilityLabel={t("bills.markPaidFor", { name: bill.title })}
                      onPress={() =>
                        bill.householdId ? setPaying(bill) : actions.payBill(bill.id, today)
                      }
                    />
                  )}
                </View>
              </View>
            )
          })}
        </View>
      )}

      <PayBillSheet bill={paying} onClose={() => setPaying(null)} />
      <BillForm
        key={form === null ? "closed" : form === "new" ? "new" : form.id}
        bill={form === null || form === "new" ? null : form}
        open={form !== null}
        context={context}
        onClose={() => setForm(null)}
        onSave={(values) => {
          if (form && form !== "new") actions.editBill(form.id, values)
          else actions.addBill(values, householdId)
          setForm(null)
        }}
        onDelete={() => {
          if (form && form !== "new") actions.removeBill(form.id)
          setForm(null)
        }}
      />
    </>
  )
}

type Values = {
  title: string
  amountCents: number
  categoryId: string | null
  repeat: BillRepeat
  nextDue: string
}

function BillForm({
  bill,
  open,
  context,
  onClose,
  onSave,
  onDelete,
}: {
  bill: Bill | null
  open: boolean
  context: MoneyContext
  onClose: () => void
  onSave: (values: Values) => void
  onDelete: () => void
}) {
  const { t } = useTranslation("money")
  const { money, today } = context
  const [title, setTitle] = useState(bill?.title ?? "")
  const [amount, setAmount] = useState(bill ? amountInputText(bill.amountCents) : "")
  const [categoryId, setCategoryId] = useState<string | null>(bill?.categoryId ?? null)
  const [repeat, setRepeat] = useState<BillRepeat>(bill?.repeat ?? "monthly")
  const [nextDue, setNextDue] = useState(bill?.nextDue ?? addDays(today, 7))
  const cents = parseCents(amount)
  const valid = title.trim() !== "" && cents !== null && cents > 0
  const save = () => {
    if (valid) onSave({ title: title.trim(), amountCents: cents, categoryId, repeat, nextDue })
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={bill ? t("bills.form.editTitle") : t("bills.form.newTitle")}
    >
      <Input
        label={t("bills.form.title")}
        value={title}
        onChangeText={setTitle}
        placeholder={t("bills.form.placeholder")}
        maxLength={200}
        autoFocus={!bill}
      />
      <AmountField
        label={t("amountIn", { currency: money.currency })}
        value={amount}
        onChange={setAmount}
        onSubmit={save}
      />
      <View className="gap-2">
        <Text className="text-sm font-medium text-foreground">{t("bills.form.repeat")}</Text>
        <View className="flex-row flex-wrap gap-2">
          {billRepeats.map((value) => (
            <Chip
              key={value}
              label={t(`bills.repeat.${value}`)}
              selected={repeat === value}
              onPress={() => setRepeat(value)}
            />
          ))}
        </View>
      </View>
      <DayField
        label={bill ? t("bills.form.nextDue") : t("bills.form.firstDue")}
        date={nextDue}
        onChange={setNextDue}
      />
      <CategoryField
        categories={money.categories}
        value={categoryId}
        onChange={setCategoryId}
      />
      <View className="flex-row gap-3">
        {bill && (
          <Button
            variant="outline"
            label={t("form.delete")}
            className="flex-1"
            onPress={onDelete}
          />
        )}
        <Button
          label={bill ? t("form.save") : t("bills.form.create")}
          className="flex-1"
          disabled={!valid}
          onPress={save}
        />
      </View>
    </Sheet>
  )
}
