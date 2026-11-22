import { useMutation } from "@tanstack/react-query"

import { ApiError, uploadDocument, type PickedImage } from "@/lib/api/client"
import { useAppState } from "@/lib/app-state"
import i18n from "@/lib/i18n"
import { useMoneyActions } from "@/lib/money"
import { newId } from "@/lib/shopping-ops"

/**
 * Sends the photo of a receipt to the server, which stores it and has the AI read it. This one
 * needs a connection (the reading happens on the server). Afterwards the money is synced, so the
 * new receipt shows up, read or not.
 */
export function useUploadReceipt(householdId: string | null) {
  const { demo } = useAppState()
  const { sync } = useMoneyActions()
  return useMutation({
    mutationFn: async (photo: PickedImage) => {
      if (demo) throw new ApiError(i18n.t("common:demoOnly"), 0)
      // The id is chosen here, so a retry after a lost answer does not add the receipt twice.
      return uploadDocument("/api/money/receipts", photo, {
        id: newId(),
        householdId: householdId ?? undefined,
      })
    },
    onSettled: () => sync(),
  })
}
