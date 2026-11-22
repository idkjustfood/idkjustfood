import * as ImagePicker from "expo-image-picker"
import { Camera, Image as ImageIcon, ReceiptText } from "lucide-react-native"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native"

import {
  parseCents,
  todayString,
  type Receipt,
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
import { useUploadReceipt } from "@/lib/money-receipts"

/**
 * Receipts: take or choose a photo of a receipt. The server stores it and the AI reads the shop,
 * the date and the total. What it cannot read stays empty. The person checks the values, fixes
 * them, and turns the receipt into an expense with one tap.
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
  const cents = parseCents(total)
  const totalOk = total.trim() === "" || (cents !== null && cents > 0)
  const done = !!receipt?.expenseId
  const canAdd = !done && totalOk && cents !== null && cents > 0 && date !== null

  /** Saves what is typed over what was read. Empty fields are cleared, never guessed. */
  const saveValues = () => {
    if (!receipt) return
    actions.editReceipt(receipt.id, {
      shop: shop.trim() || null,
      date,
      totalCents: cents !== null && cents > 0 ? cents : null,
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
          {!done && (
            <CategoryField
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
                disabled={!totalOk}
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
