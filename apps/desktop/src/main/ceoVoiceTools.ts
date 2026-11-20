// #region ceo-voice-tools — docs: docs/reports/2026-11-20-voice-ceo-retro/fixes.md#10-missing-voice-tools
/**
 * The voice call's own tools, beside the session tools it shares with the CEO's console (`ceoTools.ts`) and ask_ceo
 * (voice CEO retro 2026-11-20, findings 7 and 10):
 *
 *   ceo_reply       wait for the CEO's answer to what ask_ceo handed it and read it, so the voice can say it aloud
 *   machine_status  this computer's disk, load and memory, and how many consoles run
 *   board_search    the project board's messages by words, through the operator's read door
 *   recap           what changed since the previous call: sessions started and ended, and what runs now
 *
 * What the voice does NOT get here, by design: a message to the owner (the voice holds no messaging credential; it
 * asks the CEO, whose console sends through the personal communicator), and a second copy of any session tool.
 */
import { redact } from '../shared/redact.ts'
import type { Launch } from '../shared/sessionLaunches.ts'

export const CEO_REPLY_WAIT_S = 25
export const CEO_REPLY_MAX_S = 60
/** The CEO's console quiet this long after an answer started: the answer is read as finished. */
export const CEO_QUIET_MS = 4000
const POLL_MS = 1500
/** How long the console's echo of the ask itself may print after it. */
const ECHO_MS = 2000

export const VOICE_TOOLS = [
  {
    type: 'function' as const,
    name: 'ceo_reply',
    description: 'Wait for the CEO agent\'s answer to the request you handed it with ask_ceo, and read it to say it aloud. Call it right after ask_ceo when the owner waits for the answer; when it answers still_working, tell the owner the CEO is on it and call it again in a while.',
    parameters: { type: 'object', properties: { wait_seconds: { type: 'integer', minimum: 0, maximum: CEO_REPLY_MAX_S, description: `How long to wait for the answer; ${CEO_REPLY_WAIT_S} by default.` } }, additionalProperties: false }
  },
  {
    type: 'function' as const,
    name: 'machine_status',
    description: 'This computer now: free disk, load, memory, and how many consoles and Claude Code sessions run. Use it for «как там компьютер», «сколько места».',
    parameters: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    type: 'function' as const,
    name: 'board_search',
    description: 'Search the project board\'s messages (requests between projects, answers, findings) by words, newest first. Use it for «что писали про …», «кто просил …».',
    parameters: { type: 'object', properties: { query: { type: 'string', minLength: 2, maxLength: 200, description: 'The words to search for.' } }, required: ['query'], additionalProperties: false }
  },
  {
    type: 'function' as const,
    name: 'recap',
    description: 'What changed since the previous call: which sessions started (who started them and why) and which ended, and what runs now. Use it when the owner asks «что нового», «что изменилось».',
    parameters: { type: 'object', properties: {}, additionalProperties: false }
  }
]

export interface MachineFacts { diskFreeGb: number | null; diskTotalGb: number | null; load1: number; cpus: number; memFreeGb: number; memTotalGb: number; uptimeHours: number }

export interface VoiceToolDeps {
  now?: () => number
  sleep?: (ms: number) => Promise<void>
  /** When ask_ceo last handed the CEO a request in this call; null before one. */
  askedAt(): number | null
  /** When the ask's line was written into the CEO's console (its echo follows); absent: the ask's own time. */
  askWrittenAt?(): number | null
  /** The ask still waits in the CEO's queue, not typed yet (run five, DO-46). */
  askWaiting?(): boolean
  /** The queue's write of the waiting ask broke off: it may have gone in (run six, UX-56). */
  askUnknown?(): boolean
  /** The CEO console's Claude Code transcript (its tail), or null when it has none (another runner, not found). */
  ceoTranscript(): Promise<string | null>
  /** The CEO console's screen, redacted, its last lines; '' when it does not run. */
  ceoScreen(): string
  /** When the CEO's console last printed; null when it does not run. */
  ceoLastActivity(): number | null
  machine(): MachineFacts
  consolesRunning(): number
  claudeSessions?(): Promise<number>
  boardSearch(query: string): Promise<{ ok: true; hits: Array<{ snippet: string; subject?: string | null; at: string; participants?: string[] }>; more: boolean } | { ok: false; reason?: string; message?: string }>
  launches(): Promise<Launch[]>
  /** When the previous call ended (the newest finished call before this one), ISO; null when none is kept. */
  previousCallEnd(): string | null
  /** Project names by id, read once per recap (0.3.27 review, UX-11, DA-6, DO-8); an empty map leaves folder names. */
  projectNames(): Promise<Map<string, string>>
}

type Answer = Record<string, unknown>

/** How long before the ask the CEO's own record of the request may be stamped (clocks and the console's write). */
const ASK_SLACK_MS = 2000

/** The CEO's words in answer to the ask made at `since`: the text of its assistant turns after the first person's turn
 *  recorded at or after the ask (0.3.27 review, UX-14: a CEO busy at the ask still finishes the previous answer, which is
 *  not this one), in order, tools named but not their output. No person's turn yet: no answer yet. */
export function assistantSince(jsonl: string, since: number): { text: string; turns: number; lastAt: number | null } {
  const parts: string[] = []
  let turns = 0
  let lastAt: number | null = null
  let asked = false
  for (const line of jsonl.split('\n')) {
    if (!line.trim()) continue
    let row: { type?: unknown; timestamp?: unknown; message?: { content?: unknown } }
    try { row = JSON.parse(line) } catch { continue /* a line cut while being written */ }
    const at = typeof row.timestamp === 'string' ? Date.parse(row.timestamp) : NaN
    if (!Number.isFinite(at) || at < since - ASK_SLACK_MS) continue
    // A tool's result is also a «user» row in Claude Code's transcript; only the person's words open the answer (UX-17).
    if (row.type === 'user') {
      const c = row.message?.content
      const words = typeof c === 'string' ? c.trim().length > 0 : Array.isArray(c) && (c as Array<Record<string, unknown>>).some((x) => x?.type === 'text')
      if (words) asked = true
      continue
    }
    if (row.type !== 'assistant' || !asked) continue
    const content = row.message?.content
    const text = typeof content === 'string' ? content
      : Array.isArray(content) ? (content as Array<Record<string, unknown>>).filter((c) => c?.type === 'text' && typeof c.text === 'string').map((c) => c.text as string).join(' ') : ''
    if (!text.trim()) continue
    parts.push(text.trim())
    turns++
    lastAt = at
  }
  return { text: parts.join('\n'), turns, lastAt }
}

export function createVoiceTools(deps: VoiceToolDeps) {
  const now = deps.now ?? Date.now
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))

  async function ceoReply(a: { wait_seconds?: unknown }): Promise<Answer> {
    const asked = deps.askedAt()
    if (asked === null) return { ok: false, reason: 'nothing was handed to the CEO in this call: use ask_ceo first' }
    // Run six, UX-54: a CEO that is not running is said first; a waiting ask there waits for the owner's start.
    if (deps.ceoLastActivity() === null) return { ok: false, reason: 'the CEO console is not running: its answer cannot be read now', next: 'tell the owner to start the CEO from its window; do not ask again' }
    if (deps.askUnknown?.()) return { ok: false, state: 'unknown', reason: 'the write of the ask to the CEO console broke off and may have gone in', next: 'do not ask again; tell the owner to check the CEO window' }
    if (deps.askWaiting?.()) return { ok: false, state: 'queued', reason: 'the ask still waits in the CEO\'s queue: its console has not taken it yet', next: 'do not ask again; tell the owner it waits, and try ceo_reply in a while' }
    const waitS = typeof a.wait_seconds === 'number' && Number.isFinite(a.wait_seconds) ? Math.max(0, Math.min(CEO_REPLY_MAX_S, Math.round(a.wait_seconds))) : CEO_REPLY_WAIT_S
    const until = now() + waitS * 1000
    for (;;) {
      const jsonl = await deps.ceoTranscript().catch(() => null)
      const last = deps.ceoLastActivity()
      const quiet = last !== null && now() - last >= CEO_QUIET_MS
      // Printed since the ask: on another runner, quiet alone would read a CEO still thinking as answered (ER-6).
      // The ask's own echo prints at once; output only after the echo window counts (ER-16).
      const printedSinceAsk = last !== null && last > (deps.askWrittenAt?.() ?? asked) + ECHO_MS
      if (jsonl !== null) {
        // Run six, UX-55: from when the ask was written, so an answer to an earlier line is not read as this one's.
        const r = assistantSince(jsonl, deps.askWrittenAt?.() ?? asked)
        if (r.turns > 0 && quiet) return { ok: true, state: 'answered', answer: redact(r.text).text.slice(-3000), turns: r.turns }
        if (now() >= until) {
          return r.turns > 0
            ? { ok: true, state: 'still_working', so_far: redact(r.text).text.slice(-1500), next: 'tell the owner the CEO is still on it; call ceo_reply again in a while' }
            : { ok: true, state: 'still_working', next: 'the CEO has not answered yet: tell the owner it is on it, and call ceo_reply again in a while' }
        }
      } else if (now() >= until || (quiet && printedSinceAsk)) {
        // No transcript (the CEO runs on another runner): its screen is what it said.
        return { ok: true, state: quiet && printedSinceAsk ? 'answered' : 'still_working', screen: deps.ceoScreen().slice(-3000), note: 'read from the CEO console\'s screen' }
      }
      await sleep(POLL_MS)
    }
  }

  async function machineStatus(): Promise<Answer> {
    const m = deps.machine()
    const claude = deps.claudeSessions ? await deps.claudeSessions().catch(() => null) : null
    return {
      ok: true,
      disk_free_gb: m.diskFreeGb, disk_total_gb: m.diskTotalGb, load_1min: Math.round(m.load1 * 100) / 100, cpus: m.cpus,
      memory_free_gb: m.memFreeGb, memory_total_gb: m.memTotalGb, uptime_hours: m.uptimeHours,
      fabric_consoles_running: deps.consolesRunning(), ...(claude !== null ? { claude_code_sessions: claude } : {})
    }
  }

  async function boardSearch(a: { query?: unknown }): Promise<Answer> {
    const q = typeof a.query === 'string' ? a.query.trim() : ''
    if (q.length < 2) return { ok: false, reason: 'say at least two letters to search for' }
    const r = await deps.boardSearch(q)
    if (!r.ok) return { ok: false, reason: `the board was not read: ${r.reason ?? r.message ?? 'unavailable'}` }
    return {
      ok: true, more: r.more,
      hits: r.hits.slice(0, 10).map((h) => ({ at: h.at, subject: h.subject ? redact(h.subject).text : null, snippet: redact(h.snippet).text.slice(0, 300), participants: h.participants ?? [] }))
    }
  }

  async function recap(): Promise<Answer> {
    const since = deps.previousCallEnd()
    const sinceMs = since ? Date.parse(since) : now() - 24 * 3_600_000
    const all = await deps.launches().catch(() => [] as Launch[])
    const names = await deps.projectNames().catch(() => new Map<string, string>())
    const name = (l: Launch): string => names.get(l.projectId) ?? l.cwd.split('/').pop() ?? l.projectId
    const started = all.filter((l) => Date.parse(l.startedAt) >= sinceMs).slice(0, 20)
      .map((l) => ({ session_id: l.sessionId, project: name(l), runner: l.optionId, by: l.by, via: l.via, reason: l.reason ? redact(l.reason).text.slice(0, 200) : null, at: l.startedAt }))
    const ended = all.filter((l) => l.endedAt && Date.parse(l.endedAt) >= sinceMs).slice(0, 20)
      .map((l) => ({ session_id: l.sessionId, project: name(l), end: l.end, exit_code: l.exitCode, at: l.endedAt }))
    return { ok: true, since: since ?? new Date(sinceMs).toISOString(), since_is: since ? 'the previous call' : 'the last 24 hours (no earlier call kept)', started, ended, consoles_running: deps.consolesRunning() }
  }

  const table: Record<string, (a: Record<string, unknown>) => Promise<Answer>> = {
    ceo_reply: ceoReply, machine_status: machineStatus, board_search: boardSearch, recap
  }

  /** Run a voice tool by name; null when the name is not one of these (the caller tries the others). */
  async function run(name: string, args: unknown): Promise<Answer | null> {
    const fn = table[name]
    if (!fn) return null
    const a = args && typeof args === 'object' ? (args as Record<string, unknown>) : {}
    try { return await fn(a) } catch (e) { return { ok: false, reason: e instanceof Error ? e.message.slice(0, 300) : String(e) } }
  }

  return { run, names: Object.keys(table) }
}
// #endregion ceo-voice-tools
