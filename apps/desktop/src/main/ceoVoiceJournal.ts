// #region ceo-voice-journal — docs: docs/reports/2026-11-20-voice-ceo-retro/fixes.md#1-the-call-journal
/**
 * The voice call's journal (voice CEO retro 2026-11-20, finding 1): what the owner said, what the voice answered, every
 * tool it called with its arguments and answer, the call's length and its price, kept on this computer so a call can
 * be read again, by the owner, by the CEO and by the next retro. Before it, the lines lived only in the window.
 *
 * One file a call, `calls/<UTC start>-<id8>.jsonl` in the CEO's folder (the CEO's console reads it there), the folder
 * 0700 and each file 0600, appended line by line. Private by construction: every text and every argument passes
 * Fabric's redaction (`shared/redact.ts`) before it is written, and nothing is sent anywhere. Each line carries the
 * turn it belongs to (a person's line opens a turn; the tools called after it carry its number), so a reply and the
 * tools behind it are read together. Bounded: a line at most LINE_CHARS, a call at most CALL_BYTES (past it one
 * `cut` line, then only the end), files older than KEEP_DAYS removed at start. A write that fails is counted, never
 * thrown into the call.
 */
import { appendFileSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { redact } from '../shared/redact.ts'

export const KEEP_DAYS = 30
export const LINE_CHARS = 4000
export const CALL_BYTES = 2 * 1024 * 1024
export const CALLS_FOLDER = 'calls'

export type JournalEntry =
  | { t: string; kind: 'start'; call: string; voice: string; usd_per_minute: number }
  | { t: string; kind: 'person' | 'ceo'; turn: number; text: string }
  | { t: string; kind: 'tool'; turn: number; name: string; args: string; ok: boolean; answer: string; ms: number }
  | { t: string; kind: 'cut'; bytes: number }
  | { t: string; kind: 'end'; minutes: number; usd: number; end: string | null; turns: number; tools: number }

export interface CallSummary { call: string; file: string; startedAt: string; minutes: number | null; usd: number | null; end: string | null; turns: number; tools: number }

export interface VoiceJournalDeps {
  folder: string
  now?: () => number
  /** A write that failed: counted by the host, never thrown into the call. */
  failed?: (what: string, e: unknown) => void
}

const clean = (text: string): string => redact(String(text ?? '')).text.slice(0, LINE_CHARS)

export function createVoiceJournal(deps: VoiceJournalDeps) {
  const now = deps.now ?? Date.now
  const dir = path.join(deps.folder, CALLS_FOLDER)
  interface Open { file: string; bytes: number; turn: number; tools: number; cut: boolean; startedAt: number }
  const open = new Map<string, Open>()

  function write(o: Open, entry: JournalEntry): void {
    const line = JSON.stringify(entry) + '\n'
    const isEnd = entry.kind === 'end'
    if (!isEnd && o.bytes + line.length > CALL_BYTES) {
      if (o.cut) return
      o.cut = true
      const cut = JSON.stringify({ t: new Date(now()).toISOString(), kind: 'cut', bytes: o.bytes } satisfies JournalEntry) + '\n'
      try { appendFileSync(o.file, cut, { mode: 0o600 }) } catch (e) { deps.failed?.('cut', e) }
      return
    }
    try { appendFileSync(o.file, line, { mode: 0o600 }); o.bytes += line.length } catch (e) { deps.failed?.(entry.kind, e) }
  }

  /** A new call: its file is created with its first line; answers the call's id. */
  function begin(meta: { voice: string; usdPerMinute: number }): string {
    const call = randomUUID()
    const startedAt = now()
    const stamp = new Date(startedAt).toISOString().replace(/[:.]/g, '-')
    try { mkdirSync(dir, { recursive: true, mode: 0o700 }) } catch (e) { deps.failed?.('folder', e) }
    const o: Open = { file: path.join(dir, `${stamp}-${call.slice(0, 8)}.jsonl`), bytes: 0, turn: 0, tools: 0, cut: false, startedAt }
    open.set(call, o)
    write(o, { t: new Date(startedAt).toISOString(), kind: 'start', call, voice: clean(meta.voice).slice(0, 40), usd_per_minute: meta.usdPerMinute })
    return call
  }

  /** What the owner said (a new turn) or what the voice answered. An unknown call is dropped. */
  function line(call: string, who: 'person' | 'ceo', text: string): void {
    const o = open.get(call)
    if (!o || !String(text ?? '').trim()) return
    if (who === 'person') o.turn++
    write(o, { t: new Date(now()).toISOString(), kind: who, turn: o.turn, text: clean(text) })
  }

  /** A tool the voice called, with its arguments and answer, redacted and cut. */
  function tool(call: string, name: string, args: unknown, answer: Record<string, unknown>, ms: number): void {
    const o = open.get(call)
    if (!o) return
    o.tools++
    write(o, {
      t: new Date(now()).toISOString(), kind: 'tool', turn: o.turn, name: clean(name).slice(0, 60),
      args: clean(JSON.stringify(args ?? {})), ok: answer.ok !== false, answer: clean(JSON.stringify(answer)), ms: Math.max(0, Math.round(ms))
    })
  }

  /** The call's end: its length and price as the window measured them (bounded here), and why it ended. */
  function end(call: string, m: { minutes: unknown; usd: unknown; end: unknown }): void {
    const o = open.get(call)
    if (!o) return
    open.delete(call)
    const bound = (v: unknown, max: number): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(v, max) : 0)
    // The window's own minutes, never more than the wall clock since the call's secret was minted.
    const minutes = Math.min(bound(m.minutes, 600), (now() - o.startedAt) / 60_000)
    write(o, {
      t: new Date(now()).toISOString(), kind: 'end', minutes: Math.round(minutes * 100) / 100, usd: Math.round(bound(m.usd, 1000) * 100) / 100,
      end: typeof m.end === 'string' ? m.end.slice(0, 20) : null, turns: o.turn, tools: o.tools
    })
  }

  /** The call that is open now, if one is: the tools a window runs are written to it. */
  function current(): string | null {
    let last: string | null = null
    for (const id of open.keys()) last = id
    return last
  }

  /** Files older than KEEP_DAYS removed; answers how many. Nothing else in the folder is touched. */
  function prune(): number {
    let removed = 0
    let names: string[]
    try { names = readdirSync(dir) } catch { return 0 /* no calls kept yet */ }
    for (const n of names) {
      if (!n.endsWith('.jsonl')) continue
      const f = path.join(dir, n)
      try {
        if (now() - statSync(f).mtimeMs > KEEP_DAYS * 86_400_000) { rmSync(f, { force: true }); removed++ }
      } catch (e) { deps.failed?.('prune', e) }
    }
    return removed
  }

  /** The newest calls first, each summed up from its own file. */
  function list(limit = 10): CallSummary[] {
    let names: string[]
    try { names = readdirSync(dir).filter((n) => n.endsWith('.jsonl')).sort().reverse().slice(0, Math.max(1, Math.min(limit, 100))) } catch { return [] }
    const out: CallSummary[] = []
    for (const n of names) {
      const rows = readCall(path.join(dir, n))
      const start = rows.find((r) => r.kind === 'start') as Extract<JournalEntry, { kind: 'start' }> | undefined
      const fin = rows.find((r) => r.kind === 'end') as Extract<JournalEntry, { kind: 'end' }> | undefined
      out.push({
        call: start?.call ?? n, file: n, startedAt: start?.t ?? '', minutes: fin?.minutes ?? null, usd: fin?.usd ?? null, end: fin?.end ?? null,
        turns: rows.filter((r) => r.kind === 'person').length, tools: rows.filter((r) => r.kind === 'tool').length
      })
    }
    return out
  }

  return { begin, line, tool, end, current, prune, list, folder: dir }
}

/** One call's lines, read back; a line cut while it was written is skipped. */
export function readCall(file: string): JournalEntry[] {
  let text: string
  try { text = readFileSync(file, 'utf8') } catch { return [] }
  const out: JournalEntry[] = []
  for (const l of text.split('\n')) {
    if (!l.trim()) continue
    try { out.push(JSON.parse(l) as JournalEntry) } catch { /* a line being written: the rest reads */ }
  }
  return out
}

export type VoiceJournal = ReturnType<typeof createVoiceJournal>
// #endregion ceo-voice-journal
