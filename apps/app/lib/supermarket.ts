import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import {
  defaultSupermarketId,
  getSupermarket,
  supermarkets,
  type Supermarket,
} from "@workspace/schemas"

import { loadSupermarket, saveSupermarket } from "@/lib/preferences"

/**
 * The supermarket the shopping lists are sorted for. It is saved on the device, so it works
 * offline and is remembered. Until it is loaded, and for an unknown id, the standard one is used.
 */
export function useSupermarket() {
  const { t } = useTranslation()
  const [id, setId] = useState(defaultSupermarketId)

  useEffect(() => {
    let active = true
    void loadSupermarket().then((saved) => {
      if (active && saved) setId(getSupermarket(saved).id)
    })
    return () => {
      active = false
    }
  }, [])

  const choose = useCallback((next: string) => {
    setId(next)
    void saveSupermarket(next)
  }, [])

  /** A brand shows as written, a layout without a brand (standard) is translated. */
  const nameOf = (supermarket: Supermarket) =>
    supermarket.name ?? t(`shopping:store.${supermarket.id}`)

  return {
    supermarket: getSupermarket(id),
    supermarkets,
    choose,
    nameOf,
  }
}

export type SupermarketState = ReturnType<typeof useSupermarket>
