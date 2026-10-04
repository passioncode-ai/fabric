// #region hub-consent-prompt — docs: docs/adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md#2-an-agent-is-admitted-by-device-style-consent-not-by-a-pasted-key
// How a consent request reaches the operator (ADR-0115 §2.3).
//
// WITH THE WINDOW IN FRONT — visible, not minimised AND focused (verification iteration 1 for 0.3.1,
// UX-3: a window open behind another app is not one the operator is looking at): a native message box, asynchronous and WITH a parent window — the lesson at
// `index.ts`'s startup dialog: on macOS a message box with no parent runs a modal loop that blocks the
// main thread even through the async API, so no timer fires and SIGTERM goes unanswered.
// OTHERWISE: an OS notification, and the request waits in the attention queue (SCR-41, derived from the
// pending requests, so it leaves when it is answered or expires). Clicking the notification — or the
// window coming forward on its own (`index.ts` calls `bringForward` on focus) — shows the same prompt.
//
// IN THE OPERATOR'S LANGUAGE (UX-2): every word comes from the i18n registries through `say()`, the same
// keys the queue and Settings → Agent access use (`shared/accessWords.ts`).
//
// ONE PROMPT AT A TIME. Requests that arrive while one is open wait their turn, and a request that
// expired or was answered elsewhere (the queue, the settings list) is skipped rather than shown.

import { pendingFacts } from '../shared/access.ts'
import type { ConnectProblem } from '../shared/access.ts'
import type { AccessActRefusal } from '../shared/accessActs.ts'
import { consentPrompt, sayActRefusal, sayConnectDetail, sayConnectProblem, type Say } from '../shared/accessWords.ts'
import { translator } from '../renderer/src/i18n/translate.ts'
import type { ConsentRequest } from './accessService.ts'
import { ops } from './opsSink.ts'

export interface PresenterWindow {
  isVisible(): boolean
  isMinimized(): boolean
  isFocused(): boolean
  isDestroyed(): boolean
  show(): void
  focus(): void
}

export interface ConsentPresenterDeps {
  /** The main window, or null when none exists. */
  window: () => PresenterWindow | null
  /** `dialog.showMessageBox(parent, options)` — always with a parent. */
  showMessageBox: (parent: PresenterWindow, options: { type: 'question' | 'warning'; title: string; message: string; detail: string; buttons: string[]; defaultId: number; cancelId: number; noLink: true }) => Promise<{ response: number }>
  /** An OS notification; `onClick` brings the prompt forward. Returns false when none could be shown. */
  notify: (title: string, body: string, onClick: () => void) => boolean
  /** Opens the main window when there is none, so a clicked notification has somewhere to land. */
  openWindow: () => void
  decide: (requestId: string, decision: 'allowed' | 'denied') => Promise<{ ok: true } | { ok: false; reason: string; code?: AccessActRefusal }>
  /** Starts the product's connect flow after an Allow when the product is not connected yet. */
  connect: (product: string) => Promise<{ ok: true } | { ok: false; reason: string; problem?: ConnectProblem }>
  /** The operator's language, read when a prompt is made (the app's settings); English by default. */
  say?: () => Say
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

  private say(): Say {
    return this.deps.say?.() ?? translator('en')
  }

  /** A window a sheet can hang from: shown and not minimised. */
  private parentWindow(): PresenterWindow | null {
    const w = this.deps.window()
    return w && !w.isDestroyed() && w.isVisible() && !w.isMinimized() ? w : null
  }

  /** The operator is looking at Fabric: a parent window that also has focus (UX-3). */
  private inFront(): PresenterWindow | null {
    const w = this.parentWindow()
    return w && w.isFocused() ? w : null
  }

  present(request: ConsentRequest): void {
    this.queue.push(request)
    if (this.inFront()) void this.next()
    else {
      const say = this.say()
      const text = consentPrompt(say, this.facts(request))
      const shown = this.deps.notify(text.statement, say('access.prompt.notify'), () => this.bringForward())
      ops.record({ op: 'hub.consent.notified', outcome: 'ok', level: shown ? 'info' : 'warn', detail: { request_id: request.row.id, shown }, ctx: { correlationId: ops.correlate() } })
    }
  }

  /** The window came forward on its own (focus, show): show what is waiting, if anything (UX-3). */
  resume(): void {
    if (this.queue.length && this.inFront()) void this.next()
  }

  /** The notification was clicked: bring the window forward and show what is waiting. */
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

  private facts(request: ConsentRequest) {
    return pendingFacts(request.row, request.connected)
  }

  private async next(): Promise<void> {
    if (this.showing) return
    if (!this.inFront()) return
    // Own the queue before the first await, not only while a native sheet is visible.
    this.showing = true
    let request: ConsentRequest | undefined
    try {
      while ((request = this.queue.shift())) {
        if (Date.parse(request.row.expires_at) <= (this.deps.now ?? Date.now)()) continue
        let pending = false
        try {
          pending = await this.deps.stillPending(request.row.id)
        } catch (e) {
          // Shown anyway: a decision on a request that was already answered is refused by the service
          // with its reason, which is better than a request the operator never sees.
          ops.failed('hub.consent.pending-read', e, { request_id: request.row.id })
          pending = true
        }
        if (pending && Date.parse(request.row.expires_at) > (this.deps.now ?? Date.now)()) break
      }
      if (!request) return
      // Authority and the parent may change while the read waits. Keep a live request queued
      // if the operator moved away; the next focus/resume event will retry its pending read.
      const parent = this.inFront()
      if (!parent) { this.queue.unshift(request); return }
      const say = this.say()
      const facts = this.facts(request)
      const text = consentPrompt(say, facts)
      const { response } = await this.deps.showMessageBox(parent, { type: 'question', title: text.title, message: text.message, detail: text.detail, buttons: text.buttons, defaultId: text.defaultId, cancelId: text.cancelId, noLink: true })
      const decision = response === 1 ? 'allowed' : 'denied'
      const done = await this.deps.decide(request.row.id, decision)
      if (!done.ok) {
        await this.deps.showMessageBox(parent, { type: 'warning', title: say('access.prompt.notRecordedTitle'), message: say('access.prompt.notRecorded'), detail: done.code ? sayActRefusal(say, done.code) : done.reason, buttons: [say('access.prompt.ok')], defaultId: 0, cancelId: 0, noLink: true })
      } else if (decision === 'allowed' && !request.connected) {
        const started = await this.deps.connect(request.row.callee)
        if (!started.ok) {
          // The Allow stands; the operator is told the product did not open, and where to connect it (UX-5).
          ops.record({ op: 'hub.consent.connect', outcome: 'failed', level: 'warn', detail: { product: request.row.callee, reason: started.reason }, ctx: { correlationId: ops.correlate() } })
          const problem = started.problem ? sayConnectProblem(say, started.problem, facts.product) : started.reason
          // The machine's words are the box's detail, never inside the sentence (iteration 2, UX-5).
          const saw = started.problem ? sayConnectDetail(say, started.problem) : null
          await this.deps.showMessageBox(parent, { type: 'warning', title: say('access.prompt.connectTitle'), message: say('access.allowedConnect', { problem }), detail: saw ?? '', buttons: [say('access.prompt.ok')], defaultId: 0, cancelId: 0, noLink: true })
        }
      }
      this.deps.changed?.()
    } catch (e) {
      ops.failed('hub.consent.prompt', e, { request_id: request?.row.id })
    } finally {
      this.showing = false
    }
    if (this.queue.length && this.inFront()) void this.next()
  }
}
// #endregion hub-consent-prompt
