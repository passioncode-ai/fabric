// #region console-prompt — docs: docs/evidence/specs/2026-11-21-ceo-triages-questions.md#34-r4-a-console-that-waits-at-a-prompt
/**
 * A console waiting at a prompt, read from its last screen (ADR-0207 Decision 6; the owner, 2026-11-21 04:32: «надо
 * чтобы такие сессии вопросы либо мне присылали если не могут, либо сам агент фабрик отвечал»). The one place that knows
 * the shapes: Claude Code's question menu (AskUserQuestion), a permission or confirmation prompt (Claude Code's and
 * Codex's numbered ones, `[y/N]`, «Press Enter to continue»), and a question the agent typed and stopped on with its
 * prompt drawn. The screen is `shared/ceoAgent.ts#screenText`'s: ANSI removed, blank and repeated lines dropped.
 */
import { createHash } from 'node:crypto'
import { claudePromptDrawn } from './delivery.ts'

export interface PromptOption { key: string; label: string }
export interface ConsolePrompt {
  kind: 'menu' | 'confirm' | 'text'
  question: string
  options: PromptOption[]
  /** The key of the option the screen marks, or null when it marks none (a typed question). */
  selected: string | null
}

/** How many of the screen's last lines a prompt may span; an older menu scrolled above is not waiting. */
const TAIL = 24
/** A spinner line of Claude Code or Codex: the agent is still working, nothing waits. */
const RUNNING = /esc to interrupt|ctrl\+c to interrupt|\bWorking\b.*\(\d+s/i
/** The footer of a menu: Claude Code's «Enter to select · ↑/↓ to navigate · Esc to cancel», Codex's «Press enter to confirm». */
const MENU_FOOTER = /enter to (select|confirm)|esc to cancel|↑\/↓ to navigate/i
/** A question that asks for a go-ahead, which makes a numbered list a confirmation rather than a choice. */
const CONFIRM_QUESTION = /do you want to|allow (command|this|edit)|proceed\?|make this edit|continue\?/i
const OPTION = /^(?:([❯›>])\s*)?(\d{1,2})\.\s+(\S.*)$/
const YES_NO = /^(.*?)\s*[[(]\s*(y|Y)\s*\/\s*(n|N)\s*[\])]\s*:?$/
const PRESS_ENTER = /^press enter to continue\.?$/i

/** A line without the box Claude Code draws around a prompt, and without the reply bullet. */
function bare(line: string): string {
  return line.replace(/^[\s│┃|]+/, '').replace(/[\s│┃|]+$/, '').replace(/^⏺\s*/, '').trim()
}

function isBoxEdge(line: string): boolean {
  return /^[\s]*[╭╰┌└][─━]+[╮╯┐┘]?\s*$/.test(line)
}

/** The input box Claude Code draws at the bottom: the index of its top edge (or of its prompt line), or -1. */
function inputBoxStart(lines: string[]): number {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (bare(lines[i]) !== '>') continue
    return i > 0 && isBoxEdge(lines[i - 1]) ? i - 1 : i
  }
  return -1
}

function numbered(lines: string[], from: number, to: number): { options: PromptOption[]; selected: string | null; first: number; last: number } | null {
  const options: PromptOption[] = []
  let selected: string | null = null
  let first = -1
  let last = -1
  for (let i = from; i < to; i++) {
    const m = OPTION.exec(bare(lines[i]))
    if (!m) continue
    const key = m[2]
    if (options.some(o => o.key === key)) return null
    if (first < 0) first = i
    last = i
    options.push({ key, label: m[3].trim() })
    if (m[1]) selected = key
  }
  if (options.length < 2 || options[0].key !== '1') return null
  return { options, selected, first, last }
}

/** The nearest line above `index` that reads as the question: a line ending in «?» first, else the nearest text line. */
function questionAbove(lines: string[], index: number, floor: number): string | null {
  let nearest: string | null = null
  for (let i = index - 1; i >= floor; i--) {
    const line = bare(lines[i])
    if (!line || isBoxEdge(lines[i]) || /^☐|^☒|^[✔✓]\s/.test(line)) continue
    if (line.endsWith('?')) return line
    nearest ??= line
  }
  return nearest
}

export function promptOnScreen(screen: string): ConsolePrompt | null {
  const all = screen.split('\n').map(l => l.replace(/\s+$/, '')).filter(l => l.trim() !== '')
  if (all.length === 0) return null
  const lines = all.slice(-TAIL)
  if (lines.some(l => RUNNING.test(l))) return null

  // A menu or a numbered confirmation: its options sit just above its footer (Claude Code's question menu, Codex), or
  // close the box of a permission prompt.
  let footer = -1
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 4); i--) if (MENU_FOOTER.test(lines[i])) { footer = i; break }
  let end = footer >= 0 ? footer : lines.length
  while (end > 0 && isBoxEdge(lines[end - 1])) end--
  const list = numbered(lines, Math.max(0, end - 14), end)
  if (list) {
    const question = questionAbove(lines, list.first, 0)
    // Claude Code's input box drawn below the list: the agent typed a numbered question and waits for a typed answer.
    const typed = inputBoxStart(lines) === list.last + 1
    if (question && typed && question.endsWith('?')) return { kind: 'text', question, options: list.options, selected: null }
    // A menu: its footer below, or the list closing the screen (a permission prompt's box, Codex's approval).
    if (question && !typed && (footer >= 0 || end - list.last <= 2)) {
      const confirm = CONFIRM_QUESTION.test(question) || /^yes\b/i.test(list.options[0].label)
      return { kind: confirm ? 'confirm' : 'menu', question, options: list.options, selected: list.selected ?? '1' }
    }
  }

  const last = bare(lines[lines.length - 1])
  const yn = YES_NO.exec(last)
  if (yn) {
    const question = yn[1].trim() || questionAbove(lines, lines.length - 1, 0) || last
    const selected = yn[3] === 'N' ? 'n' : yn[2] === 'Y' ? 'y' : null
    return { kind: 'confirm', question, options: [{ key: 'y', label: 'Yes' }, { key: 'n', label: 'No' }], selected }
  }
  if (PRESS_ENTER.test(last)) return { kind: 'confirm', question: last.replace(/\.$/, ''), options: [{ key: 'enter', label: 'Continue' }], selected: 'enter' }

  // A question the agent typed and stopped on: Claude Code's prompt box is drawn and the last text above it asks.
  if (!claudePromptDrawn(lines.join('\n'))) return null
  const box = inputBoxStart(lines)
  if (box <= 0) return null
  for (let i = box - 1; i >= 0; i--) {
    const line = bare(lines[i])
    if (!line || isBoxEdge(lines[i])) continue
    return line.endsWith('?') ? { kind: 'text', question: line, options: [], selected: null } : null
  }
  return null
}

/** One key per distinct prompt of a session: the same question with the same options is handed to the CEO once, whichever
 *  option the marker is on. */
export function promptKey(sessionId: string, prompt: ConsolePrompt): string {
  const body = JSON.stringify([sessionId, prompt.kind, prompt.question, prompt.options.map(o => [o.key, o.label])])
  return createHash('sha256').update(body).digest('hex').slice(0, 16)
}
// #endregion console-prompt
