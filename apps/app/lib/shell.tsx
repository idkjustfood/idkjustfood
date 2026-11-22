import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

/** Whether the app-wide "+" quick add sheet is open. */
type Shell = {
  quickAddOpen: boolean
  setQuickAddOpen: (open: boolean) => void
}

const ShellContext = createContext<Shell | null>(null)

/** Holds the "+" quick add sheet. */
export function ShellProvider({ children }: { children: ReactNode }) {
  const [quickAddOpen, setQuickAddOpen] = useState(false)

  const value = useMemo(
    () => ({ quickAddOpen, setQuickAddOpen }),
    [quickAddOpen]
  )
  return <ShellContext value={value}>{children}</ShellContext>
}

export function useShell() {
  const shell = useContext(ShellContext)
  if (!shell) throw new Error("useShell must be used inside ShellProvider")
  return shell
}
