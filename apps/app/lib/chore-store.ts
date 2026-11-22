import type { Chore } from "@workspace/schemas"

import { applyChoreOp, applyChoreOps, type ChoreOp } from "./chore-ops"
import { afterError } from "./shopping-ops"

const statusOf = (error: unknown) =>
  typeof error === "object" && error !== null && "status" in error
    ? Number((error as { status: unknown }).status)
    : 0

export type ChoreDeps = {
  /** All chores the user can see. Missing in the demo, which has no server. */
  fetchChores?: () => Promise<Chore[]>
  /** Sends one change. Throws an error with a `status` when it fails. */
  send: (op: ChoreOp) => Promise<void>
  /** Where the chores and waiting changes are kept on this device. Missing in the demo. */
  storage?: {
    read: () => Promise<string | null>
    write: (value: string) => Promise<void>
  }
  /** Chores to start with, when there is no server (demo). */
  initial?: Chore[]
}

export type ChoreState = {
  /** What to show: the server's chores with waiting changes on top. */
  chores: Chore[]
  /** Changes made here that the server does not know yet. */
  pending: number
  /** The chores have been read from this device or the server at least once. */
  loaded: boolean
  /** False after the last try could not reach the server. */
  online: boolean
  /** A message when loading failed for another reason than the connection. */
  error: string | null
}

type Saved = { chores: Chore[]; queue: ChoreOp[] }

/**
 * Chores that work without a connection, the same way as the shopping lists: changes are
 * applied at once, kept in a queue (also on the device, so they survive closing the app) and
 * sent in order when the server can be reached. The server's answer then replaces the chores.
 */
export class ChoreStore {
  private snapshot: Chore[]
  private queue: ChoreOp[] = []
  private loaded: boolean
  private online = true
  private error: string | null = null
  private paused = false
  private running: Promise<void> | null = null
  private again = false
  private listeners = new Set<() => void>()
  private state: ChoreState

  constructor(private readonly deps: ChoreDeps) {
    this.snapshot = deps.initial ?? []
    this.loaded = !deps.fetchChores
    this.state = this.build()
  }

  private build(): ChoreState {
    return {
      chores: applyChoreOps(this.snapshot, this.queue),
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
    const saved: Saved = { chores: this.snapshot, queue: this.queue }
    try {
      await storage.write(JSON.stringify(saved))
    } catch {
      // Not kept on the device this time. The chores still work.
    }
  }

  /** Reads what was kept on the device, shows it, then asks the server. */
  async start() {
    const { storage } = this.deps
    if (storage) {
      try {
        const text = await storage.read()
        const saved = text ? (JSON.parse(text) as Partial<Saved>) : null
        if (saved && Array.isArray(saved.chores) && Array.isArray(saved.queue)) {
          // Chores saved before kinds existed have no kind: they are chores.
          this.snapshot = saved.chores.map((chore) => ({
            ...chore,
            kind: chore.kind ?? "chore",
          }))
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

  /** Sends waiting changes, then loads the chores from the server. Safe to call at any time. */
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
      if (this.queue.length === 0 && this.deps.fetchChores) {
        this.snapshot = await this.deps.fetchChores()
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
        this.snapshot = applyChoreOp(this.snapshot, op)
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
  dispatch(op: ChoreOp) {
    this.queue = [...this.queue, op]
    this.emit()
    void this.persist()
    void this.sync()
  }
}
