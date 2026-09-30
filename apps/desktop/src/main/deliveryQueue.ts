import { asOnePaste } from '../shared/delivery.ts'

/** A PTY write receipt is not an acknowledgement that an agent accepted work. */
export type DeliveryWriteResult = {
  state: 'written' | 'failed_before_write' | 'outcome_unknown'
  reason?: string
}
export type DeliveryWriteOptions = { beforeWrite?: () => Promise<boolean> }
export type DeliveryQueueTiming = { settleMs?: number; maxWaitMs?: number; capacity?: number }

type Item = {
  text: string
  options: DeliveryWriteOptions
  resolve: (result: DeliveryWriteResult) => void
  deadline: ReturnType<typeof setTimeout>
  gating: boolean
  done: boolean
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
  private readonly settleMs: number
  private readonly maxWaitMs: number
  private readonly capacity: number
  private readonly write: (text: string) => void
  private readonly isRunning: () => boolean

  constructor(write: (text: string) => void, isRunning: () => boolean, timing: DeliveryQueueTiming = {}) {
    this.write = write
    this.isRunning = isRunning
    this.settleMs = timing.settleMs ?? 400
    this.maxWaitMs = timing.maxWaitMs ?? 30_000
    this.capacity = timing.capacity ?? 32
  }

  enqueue(instruction: string, options: DeliveryWriteOptions = {}): Promise<DeliveryWriteResult> {
    if (this.closed || !this.isRunning()) return Promise.resolve({ state: 'failed_before_write', reason: 'session_closed' })
    if (!instruction.trim()) return Promise.resolve({ state: 'failed_before_write', reason: 'empty_instruction' })
    if (this.items.length >= this.capacity) return Promise.resolve({ state: 'failed_before_write', reason: 'queue_full' })
    return new Promise((resolve) => {
      const item: Item = {
        text: asOnePaste(instruction), options, resolve, gating: false, done: false,
        deadline: setTimeout(() => {
          this.finish(item, { state: 'failed_before_write', reason: 'readiness_timeout' })
          this.schedule()
        }, this.maxWaitMs)
      }
      this.items.push(item)
      this.schedule()
    })
  }

  noteOutput(): void {
    if (this.closed) return
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

  close(reason = 'session_closed'): void {
    this.closed = true
    if (this.settleTimer) clearTimeout(this.settleTimer)
    this.settleTimer = undefined
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
    if (this.closed || !head || head.gating || this.generation <= this.consumedGeneration) return
    this.settleTimer = setTimeout(() => {
      this.settleTimer = undefined
      void this.flush(head)
    }, Math.max(0, this.settleMs - (Date.now() - this.lastOutputAt)))
  }

  private async flush(item: Item): Promise<void> {
    if (this.closed || item.done || this.items[0] !== item) return
    if (!this.isRunning()) { this.close(); return }
    if (this.generation <= this.consumedGeneration) return
    if (Date.now() - this.lastOutputAt < this.settleMs) { this.schedule(); return }
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
