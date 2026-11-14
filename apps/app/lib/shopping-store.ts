import type { ShoppingList } from "@workspace/schemas"

import { afterError, applyOp, applyOps, type ShoppingOp } from "./shopping-ops"

/** Thrown when something needs a connection. `status` 0 means "could not reach the server". */
export class OfflineError extends Error {
  readonly status = 0
  constructor(message = "You need a connection to do this.") {
    super(message)
  }
}

const statusOf = (error: unknown) =>
  typeof error === "object" && error !== null && "status" in error
    ? Number((error as { status: unknown }).status)
    : 0

/** What adding a recipe gives back: the new list and the ingredients that were left out. */
export type AddedRecipe = { list: ShoppingList; skipped: string[] }

export type ShoppingDeps = {
  /** All lists the user can see. Missing in the demo, which has no server. */
  fetchLists?: () => Promise<ShoppingList[]>
  /** Sends one change. Throws an error with a `status` when it fails. */
  send: (op: ShoppingOp) => Promise<void>
  /**
   * Adds a recipe to a list on the server and returns the list, with the names of the
   * ingredients that were left out because they are pantry staples.
   */
  addRecipe: (
    list: ShoppingList,
    recipeId: string,
    servings: number | undefined
  ) => Promise<AddedRecipe>
  /** Where the lists and waiting changes are kept on this device. Missing in the demo. */
  storage?: {
    read: () => Promise<string | null>
    write: (value: string) => Promise<void>
  }
  /** Lists to start with, when there is no server (demo). */
  initial?: ShoppingList[]
}

export type ShoppingState = {
  /** What to show: the server's lists with waiting changes on top. */
  lists: ShoppingList[]
  /** Changes made here that the server does not know yet. */
  pending: number
  /** The lists have been read from this device or the server at least once. */
  loaded: boolean
  /** False after the last try could not reach the server. */
  online: boolean
  /** A message when loading failed for another reason than the connection. */
  error: string | null
}

type Saved = { lists: ShoppingList[]; queue: ShoppingOp[] }

/**
 * Shopping lists that work without a connection. Changes are applied at once,
 * kept in a queue (also on the device, so they survive closing the app) and
 * sent in order when the server can be reached. The server's answer then
 * replaces the lists.
 */
export class ShoppingStore {
  private snapshot: ShoppingList[]
  private queue: ShoppingOp[] = []
  private loaded: boolean
  private online = true
  private error: string | null = null
  private paused = false
  private running: Promise<void> | null = null
  private again = false
  private listeners = new Set<() => void>()
  private state: ShoppingState

  constructor(private readonly deps: ShoppingDeps) {
    this.snapshot = deps.initial ?? []
    this.loaded = !deps.fetchLists
    this.state = this.build()
  }

  private build(): ShoppingState {
    return {
      lists: applyOps(this.snapshot, this.queue),
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
    const saved: Saved = { lists: this.snapshot, queue: this.queue }
    try {
      await storage.write(JSON.stringify(saved))
    } catch {
      // Not kept on the device this time. The lists still work.
    }
  }

  /** Reads what was kept on the device, shows it, then asks the server. */
  async start() {
    const { storage } = this.deps
    if (storage) {
      try {
        const text = await storage.read()
        const saved = text ? (JSON.parse(text) as Partial<Saved>) : null
        if (saved && Array.isArray(saved.lists) && Array.isArray(saved.queue)) {
          this.snapshot = saved.lists
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

  /** Sends waiting changes, then loads the lists from the server. Safe to call at any time. */
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
      if (this.queue.length === 0 && this.deps.fetchLists) {
        this.snapshot = await this.deps.fetchLists()
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
        this.snapshot = applyOp(this.snapshot, op)
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
  dispatch(op: ShoppingOp) {
    this.queue = [...this.queue, op]
    this.emit()
    void this.persist()
    void this.sync()
  }

  /**
   * Adds a recipe's ingredients to a list. This needs the server, because it
   * merges them with what is already on the list there.
   */
  async addRecipe(listId: string, recipeId: string, servings?: number) {
    await this.sync()
    if (this.queue.length > 0 || (!this.online && this.deps.fetchLists)) {
      throw new OfflineError(
        "You need a connection to add a recipe. Your other changes are saved and will be sent first."
      )
    }
    const list = this.snapshot.find((l) => l.id === listId)
    if (!list)
      throw Object.assign(new Error("Shopping list not found"), { status: 404 })
    const { list: updated, skipped } = await this.deps.addRecipe(
      list,
      recipeId,
      servings
    )
    this.snapshot = this.snapshot.map((l) => (l.id === listId ? updated : l))
    await this.persist()
    this.emit()
    return { list: updated, skipped }
  }
}
