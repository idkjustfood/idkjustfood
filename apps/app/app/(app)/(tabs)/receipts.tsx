import * as ImagePicker from "expo-image-picker"
import {
  Camera,
  Image as ImageIcon,
  PencilLine,
  Plus,
  ReceiptText,
  Trash2,
} from "lucide-react-native"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native"

import {
  itemsTotal,
  parseCents,
  parseSignedCents,
  splitReceipt,
  todayString,
  type Receipt,
  type ReceiptItem,
} from "@workspace/schemas"

import {
  AmountField,
  CategoryField,
  DayField,
} from "@/components/money-parts"
import { StateTag } from "@/components/money-progress"
import { MoneyScreen, type MoneyContext } from "@/components/money-screen"
import { EmptyState } from "@/components/states"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet } from "@/components/ui/sheet"
import type { PickedImage } from "@/lib/api/client"
import { amountInputText, formatMoney, shortDay } from "@/lib/money-format"
import { newId } from "@/lib/shopping-ops"
import { useUploadReceipt } from "@/lib/money-receipts"

/**
 * Receipts: take or choose a photo of a receipt, or type one in without a photo. With a photo the
 * server stores it and the AI reads the shop, the date, the total and the lines, and puts every line
 * in one of the person's categories. What it cannot read stays empty. The person checks the values,
 * fixes them, and turns the receipt into expenses (one per category) with one tap.
 */
export default function Receipts() {
  const { t } = useTranslation("money")
  return (
    <MoneyScreen title={t("receipts.title")} subtitle={t("receipts.subtitle")}>
      {(context) => <ReceiptsBody context={context} />}
    </MoneyScreen>
  )
}

function pickedPhoto(asset: ImagePicker.ImagePickerAsset): PickedImage {
  const mimeType = asset.mimeType ?? "image/jpeg"
  return {
    uri: asset.uri,
    mimeType,
    name: asset.fileName ?? `receipt.${mimeType.split("/")[1] ?? "jpg"}`,
    file: asset.file,
  }
}

function ReceiptsBody({ context }: { context: MoneyContext }) {
  const { t } = useTranslation("money")
  const { money, householdId } = context
  const upload = useUploadReceipt(householdId)
  const [problem, setProblem] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  async function choose(source: "camera" | "library") {
    setProblem(null)
    try {
      if (source === "camera") {
        const permission = await ImagePicker.requestCameraPermissionsAsync()
        if (!permission.granted) return setProblem(t("receipts.cameraDenied"))
      }
      // A quality below 1 also turns iPhone HEIC photos into JPEG, which the server reads.
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        quality: 0.8,
      }
      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options)
      const asset = result.canceled ? undefined : result.assets[0]
      if (!asset) return
      upload.mutate(pickedPhoto(asset), {
        onSuccess: (answer) => {
          const id = (answer as { receipt?: { id: string } }).receipt?.id
          if (id) setOpenId(id)
        },
        onError: (error) => setProblem(error.message),
      })
    } catch {
      setProblem(t("receipts.photoFailed"))
    }
  }

  const receipts = [...money.receipts].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  )
  const open = money.receipts.find((r) => r.id === openId)

  return (
    <>
      <View className="flex-row flex-wrap gap-3">
        {Platform.OS !== "web" && (
          <Button
            icon={Camera}
            label={t("receipts.takePhoto")}
            className="flex-1"
            disabled={upload.isPending}
            onPress={() => void choose("camera")}
          />
        )}
        <Button
          icon={ImageIcon}
          variant={Platform.OS === "web" ? "default" : "outline"}
          label={t("receipts.choosePhoto")}
          className="flex-1"
          disabled={upload.isPending}
          onPress={() => void choose("library")}
        />
      </View>
      <Button
        icon={PencilLine}
        variant="outline"
        label={t("receipts.addWithoutPhoto")}
        onPress={() => setOpenId(context.actions.addReceipt(householdId))}
      />
      {upload.isPending && (
        <View role="status" className="flex-row items-center gap-3 rounded-lg bg-tone-butter p-3">
          <ActivityIndicator />
          <Text className="flex-1 text-tone-butter-foreground">
            {t("receipts.reading")}
          </Text>
        </View>
      )}
      {problem && (
        <Text role="alert" className="text-destructive">
          {problem}
        </Text>
      )}
      <Text className="text-sm text-muted-foreground">{t("receipts.needsConnection")}</Text>

      {receipts.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title={t("receipts.empty.title")}
          message={t("receipts.empty.message")}
        />
      ) : (
        <View className="gap-2">
          {receipts.map((receipt) => (
            <Pressable
              key={receipt.id}
              role="button"
              accessibilityLabel={t("receipts.open", {
                name: receipt.shop ?? t("receipts.unknownShop"),
              })}
              onPress={() => setOpenId(receipt.id)}
              className="min-h-16 flex-row items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 active:bg-accent"
            >
              <View className="flex-1 gap-1">
                <Text className="text-base text-foreground">
                  {receipt.shop ?? t("receipts.unknownShop")}
                </Text>
                <Text className="text-sm text-muted-foreground">
                  {receipt.date ? shortDay(receipt.date) : t("receipts.noDate")}
                </Text>
                {receipt.expenseId ? (
                  <StateTag label={t("receipts.status.added")} tone="ok" />
                ) : receipt.status === "failed" ? (
                  <StateTag label={t("receipts.status.failed")} tone="warning" />
                ) : null}
              </View>
              <Text className="text-base font-semibold text-foreground">
                {receipt.totalCents === null
                  ? t("receipts.noTotal")
                  : formatMoney(receipt.totalCents, money.currency)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <ReceiptSheet
        key={open?.id ?? "closed"}
        receipt={open}
        context={context}
        onClose={() => setOpenId(null)}
      />
    </>
  )
}

/** One receipt: the values the AI read, to check and correct, and what to do with it. */
/** A line of a receipt while it is edited: the amount is still the text the person typed. */
type Line = { id: string; name: string; amount: string; categoryId: string | null }

const signedInputText = (cents: number) =>
  cents < 0 ? `-${amountInputText(-cents)}` : amountInputText(cents)

function ReceiptSheet({
  receipt,
  context,
  onClose,
}: {
  receipt: Receipt | undefined
  context: MoneyContext
  onClose: () => void
}) {
  const { t } = useTranslation("money")
  const { money, actions } = context
  const [shop, setShop] = useState(receipt?.shop ?? "")
  const [total, setTotal] = useState(
    receipt?.totalCents ? amountInputText(receipt.totalCents) : ""
  )
  const [date, setDate] = useState<string | null>(receipt?.date ?? null)
  const [categoryId, setCategoryId] = useState<string | null>(
    money.categories.find((c) => c.key === "groceries")?.id ?? null
  )
  const [lines, setLines] = useState<Line[]>(
    (receipt?.items ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      amount: signedInputText(item.amountCents),
      categoryId: item.categoryId,
    }))
  )
  const cents = parseCents(total)
  const totalOk = total.trim() === "" || (cents !== null && cents > 0)
  const done = !!receipt?.expenseId

  // Lines that are not filled in (no name, or no amount) are dropped when saving.
  const items: ReceiptItem[] = lines.flatMap((line) => {
    const amountCents = parseSignedCents(line.amount)
    return line.name.trim() && amountCents
      ? [{ id: line.id, name: line.name.trim(), amountCents, categoryId: line.categoryId }]
      : []
  })
  const linesOk = lines.every(
    (line) => line.amount.trim() === "" || parseSignedCents(line.amount) !== null
  )
  const sum = itemsTotal(items)
  const split =
    cents !== null && cents > 0 ? splitReceipt({ totalCents: cents, items }, categoryId, "x") : null
  const canAdd =
    !done && totalOk && linesOk && cents !== null && cents > 0 && date !== null && split !== null

  const setLine = (id: string, change: Partial<Line>) =>
    setLines((all) => all.map((line) => (line.id === id ? { ...line, ...change } : line)))

  /** Saves what is typed over what was read. Empty fields are cleared, never guessed. */
  const saveValues = () => {
    if (!receipt) return
    actions.editReceipt(receipt.id, {
      shop: shop.trim() || null,
      date,
      totalCents: cents !== null && cents > 0 ? cents : null,
      items,
    })
  }

  return (
    <Sheet open={!!receipt} onClose={onClose} title={t("receipts.form.title")}>
      {receipt && (
        <>
          {receipt.status === "failed" && receipt.error && (
            <Text role="alert" className="text-sm text-foreground">
              {receipt.error}
            </Text>
          )}
          <Text className="text-sm text-muted-foreground">
            {t("receipts.form.check")}
          </Text>
          <Input
            label={t("receipts.form.shop")}
            value={shop}
            onChangeText={setShop}
            maxLength={200}
            editable={!done}
          />
          <AmountField
            label={t("amountIn", { currency: money.currency })}
            value={total}
            onChange={setTotal}
          />
          {date === null ? (
            <Button
              variant="outline"
              label={t("receipts.form.addDate")}
              disabled={done}
              onPress={() => setDate(todayString())}
            />
          ) : (
            <DayField label={t("receipts.form.date")} date={date} onChange={setDate} />
          )}
          <View className="gap-3">
            <Text className="text-base font-semibold text-foreground">
              {t("receipts.form.items")}
            </Text>
            <Text className="text-sm text-muted-foreground">
              {t("receipts.form.itemsHint")}
            </Text>
            {lines.map((line) => (
              <View
                key={line.id}
                className="gap-2 rounded-lg border border-border bg-card p-3"
              >
                <Input
                  label={t("receipts.form.itemName")}
                  value={line.name}
                  onChangeText={(name) => setLine(line.id, { name })}
                  maxLength={200}
                  editable={!done}
                />
                <Input
                  label={t("receipts.form.itemAmount", { currency: money.currency })}
                  value={line.amount}
                  onChangeText={(amount) => setLine(line.id, { amount })}
                  inputMode="decimal"
                  placeholder="0.00"
                  editable={!done}
                  aria-invalid={
                    line.amount.trim() !== "" && parseSignedCents(line.amount) === null
                  }
                />
                {!done && (
                  <CategoryField
                    label={t("receipts.form.itemCategory")}
                    categories={money.categories}
                    value={line.categoryId}
                    onChange={(id) => setLine(line.id, { categoryId: id })}
                  />
                )}
                {!done && (
                  <Button
                    variant="outline"
                    icon={Trash2}
                    label={t("receipts.form.removeItem")}
                    onPress={() => setLines((all) => all.filter((l) => l.id !== line.id))}
                  />
                )}
              </View>
            ))}
            {!done && (
              <Button
                variant="outline"
                icon={Plus}
                label={t("receipts.form.addItem")}
                onPress={() =>
                  setLines((all) => [
                    ...all,
                    { id: newId(), name: "", amount: "", categoryId: null },
                  ])
                }
              />
            )}
            {items.length > 0 && (
              <Text className="text-sm text-muted-foreground">
                {t("receipts.form.itemsSum", { amount: formatMoney(sum, money.currency) })}
              </Text>
            )}
            {!done && items.length > 0 && sum > 0 && sum !== cents && (
              <View className="gap-2 rounded-lg bg-tone-butter p-3">
                <Text role="alert" className="text-tone-butter-foreground">
                  {t("receipts.form.itemsMismatch")}
                </Text>
                <Button
                  variant="outline"
                  label={t("receipts.form.useItemsTotal")}
                  onPress={() => setTotal(amountInputText(sum))}
                />
              </View>
            )}
          </View>
          {!done && (
            <CategoryField
              label={t("receipts.form.defaultCategory")}
              categories={money.categories}
              value={categoryId}
              onChange={setCategoryId}
            />
          )}
          {done && (
            <Text className="text-sm text-muted-foreground">
              {t("receipts.form.alreadyAdded")}
            </Text>
          )}
          <View className="flex-row gap-3">
            <Button
              variant="outline"
              label={t("form.delete")}
              className="flex-1"
              onPress={() => {
                actions.removeReceipt(receipt.id)
                onClose()
              }}
            />
            {!done && (
              <Button
                variant="outline"
                label={t("form.save")}
                className="flex-1"
                disabled={!totalOk || !linesOk}
                onPress={() => {
                  saveValues()
                  onClose()
                }}
              />
            )}
          </View>
          {!done && (
            <Button
              label={t("receipts.form.addExpense")}
              disabled={!canAdd}
              onPress={() => {
                saveValues()
                actions.receiptToExpense(receipt.id, { categoryId, date })
                onClose()
              }}
            />
          )}
        </>
      )}
    </Sheet>
  )
}
