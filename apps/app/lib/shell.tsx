import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { Platform } from "react-native"

/** Which of the two app-wide sheets is open: the "+" quick add or search. */
type Shell = {
  quickAddOpen: boolean
  setQuickAddOpen: (open: boolean) => void
  searchOpen: boolean
  setSearchOpen: (open: boolean) => void
}

const ShellContext = createContext<Shell | null>(null)

/** Holds the "+" sheet and the search sheet. Ctrl+K or Cmd+K opens search on the web. */
export function ShellProvider({ children }: { children: ReactNode }) {
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    if (Platform.OS !== "web") return
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setSearchOpen(true)
      }
    }
    globalThis.addEventListener?.("keydown", onKey)
    return () => globalThis.removeEventListener?.("keydown", onKey)
  }, [])

  const value = useMemo(
    () => ({ quickAddOpen, setQuickAddOpen, searchOpen, setSearchOpen }),
    [quickAddOpen, searchOpen]
  )
  return <ShellContext value={value}>{children}</ShellContext>
}

export function useShell() {
  const shell = useContext(ShellContext)
  if (!shell) throw new Error("useShell must be used inside ShellProvider")
  return shell
}
