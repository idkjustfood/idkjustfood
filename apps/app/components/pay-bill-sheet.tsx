import { useTranslation } from "react-i18next"
import { Text } from "react-native"

import type { Bill } from "@workspace/schemas"

import { ShareFields, useShare } from "@/components/share-fields"
import { Button } from "@/components/ui/button"
import { Sheet } from "@/components/ui/sheet"
import { useToday } from "@/lib/chores"
import { useMembers } from "@/lib/households"
import { useMoneyActions, useMoneyState } from "@/lib/money"
import { formatMoney } from "@/lib/money-format"
import { moneyOfSpace } from "@/lib/money-view"

/**
 * Paying a bill in a household: who paid and how it is shared, starting from how the last payment
 * of this bill was. A personal bill is paid with one tap and never opens this.
 */
export function PayBillSheet({
  bill,
  onClose,
}: {
  bill: Bill | null
  onClose: () => void
}) {
  const { t } = useTranslation("money")
  return (
    <Sheet open={!!bill} onClose={onClose} title={t("bills.pay.title")}>
      {bill && <PayBillForm key={bill.id} bill={bill} onClose={onClose} />}
    </Sheet>
  )
}

function PayBillForm({ bill, onClose }: { bill: Bill; onClose: () => void }) {
  const { t } = useTranslation("money")
  const actions = useMoneyActions()
  const today = useToday()
  const data = useMoneyState().data
  const { data: members = [] } = useMembers(bill.householdId ?? undefined)
  const last = [...data.expenses].reverse().find((e) => e.billId === bill.id)
  const share = useShare(
    members.map((m) => ({ id: m.userId, name: m.name })),
    { paidBy: last?.paidBy ?? actions.me, split: last?.split ?? null }
  )
  const currency = moneyOfSpace(data, bill.householdId).currency
  return (
    <>
      <Text className="text-base text-foreground">
        {bill.title} · {formatMoney(bill.amountCents, currency)}
      </Text>
      <ShareFields share={share} />
      <Button
        label={t("bills.pay.confirm")}
        disabled={!share.valid}
        onPress={() => {
          actions.payBill(bill.id, today, {
            paidBy: share.paidBy,
            split: share.split,
          })
          onClose()
        }}
      />
    </>
  )
}
