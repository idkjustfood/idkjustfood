import type { CalendarEntry } from "@workspace/schemas"

import { applyCalendarOp, applyCalendarOps, type CalendarOp } from "./calendar-ops"
import { afterError } from "./shopping-ops"

const statusOf = (error: unknown) =>
  typeof error === "object" && error !== null && "status" in error
    ? Number((error as { status: unknown }).status)
    : 0

export type CalendarDeps = {
  /** All entries the user can see. Missing in the demo, which has no server. */
  fetchEntries?: () => Promise<CalendarEntry[]>
  /** Sends one change. Throws an error with a `status` when it fails. */
  send: (op: CalendarOp) => Promise<void>
  /** Where the entries and waiting changes are kept on this device. Missing in the demo. */
  storage?: {
    read: () => Promise<string | null>
    write: (value: string) => Promise<void>
  }
  /** Calendar entries to start with, when there is no server (demo). */
  initial?: CalendarEntry[]
}

export type CalendarState = {
  /** What to show: the server's entries with waiting changes on top. */
  entries: CalendarEntry[]
  /** Changes made here that the server does not know yet. */
  pending: number
  /** The entries have been read from this device or the server at least once. */
  loaded: boolean
  /** False after the last try could not reach the server. */
  online: boolean
  /** A message when loading failed for another reason than the connection. */
  error: string | null
}

type Saved = { entries: CalendarEntry[]; queue: CalendarOp[] }

/**
 * Calendar entries that work without a connection, the same way as the shopping lists: changes are
 * applied at once, kept in a queue (also on the device, so they survive closing the app) and
 * sent in order when the server can be reached. The server's answer then replaces the entries.
 */
export class CalendarStore {
  private snapshot: CalendarEntry[]
  private queue: CalendarOp[] = []
  private loaded: boolean
  private online = true
  private error: string | null = null
  private paused = false
  private running: Promise<void> | null = null
  private again = false
  private listeners = new Set<() => void>()
  private state: CalendarState

  constructor(private readonly deps: CalendarDeps) {
    this.snapshot = deps.initial ?? []
    this.loaded = !deps.fetchEntries
    this.state = this.build()
  }

  private build(): CalendarState {
    return {
      entries: applyCalendarOps(this.snapshot, this.queue),
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
    const saved: Saved = { entries: this.snapshot, queue: this.queue }
    try {
      await storage.write(JSON.stringify(saved))
    } catch {
      // Not kept on the device this time. The entries still work.
    }
  }

  /** Reads what was kept on the device, shows it, then asks the server. */
  async start() {
    const { storage } = this.deps
    if (storage) {
      try {
        const text = await storage.read()
        const saved = text ? (JSON.parse(text) as Partial<Saved>) : null
        if (saved && Array.isArray(saved.entries) && Array.isArray(saved.queue)) {
          this.snapshot = saved.entries
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

  /** Sends waiting changes, then loads the entries from the server. Safe to call at any time. */
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
      if (this.queue.length === 0 && this.deps.fetchEntries) {
        this.snapshot = await this.deps.fetchEntries()
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
        this.snapshot = applyCalendarOp(this.snapshot, op)
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
  dispatch(op: CalendarOp) {
    this.queue = [...this.queue, op]
    this.emit()
    void this.persist()
    void this.sync()
  }
}
