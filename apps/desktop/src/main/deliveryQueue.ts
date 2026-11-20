// #region delivery-queue — docs: docs/ux/scenarios.md#scn-183-the-ceo-manages-the-sessions-of-this-computer
import { asOnePaste } from '../shared/delivery.ts'

/** A PTY write receipt is not an acknowledgement that an agent accepted work. */
export type DeliveryWriteResult = {
  state: 'written' | 'failed_before_write' | 'outcome_unknown'
  reason?: string
}
/** How long an item waits for quiet before it is written into a working Claude Code (`busyAfterMs`). */
export const BUSY_WRITE_AFTER_MS = 3000
/** `quietOnly`: never written while the runner prints, whatever `busyAfterMs` says (0.3.27 review, DO-6): a console's
 *  first instruction waits for the prompt, never for a start-up still printing. */
export type DeliveryWriteOptions = { beforeWrite?: () => Promise<boolean>; quietOnly?: boolean }
export type DeliveryQueueTiming = {
  settleMs?: number
  maxWaitMs?: number
  capacity?: number
  /**
   * A runner that takes typed input while it works (Claude Code queues a message sent during a turn; measured
   * 2026-11-20: a paste with its Enter written mid-turn was answered after the turn). For such a runner, an item that
   * has waited this long is written while the console keeps printing: a working console prints its spinner without
   * the quiet the settle rule waits for (1 gap of 400 ms in 44 in the measurement), so the item timed out after 30 s
   * and the owner's message to the CEO was lost (5 of 20 on 2026-11-19 and 20). Never for an item with a write gate.
   */
  busyAfterMs?: number
  /**
   * 2026-11-20 (the owner: the first task of a session the CEO started was lost three times, 0daa75f1, e150fe59 and more):
   * Claude Code prints a cursor save and restore (13 characters) about 3 s after it starts, then nothing while its
   * start-up hooks run; the settle rule read that quiet as ready, and a paste written then was dropped, before Claude
   * Code had drawn its input box (reproduced on this Mac, no turn, no transcript, in 45 s). With this set, nothing is
   * written until the runner's output shows its prompt is drawn; written once that shows, the task was taken in every
   * run. The test reads the recent output, ANSI stripped; once true it stays true for the session.
   */
  promptDrawn?: (recentOutput: string) => boolean
  /** A runner whose prompt was never recognised is treated as ready after this long, so a new version of its screen does
   *  not hold every message forever; the settle rule still applies. */
  promptWaitMs?: number
}

/** How long a console waits for its runner's prompt before it falls back to the settle rule alone. */
export const PROMPT_WAIT_MS = 60_000
const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[78=>]/g

type Item = {
  text: string
  options: DeliveryWriteOptions
  resolve: (result: DeliveryWriteResult) => void
  deadline: ReturnType<typeof setTimeout>
  gating: boolean
  done: boolean
  since: number
}

/** Bounded FIFO. Output followed by quiet is only a readiness heuristic.
 * Silence/continuous output never authorize a blind timeout write. Each write
 * consumes the observed output; the next item requires fresh output. */
export class DeliveryQueue {
  private items: Item[] = []
  private closed = false
  private generation = 0
  private consumedGeneration = 0
  private lastOutputAt = 0
  private settleTimer?: ReturnType<typeof setTimeout>
  private busyTimer?: ReturnType<typeof setTimeout>
  private busyHead?: Item
  private readonly busyAfterMs: number | undefined
  private readonly promptDrawn: ((recent: string) => boolean) | undefined
  /** False until the runner's prompt has been seen (or its wait has passed); a queue with no prompt test is ready. */
  private promptReady: boolean
  private recent = ''
  private promptTimer?: ReturnType<typeof setTimeout>
  private readonly settleMs: number
  private readonly maxWaitMs: number
  private readonly capacity: number
  private readonly write: (text: string) => void
  private readonly isRunning: () => boolean

  constructor(write: (text: string) => void, isRunning: () => boolean, timing: DeliveryQueueTiming = {}) {
    this.write = write
    this.isRunning = isRunning
    this.settleMs = timing.settleMs ?? 400
    // A runner whose prompt is awaited is given that wait on top of the usual 30 s, so its first item is not timed out
    // by a start-up that is only slow (its hooks took 10 s on 2026-11-20).
    this.maxWaitMs = timing.maxWaitMs ?? (timing.promptDrawn ? (timing.promptWaitMs ?? PROMPT_WAIT_MS) + 30_000 : 30_000)
    this.capacity = timing.capacity ?? 32
    this.busyAfterMs = timing.busyAfterMs
    this.promptDrawn = timing.promptDrawn
    this.promptReady = !timing.promptDrawn
    if (!this.promptReady) {
      this.promptTimer = setTimeout(() => { this.promptTimer = undefined; this.promptReady = true; this.schedule() }, timing.promptWaitMs ?? PROMPT_WAIT_MS)
      ;(this.promptTimer as { unref?: () => void }).unref?.()
    }
  }

  /** Whether the runner's prompt has been seen (always true for a runner with no prompt test). */
  get ready(): boolean { return this.promptReady }

  enqueue(instruction: string, options: DeliveryWriteOptions = {}): Promise<DeliveryWriteResult> {
    if (this.closed || !this.isRunning()) return Promise.resolve({ state: 'failed_before_write', reason: 'session_closed' })
    if (!instruction.trim()) return Promise.resolve({ state: 'failed_before_write', reason: 'empty_instruction' })
    if (this.items.length >= this.capacity) return Promise.resolve({ state: 'failed_before_write', reason: 'queue_full' })
    return new Promise((resolve) => {
      const item: Item = {
        text: asOnePaste(instruction), options, resolve, gating: false, done: false, since: Date.now(),
        deadline: setTimeout(() => {
          this.finish(item, { state: 'failed_before_write', reason: 'readiness_timeout' })
          this.schedule()
        }, this.maxWaitMs)
      }
      this.items.push(item)
      this.schedule()
    })
  }

  noteOutput(data?: string): void {
    if (this.closed) return
    if (!this.promptReady && data !== undefined && this.promptDrawn) {
      this.recent = (this.recent + data.replace(ANSI, '')).slice(-4096)
      if (this.promptDrawn(this.recent)) {
        this.promptReady = true
        this.recent = ''
        if (this.promptTimer) clearTimeout(this.promptTimer)
        this.promptTimer = undefined
      }
    }
    this.generation++
    this.lastOutputAt = Date.now()
    this.schedule()
  }

  /** Manual terminal input consumes readiness too. Invalidate before the native
   * write so even synchronous output from that write is a fresh observation. */
  noteExternalWrite(): void {
    this.consumedGeneration = this.generation
    this.schedule()
  }

  /** Whether an instruction can still be queued here (ADR-0125: only such a session is attached). */
  get open(): boolean { return !this.closed }

  close(reason = 'session_closed'): void {
    this.closed = true
    if (this.promptTimer) clearTimeout(this.promptTimer)
    this.promptTimer = undefined
    if (this.settleTimer) clearTimeout(this.settleTimer)
    this.settleTimer = undefined
    if (this.busyTimer) clearTimeout(this.busyTimer)
    this.busyTimer = undefined
    this.busyHead = undefined
    for (const item of [...this.items]) this.finish(item, { state: 'failed_before_write', reason })
  }

  private finish(item: Item, result: DeliveryWriteResult): void {
    if (item.done) return
    item.done = true
    clearTimeout(item.deadline)
    this.items = this.items.filter((candidate) => candidate !== item)
    item.resolve(result)
  }

  private schedule(): void {
    if (this.settleTimer) clearTimeout(this.settleTimer)
    this.settleTimer = undefined
    const head = this.items[0]
    // A busy timer armed for another item, or for none, is dropped; one armed for this head is kept, so output that
    // keeps coming does not push it back.
    if (this.busyTimer && (this.busyHead !== head || this.closed || !head || head.gating)) {
      clearTimeout(this.busyTimer)
      this.busyTimer = undefined
      this.busyHead = undefined
    }
    if (this.closed || !head || head.gating) return
    // Before the runner's prompt is drawn nothing is written, busy or quiet: the output that draws it schedules again.
    if (!this.promptReady) return
    // The busy path: due at the item's own age; once past, looked at again every settle period, so it cannot spin.
    if (this.busyAfterMs !== undefined && !head.options.beforeWrite && !head.options.quietOnly && !this.busyTimer) {
      const due = head.since + this.busyAfterMs - Date.now()
      this.busyHead = head
      this.busyTimer = setTimeout(() => {
        this.busyTimer = undefined
        this.busyHead = undefined
        void this.flush(head, true)
      }, due > 0 ? due : this.settleMs)
    }
    if (this.generation <= this.consumedGeneration) return
    this.settleTimer = setTimeout(() => {
      this.settleTimer = undefined
      void this.flush(head)
    }, Math.max(0, this.settleMs - (Date.now() - this.lastOutputAt)))
  }

  private async flush(item: Item, busy = false): Promise<void> {
    if (this.closed || item.done || this.items[0] !== item) return
    if (!this.isRunning()) { this.close(); return }
    if (!this.promptReady) return
    // Even busy, the write needs output the console printed since the last write: never a blind write.
    if (this.generation <= this.consumedGeneration) { if (busy) this.schedule(); return }
    if (!busy && Date.now() - this.lastOutputAt < this.settleMs) { this.schedule(); return }
    if (busy && item.options.beforeWrite) { this.schedule(); return }
    if (item.options.beforeWrite) {
      const observedGeneration = this.generation
      const consumedGeneration = this.consumedGeneration
      item.gating = true
      let allowed = false
      try { allowed = await item.options.beforeWrite() } catch { /* Never expose callback errors or credentials. */ }
      item.gating = false
      // Stop, exit or deadline can settle the item while the gate is in flight.
      if (this.closed || item.done || this.items[0] !== item) return
      if (!this.isRunning()) { this.close(); return }
      if (!allowed) {
        this.finish(item, { state: 'failed_before_write', reason: 'write_gate_refused' })
        this.schedule()
        return
      }
      // A granted durable begin must lead directly to a synchronous write or
      // proof of no write. Keeping it while waiting on more output would reuse
      // authority validated for an older terminal state.
      if (this.generation !== observedGeneration || this.consumedGeneration !== consumedGeneration) {
        this.finish(item, { state: 'failed_before_write', reason: 'readiness_changed' })
        this.schedule()
        return
      }
    }
    // Manual input may have consumed readiness while the gate was awaited.
    if (this.generation <= this.consumedGeneration) return
    this.consumedGeneration = this.generation
    try {
      this.write(item.text)
    } catch {
      // A throwing native write may have transmitted a prefix. Never retry it
      // automatically, or allow queued commands to follow an unknown result.
      this.finish(item, { state: 'outcome_unknown', reason: 'pty_write_failed' })
      this.close('prior_write_unknown')
      return
    }
    this.finish(item, { state: 'written' })
    this.schedule()
  }
}
// #endregion delivery-queue
