// #region hub-consent-prompt — docs: docs/adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md#2-an-agent-is-admitted-by-device-style-consent-not-by-a-pasted-key
// How a consent request reaches the operator (ADR-0115 §2.3).
//
// WITH A WINDOW ON SCREEN: a native message box, asynchronous and WITH a parent window — the lesson at
// `index.ts`'s startup dialog: on macOS a message box with no parent runs a modal loop that blocks the
// main thread even through the async API, so no timer fires and SIGTERM goes unanswered.
// IN THE BACKGROUND: an OS notification, and the request waits in the attention queue (SCR-24/SCR-41,
// derived from the pending requests, so it leaves when it is answered or expires). Clicking the
// notification brings the window forward and shows the same prompt.
//
// ONE PROMPT AT A TIME. Requests that arrive while one is open wait their turn, and a request that
// expired or was answered elsewhere (the queue, the settings list) is skipped rather than shown.

import { consentText } from '../shared/access.ts'
import type { ConsentRequest } from './accessService.ts'
import { ops } from './opsSink.ts'

export interface PresenterWindow {
  isVisible(): boolean
  isMinimized(): boolean
  isDestroyed(): boolean
  show(): void
  focus(): void
}

export interface ConsentPresenterDeps {
  /** The main window, or null when none exists. */
  window: () => PresenterWindow | null
  /** `dialog.showMessageBox(parent, options)` — always with a parent. */
  showMessageBox: (parent: PresenterWindow, options: { type: 'question'; title: string; message: string; detail: string; buttons: string[]; defaultId: number; cancelId: number; noLink: true }) => Promise<{ response: number }>
  /** An OS notification; `onClick` brings the prompt forward. Returns false when none could be shown. */
  notify: (title: string, body: string, onClick: () => void) => boolean
  /** Opens the main window when there is none, so a clicked notification has somewhere to land. */
  openWindow: () => void
  decide: (requestId: string, decision: 'allowed' | 'denied') => Promise<{ ok: true } | { ok: false; reason: string }>
  /** Starts the product's connect flow after an Allow when the product is not connected yet. */
  connect: (product: string) => Promise<{ ok: true } | { ok: false; reason: string }>
  /** Is the request still waiting? The queue and the settings list can answer it first. */
  stillPending: (requestId: string) => Promise<boolean>
  /** Told after every decision, so the screens re-read. */
  changed?: () => void
  now?: () => number
}

export class ConsentPresenter {
  private deps: ConsentPresenterDeps
  private queue: ConsentRequest[] = []
  private showing = false

  // Assigned in the body: Node's type-stripping loader rejects parameter properties.
  constructor(deps: ConsentPresenterDeps) {
    this.deps = deps
  }

  /** How many requests are waiting for their prompt (not counting the one on screen). */
  waiting(): number {
    return this.queue.length
  }

  private visibleWindow(): PresenterWindow | null {
    const w = this.deps.window()
    return w && !w.isDestroyed() && w.isVisible() && !w.isMinimized() ? w : null
  }

  present(request: ConsentRequest): void {
    this.queue.push(request)
    if (this.visibleWindow()) void this.next()
    else {
      const text = consentText(this.textInput(request))
      const shown = this.deps.notify(text.message, 'Open Fabric to allow or deny. It also waits in your queue.', () => this.bringForward())
      ops.record({ op: 'hub.consent.notified', outcome: 'ok', level: shown ? 'info' : 'warn', detail: { request_id: request.row.id, shown }, ctx: { correlationId: ops.correlate() } })
    }
  }

  /** The notification was clicked, or the window came back: show what is waiting. */
  bringForward(): void {
    let w = this.deps.window()
    if (!w || w.isDestroyed()) {
      this.deps.openWindow()
      w = this.deps.window()
    }
    w?.show()
    w?.focus()
    void this.next()
  }

  private textInput(request: ConsentRequest) {
    const r = request.row
    return { agentId: r.agent_id, registry: r.registry ?? {}, callee: r.callee, capabilities: r.capabilities, resources: r.resources, reason: r.reason, connected: request.connected, incremental: r.asked_by_binding !== null }
  }

  private async next(): Promise<void> {
    if (this.showing) return
    const parent = this.visibleWindow()
    if (!parent) return
    const now = (this.deps.now ?? Date.now)()
    let request: ConsentRequest | undefined
    while ((request = this.queue.shift())) {
      if (Date.parse(request.row.expires_at) <= now) continue
      let pending = false
      try {
        pending = await this.deps.stillPending(request.row.id)
      } catch (e) {
        // Shown anyway: a decision on a request that was already answered is refused by the service
        // with its reason, which is better than a request the operator never sees.
        ops.failed('hub.consent.pending-read', e, { request_id: request.row.id })
        pending = true
      }
      if (pending) break
    }
    if (!request) return
    this.showing = true
    try {
      const text = consentText(this.textInput(request))
      const { response } = await this.deps.showMessageBox(parent, { type: 'question', title: text.title, message: text.message, detail: text.detail, buttons: text.buttons, defaultId: text.defaultId, cancelId: text.cancelId, noLink: true })
      const decision = response === 1 ? 'allowed' : 'denied'
      const done = await this.deps.decide(request.row.id, decision)
      if (!done.ok) {
        await this.deps.showMessageBox(parent, { type: 'question', title: 'Not recorded', message: 'Your answer was not recorded', detail: done.reason, buttons: ['OK'], defaultId: 0, cancelId: 0, noLink: true })
      } else if (decision === 'allowed' && !request.connected) {
        const started = await this.deps.connect(request.row.callee)
        if (!started.ok) ops.record({ op: 'hub.consent.connect', outcome: 'failed', level: 'warn', detail: { product: request.row.callee, reason: started.reason }, ctx: { correlationId: ops.correlate() } })
      }
      this.deps.changed?.()
    } catch (e) {
      ops.failed('hub.consent.prompt', e, { request_id: request.row.id })
    } finally {
      this.showing = false
    }
    if (this.queue.length) void this.next()
  }
}
// #endregion hub-consent-prompt
