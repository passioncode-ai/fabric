// #region console-handoff — docs: docs/evidence/specs/2026-11-21-ceo-triages-questions.md#34-r4-a-console-that-waits-at-a-prompt
/**
 * A console that waits at a prompt goes to the CEO first (ADR-0207 Decision 6; the owner, 2026-11-21 04:32: «надо чтобы
 * такие сессии вопросы либо мне присылали если не могут, либо сам агент фабрик отвечал»). From main's minute timer:
 *
 * - a running console Fabric holds, quiet for QUIET_MS, with no key from the person for PERSON_IDLE_MS, whose last
 *   screen shows a prompt (`shared/consolePrompt.ts#promptOnScreen`), is typed into the CEO's running console once per
 *   distinct prompt (`promptKey`), with the session, its project and task, the question, the options with their keys and
 *   Fabric's recommendation (the option the screen marks);
 * - the CEO's own console is never handed to itself;
 * - a CEO that is not running is started (`ensure`, at most once per WAKE_GAP_MS); one the person stopped or that failed
 *   cannot answer, so the prompt goes to the owner at once (`escalate`, by `ceo-cannot-run`);
 * - a prompt still on the screen ESCALATE_MS after it was first seen goes to the owner (`escalate`, by `triage-timeout`):
 *   nothing waits on a busy or absent CEO;
 * - a prompt that changed or went away is forgotten; the next one is a new prompt.
 */
import type { CeoState } from '../shared/ceoAgent.ts'
import { promptKey, promptOnScreen, type ConsolePrompt } from '../shared/consolePrompt.ts'

export const QUIET_MS = 20_000
export const PERSON_IDLE_MS = 2 * 60_000
export const ESCALATE_MS = 10 * 60_000
export const WAKE_GAP_MS = 5 * 60_000

export interface WatchedConsole {
  sessionId: string
  /** The project the console works for; a prompt of a console with none cannot be filed as a question. */
  projectId: string | null
  running: boolean
  /** When the console last printed (`TerminalSession.lastOutputAt`), ms; null when it never did. */
  lastOutputAt: number | null
  /** When the person last typed into it, ms; null when never. */
  lastTypedAt: number | null
  /** The names the CEO reads: the session's agent name, its project's, its task's title. */
  name: string
  project: string | null
  task: string | null
}

export type EscalateBy = 'triage-timeout' | 'ceo-cannot-run'

export interface ConsoleHandoffDeps {
  consoles(): readonly WatchedConsole[] | Promise<readonly WatchedConsole[]>
  screen(sessionId: string): string
  ceoSessionId(): string | null
  ceoState(): CeoState
  ceoHeld?(): boolean
  ensure(): Promise<unknown>
  /** Types a line into the CEO's console; `written` when it was. */
  deliver(sessionId: string, line: string): Promise<{ state: string }>
  /** Files the prompt as the owner's question (a board question, asker the waiting session); true when filed. */
  escalate(console: WatchedConsole, prompt: ConsolePrompt, by: EscalateBy): Promise<boolean>
  record(op: string, outcome: 'ok' | 'failed', detail: Record<string, unknown>): void
  now?: () => number
}

/** The line the CEO reads for one waiting console. */
export function consoleHandoffLine(c: WatchedConsole, p: ConsolePrompt, sessionId: string): string {
  const where = [c.project ? `проект ${c.project}` : null, c.task ? `задача «${c.task.slice(0, 120)}»` : null].filter(Boolean).join(', ')
  const head = `Консоль ${c.name} (${sessionId}${where ? `, ${where}` : ''}) ждёт ответа: «${p.question.slice(0, 400)}».`
  const options = p.options.length ? ` Варианты: ${p.options.map((o) => `${o.key}: ${o.label.slice(0, 120)}`).join('; ')}.` : ''
  const advice = p.selected ? ` На экране выбран вариант ${p.selected}.` : ''
  const how = p.kind === 'menu' || p.kind === 'confirm'
    ? ' Ответь клавишами через fabric_ceo_input (цифра варианта или y/n, затем enter), если решение следует из решений владельца или из кода.'
    : ' Ответь текстом и enter через fabric_ceo_input, если ответ следует из решений владельца или из кода.'
  return `${head}${options}${advice}${how} Если решать владельцу, не отвечай: через 10 минут Fabric сам отправит вопрос владельцу.`
}

interface Seen { key: string; prompt: ConsolePrompt; firstAt: number; toldAt: number | null; escalated: boolean }

export function createConsoleHandoff(deps: ConsoleHandoffDeps) {
  const now = deps.now ?? Date.now
  const seen = new Map<string, Seen>()
  let lastWake = 0
  let running = false

  async function escalate(c: WatchedConsole, s: Seen, by: EscalateBy): Promise<void> {
    let filed = false
    try { filed = await deps.escalate(c, s.prompt, by) } catch (e) { // recorded below through deps.record (the ops log), never silent
      deps.record('ceo.console-escalate', 'failed', { session_id: c.sessionId, by, error_class: e instanceof Error ? e.constructor.name : typeof e })
      return
    }
    s.escalated = filed
    deps.record('ceo.console-escalate', filed ? 'ok' : 'failed', { session_id: c.sessionId, by, kind: s.prompt.kind })
  }

  async function tick(): Promise<number> {
    if (running) return 0
    running = true
    let handed = 0
    try {
      const t = now()
      const ceo = deps.ceoSessionId()
      const consoles = await deps.consoles()
      for (const id of [...seen.keys()]) if (!consoles.some((c) => c.sessionId === id && c.running)) seen.delete(id)
      for (const c of consoles) {
        if (!c.running || c.sessionId === ceo) continue
        if (c.lastOutputAt !== null && t - c.lastOutputAt < QUIET_MS) continue
        if (c.lastTypedAt !== null && t - c.lastTypedAt < PERSON_IDLE_MS) continue
        const prompt = promptOnScreen(deps.screen(c.sessionId))
        if (!prompt) { seen.delete(c.sessionId); continue }
        const key = promptKey(c.sessionId, prompt)
        let s = seen.get(c.sessionId)
        if (!s || s.key !== key) { s = { key, prompt, firstAt: t, toldAt: null, escalated: false }; seen.set(c.sessionId, s) }
        if (s.escalated) continue
        if (t - s.firstAt >= ESCALATE_MS) { await escalate(c, s, 'triage-timeout'); continue }
        if (s.toldAt !== null) continue
        const state = deps.ceoState()
        if (state === 'running' && ceo) {
          const r = await deps.deliver(ceo, consoleHandoffLine(c, prompt, c.sessionId))
          deps.record('ceo.console-handoff', r.state === 'written' ? 'ok' : 'failed', { session_id: c.sessionId, kind: prompt.kind, state: r.state })
          if (r.state === 'written') { s.toldAt = t; handed++ }
        } else if (deps.ceoHeld?.() || state === 'stopped' || state === 'failed') {
          await escalate(c, s, 'ceo-cannot-run')
        } else if (state !== 'starting' && (!lastWake || t - lastWake >= WAKE_GAP_MS)) {
          lastWake = t
          try { await deps.ensure() } catch (e) { // recorded through deps.record; the next tick tries the hand-off again
            deps.record('ceo.console-wake', 'failed', { error_class: e instanceof Error ? e.constructor.name : typeof e })
          }
        }
      }
      return handed
    } finally { running = false }
  }

  return { tick, waiting: () => seen.size }
}
// #endregion console-handoff
