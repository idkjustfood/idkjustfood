import { afterError } from "./shopping-ops"

/**
 * A list of things that work without a connection (home inventory, contacts). It is the same
 * idea as the shopping lists, chores and calendar: changes are applied at once, kept in a queue
 * (also on the device, so they survive closing the app) and sent in order when the server can be
 * reached. The server's answer then replaces the items.
 *
 * It is generic, so the next list of this kind needs a few lines, not a copy of this file.
 * Every change uses ids chosen on the device and absolute values, so sending one twice does no
 * harm.
 */

/** What every item has. `householdId` null means a personal item. */
export type ListItem = {
  id: string
  householdId: string | null
  createdAt: string
}

/** The fields a person can change: everything but the identity of the item. */
export type ListChange<T extends ListItem> = Partial<
  Omit<T, "id" | "householdId" | "createdAt">
>

export type ListOp<T extends ListItem> =
  | { type: "add"; item: Omit<T, "createdAt"> }
  | { type: "update"; id: string; change: ListChange<T> }
  | { type: "remove"; id: string }

/** The items after one change. Never changes its input. */
export function applyListOp<T extends ListItem>(
  items: T[],
  op: ListOp<T>,
  now = new Date().toISOString()
): T[] {
  switch (op.type) {
    case "add":
      if (items.some((item) => item.id === op.item.id)) return items
      return [...items, { ...op.item, createdAt: now } as T]
    case "update":
      return items.map((item) =>
        item.id === op.id ? { ...item, ...definedOnly(op.change) } : item
      )
    case "remove":
      return items.filter((item) => item.id !== op.id)
  }
}

/** The server's items with the changes that are still waiting to be sent put on top. */
export function applyListOps<T extends ListItem>(items: T[], queue: ListOp<T>[]) {
  return queue.reduce((all, op) => applyListOp(all, op), items)
}

/** A change without the fields that were not given. */
function definedOnly<T extends ListItem>(change: ListChange<T>) {
  return Object.fromEntries(
    Object.entries(change).filter(([, value]) => value !== undefined)
  )
}

const statusOf = (error: unknown) =>
  typeof error === "object" && error !== null && "status" in error
    ? Number((error as { status: unknown }).status)
    : 0

export type ListDeps<T extends ListItem> = {
  /** All items the user can see. Missing in the demo, which has no server. */
  fetchItems?: () => Promise<T[]>
  /** Sends one change. Throws an error with a `status` when it fails. */
  send: (op: ListOp<T>) => Promise<void>
  /** Where the items and waiting changes are kept on this device. Missing in the demo. */
  storage?: {
    read: () => Promise<string | null>
    write: (value: string) => Promise<void>
  }
  /** Items to start with, when there is no server (demo). */
  initial?: T[]
}

export type ListState<T extends ListItem> = {
  /** What to show: the server's items with waiting changes on top. */
  items: T[]
  /** Changes made here that the server does not know yet. */
  pending: number
  /** The items have been read from this device or the server at least once. */
  loaded: boolean
  /** False after the last try could not reach the server. */
  online: boolean
  /** A message when loading failed for another reason than the connection. */
  error: string | null
}

type Saved<T extends ListItem> = { items: T[]; queue: ListOp<T>[] }

export class ListStore<T extends ListItem> {
  private snapshot: T[]
  private queue: ListOp<T>[] = []
  private loaded: boolean
  private online = true
  private error: string | null = null
  private paused = false
  private running: Promise<void> | null = null
  private again = false
  private listeners = new Set<() => void>()
  private state: ListState<T>

  constructor(private readonly deps: ListDeps<T>) {
    this.snapshot = deps.initial ?? []
    this.loaded = !deps.fetchItems
    this.state = this.build()
  }

  private build(): ListState<T> {
    return {
      items: applyListOps(this.snapshot, this.queue),
      pending: this.queue.length,
      loaded: this.loaded,
      online: this.online,
      error: this.error,
    }
  }

  private emit() {
    this.state = this.build()
    for (const listener of this.listeners) listener()
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getState = () => this.state

  private async persist() {
    const { storage } = this.deps
    if (!storage) return
    const saved: Saved<T> = { items: this.snapshot, queue: this.queue }
    try {
      await storage.write(JSON.stringify(saved))
    } catch {
      // Not kept on the device this time. The items still work.
    }
  }

  /** Reads what was kept on the device, shows it, then asks the server. */
  async start() {
    const { storage } = this.deps
    if (storage) {
      try {
        const text = await storage.read()
        const saved = text ? (JSON.parse(text) as Partial<Saved<T>>) : null
        if (saved && Array.isArray(saved.items) && Array.isArray(saved.queue)) {
          this.snapshot = saved.items
          this.queue = saved.queue
          this.loaded = true
          this.emit()
        }
      } catch {
        // Unreadable: start empty and ask the server.
      }
    }
    await this.sync()
  }

  /** Stops talking to the server (for example while pretending to be offline). */
  setPaused(paused: boolean) {
    if (this.paused === paused) return
    this.paused = paused
    if (paused) {
      this.online = false
      this.emit()
    } else {
      void this.sync()
    }
  }

  /** Sends waiting changes, then loads the items from the server. Safe to call at any time. */
  sync(): Promise<void> {
    if (this.running) {
      this.again = true
      return this.running
    }
    this.running = (async () => {
      do {
        this.again = false
        await this.syncOnce()
      } while (this.again)
    })().finally(() => {
      this.running = null
    })
    return this.running
  }

  private async syncOnce() {
    if (this.paused) return
    try {
      await this.flush()
      if (this.queue.length === 0 && this.deps.fetchItems) {
        this.snapshot = await this.deps.fetchItems()
        this.loaded = true
        await this.persist()
      }
      this.online = true
      this.error = null
    } catch (error) {
      if (statusOf(error) === 0) {
        this.online = false
      } else {
        this.online = true
        this.error =
          error instanceof Error ? error.message : "Something went wrong."
      }
    }
    this.emit()
  }

  private async flush() {
    while (this.queue.length > 0) {
      const op = this.queue[0]!
      try {
        await this.deps.send(op)
        this.snapshot = applyListOp(this.snapshot, op)
      } catch (error) {
        if (afterError(statusOf(error)) === "retry-later") throw error
        // The server will never accept this change: forget it.
      }
      this.queue = this.queue.filter((queued) => queued !== op)
      await this.persist()
      this.emit()
    }
  }

  /** Makes a change now and sends it when possible. */
  dispatch(op: ListOp<T>) {
    this.queue = [...this.queue, op]
    this.emit()
    void this.persist()
    void this.sync()
  }
}
