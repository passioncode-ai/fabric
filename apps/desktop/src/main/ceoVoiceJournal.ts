// #region ceo-voice-journal — docs: docs/reports/2026-11-20-voice-ceo-retro/fixes.md#1-the-call-journal
/**
 * The voice call's journal (voice CEO retro 2026-11-20, finding 1): what the owner said, what the voice answered, every
 * tool it called with its arguments and answer, the call's length and its price, kept on this computer so a call can
 * be read again, by the owner, by the CEO and by the next retro. Before it, the lines lived only in the window.
 *
 * One file a call, `calls/<UTC start>-<id8>.jsonl` in the CEO's folder (the CEO's console reads it there), the folder
 * 0700 and each file 0600, appended line by line. Private by construction: every text, and each tool's arguments and answer field by field,
 * pass Fabric's redaction (`shared/redact.ts`) before they are written, and Fabric sends none of it anywhere; the CEO's
 * console reads the folder like any file in its own, so what it reads reaches its runner's provider (ADR-0197 amendment 4). Each line carries the
 * turn it belongs to (a person's line opens a turn; the tools called after it carry its number), so a reply and the
 * tools behind it are read together. Bounded: a line at most LINE_CHARS, a call at most CALL_BYTES bytes (past it one
 * `cut` line, then only the end), calls older than KEEP_DAYS and past the newest KEEP_CALLS removed at every call and at
 * start. A write that fails is counted, never
 * thrown into the call.
 */
import { appendFileSync, closeSync, fstatSync, lstatSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, rmSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { redact, redactPayload } from '../shared/redact.ts'

export const KEEP_DAYS = 30
export const LINE_CHARS = 4000
export const CALL_BYTES = 2 * 1024 * 1024
export const CALLS_FOLDER = 'calls'
/** At most this many call files are kept, the oldest removed first (0.3.27 review, DA-4): with CALL_BYTES, 400 MB at most. */
export const KEEP_CALLS = 200
/** A call file's name: its UTC start and its id's first eight hex characters. Nothing else in the folder is touched
 *  (0.3.27 review, DA-13: a stray or linked `.jsonl` there is not a call). */
const CALL_FILE = /^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)-[0-9a-f]{8}\.jsonl$/
/** A call's start, read from its file name (DA-14: the file's mtime moves when a late row or an orphan's end lands). */
const startOf = (name: string): number => {
  const m = CALL_FILE.exec(name)
  return m ? Date.parse(m[1]!.replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z/, 'T$1:$2:$3.$4Z')) : NaN
}
/** The call files of the folder, oldest first: real files with a call's name, never a link. */
function callFiles(dir: string): string[] {
  let names: string[]
  try { names = readdirSync(dir) } catch { return [] /* no calls kept yet */ }
  return names.filter((n) => {
    if (!CALL_FILE.test(n)) return false
    try { return lstatSync(path.join(dir, n)).isFile() } catch { return false /* gone meanwhile */ }
  }).sort()
}
/** The last bytes of a file, for its last rows (ER-22: a whole call is never read to find its end). */
function tailOf(file: string, bytes = 8192): string {
  let fd: number | null = null
  try {
    fd = openSync(file, 'r')
    const size = fstatSync(fd).size
    const len = Math.min(size, bytes)
    const buf = Buffer.alloc(len)
    readSync(fd, buf, 0, len, size - len)
    return buf.toString('utf8')
  } catch { return '' /* unreadable: treated as no rows */ } finally { if (fd !== null) closeSync(fd) }
}

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
/** A tool's arguments or answer, redacted field by field BEFORE it is serialised (0.3.27 review, DA-1): a JSON string
 *  turns a newline into «\n», after which «NAME=value» on a later line has no boundary the text rules can see. */
const cleanValue = (value: unknown): string => {
  const obj = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : { value }
  return clean(JSON.stringify(cleanKeys(redactPayload(obj).payload)))
}
/** Keys are text too (0.3.27 review, DA-15): each is redacted like a value. */
function cleanKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(cleanKeys)
  if (!v || typeof v !== 'object') return v
  const out: Record<string, unknown> = {}
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[redact(k).text] = cleanKeys(x)
  return out
}

export function createVoiceJournal(deps: VoiceJournalDeps) {
  const now = deps.now ?? Date.now
  const dir = path.join(deps.folder, CALLS_FOLDER)
  interface Open { file: string; bytes: number; turn: number; tools: number; cut: boolean; startedAt: number; lastAt: number; usdPerMinute: number }
  const open = new Map<string, Open>()
  /** Calls that ended while a tool they asked for still ran: its row still lands in its own file. The newest 20. */
  const ended = new Map<string, Open>()

  function write(o: Open, entry: JournalEntry): void {
    const line = JSON.stringify(entry) + '\n'
    // Bytes, not characters (0.3.27 review, DA-2): Russian speech is two bytes a letter, a console's box lines three.
    const size = Buffer.byteLength(line)
    const isEnd = entry.kind === 'end'
    if (!isEnd && o.bytes + size > CALL_BYTES) {
      if (o.cut) return
      o.cut = true
      const cut = JSON.stringify({ t: new Date(now()).toISOString(), kind: 'cut', bytes: o.bytes } satisfies JournalEntry) + '\n'
      try { appendFileSync(o.file, cut, { mode: 0o600 }) } catch (e) { /* counted by the host (ops.failed), never thrown into the call */ deps.failed?.('cut', e) }
      return
    }
    try { appendFileSync(o.file, line, { mode: 0o600 }); o.bytes += size; o.lastAt = now() } catch (e) { /* counted by the host (ops.failed), never thrown into the call */ deps.failed?.(entry.kind, e) }
  }

  /** A new call: its file is created with its first line; answers the call's id. */
  function begin(meta: { voice: string; usdPerMinute: number }): string {
    // Pruned at every call, not only at start (0.3.27 review, DA-4), with room for this one (DA-14): KEEP_CALLS at most.
    prune(KEEP_CALLS - 1)
    const call = randomUUID()
    const startedAt = now()
    const stamp = new Date(startedAt).toISOString().replace(/[:.]/g, '-')
    try { mkdirSync(dir, { recursive: true, mode: 0o700 }) } catch (e) { /* counted by the host (ops.failed); the call goes on without a journal */ deps.failed?.('folder', e) }
    const o: Open = { file: path.join(dir, `${stamp}-${call.slice(0, 8)}.jsonl`), bytes: 0, turn: 0, tools: 0, cut: false, startedAt, lastAt: startedAt, usdPerMinute: meta.usdPerMinute }
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

  /** A tool the voice called, with its arguments and answer, redacted and cut. `call` is the call that asked for it, read
   *  when it was asked (0.3.27 review, DA-3); its row is written even when that call has ended meanwhile. */
  function tool(call: string, name: string, args: unknown, answer: Record<string, unknown>, ms: number): void {
    const o = open.get(call) ?? ended.get(call)
    if (!o) return
    o.tools++
    write(o, {
      t: new Date(now()).toISOString(), kind: 'tool', turn: o.turn, name: clean(name).slice(0, 60),
      args: cleanValue(args ?? {}), ok: answer.ok !== false, answer: cleanValue(answer), ms: Math.max(0, Math.round(ms))
    })
  }

  /** The call's end: its length and price as the window measured them (bounded here), and why it ended. */
  function end(call: string, m: { minutes: unknown; usd: unknown; end: unknown }): void {
    const o = open.get(call)
    if (!o) return
    open.delete(call)
    ended.set(call, o)
    while (ended.size > 20) ended.delete(ended.keys().next().value!)
    const bound = (v: unknown, max: number): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(v, max) : 0)
    // The window's own minutes, never more than the wall clock since the call's secret was minted.
    const minutes = Math.min(bound(m.minutes, 600), (now() - o.startedAt) / 60_000)
    write(o, {
      t: new Date(now()).toISOString(), kind: 'end', minutes: Math.round(minutes * 100) / 100, usd: Math.round(bound(m.usd, 1000) * 100) / 100,
      end: typeof m.end === 'string' ? m.end.slice(0, 20) : null, turns: o.turn, tools: o.tools
    })
  }

  /** A call its window left open (closed mid-call): ended with its length measured from its start to its last line and
   *  priced at its own rate, never 0 (0.3.27 review, ER-2). */
  function closeLeft(call: string): void {
    const o = open.get(call)
    if (!o) return
    const minutes = (o.lastAt - o.startedAt) / 60_000
    end(call, { minutes: minutes + 1e-9, usd: minutes * o.usdPerMinute, end: 'not-closed' })
  }

  /** The call that is open now, if one is: the tools a window runs are written to it. */
  function current(): string | null {
    let last: string | null = null
    for (const id of open.keys()) last = id
    return last
  }

  /** Calls older than KEEP_DAYS (by the start in their name) removed, then the oldest past `keep`; answers how many. Only
   *  call files are touched, and an open call's file is never removed. */
  function prune(keep = KEEP_CALLS): number {
    let removed = 0
    const names = callFiles(dir)
    const openFiles = new Set([...open.values()].map((o) => path.basename(o.file)))
    const kept: string[] = []
    for (const n of names) {
      const at = startOf(n)
      try {
        if (!openFiles.has(n) && Number.isFinite(at) && now() - at > KEEP_DAYS * 86_400_000) { rmSync(path.join(dir, n), { force: true }); removed++ }
        else kept.push(n)
      } catch (e) { /* counted by the host (ops.failed); the file is tried again at the next prune */ deps.failed?.('prune', e) }
    }
    // Names start with the call's UTC start, so the sorted list is oldest first.
    for (const n of kept.filter((k) => !openFiles.has(k)).slice(0, Math.max(0, kept.length - keep))) {
      try { rmSync(path.join(dir, n), { force: true }); removed++ } catch (e) { /* counted by the host (ops.failed); tried again at the next prune */ deps.failed?.('prune', e) }
    }
    return removed
  }

  /** Calls a previous run of Fabric left without an end (it quit mid-call): each ended with its length from its first to
   *  its last line, priced at its rate (0.3.27 review, ER-2). Answers how many. */
  function closeOrphans(): number {
    const names = callFiles(dir)
    const openFiles = new Set([...open.values()].map((o) => path.basename(o.file)))
    let closed = 0
    for (const n of names) {
      if (openFiles.has(n)) continue
      const f = path.join(dir, n)
      // The last rows tell whether it ended (ER-22); only a file that is ours, started with a start row, is ended (DA-13).
      if (parseRows(tailOf(f)).some((r) => r.kind === 'end')) continue
      const rows = readCall(f)
      if (!rows.length || rows[0]!.kind !== 'start' || rows.some((r) => r.kind === 'end')) continue
      const start = rows[0] as Extract<JournalEntry, { kind: 'start' }>
      const first = Date.parse(rows[0]!.t), last = Date.parse(rows.at(-1)!.t)
      const minutes = Number.isFinite(first) && Number.isFinite(last) ? Math.max(0, last - first) / 60_000 : 0
      const entry: JournalEntry = { t: new Date(now()).toISOString(), kind: 'end', minutes: Math.round(minutes * 100) / 100, usd: Math.round(minutes * (start?.usd_per_minute ?? 0) * 100) / 100, end: 'not-closed', turns: rows.filter((r) => r.kind === 'person').length, tools: rows.filter((r) => r.kind === 'tool').length }
      try { appendFileSync(f, JSON.stringify(entry) + '\n', { mode: 0o600 }); closed++ } catch (e) { /* counted by the host (ops.failed); tried again at the next start */ deps.failed?.('orphan', e) }
    }
    return closed
  }

  /** The newest calls first, each summed up from its own file. */
  function list(limit = 10): CallSummary[] {
    const names = callFiles(dir).reverse().slice(0, Math.max(1, Math.min(limit, 100)))
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

  return { begin, line, tool, end, closeLeft, closeOrphans, current, prune, list, folder: dir }
}

/** One call's lines, read back; a line cut while it was written is skipped. */
export function readCall(file: string): JournalEntry[] {
  let text: string
  try { text = readFileSync(file, 'utf8') } catch { return [] /* a file pruned or unreadable reads as no lines; list() names it with none */ }
  return parseRows(text)
}
function parseRows(text: string): JournalEntry[] {
  const out: JournalEntry[] = []
  for (const l of text.split('\n')) {
    if (!l.trim()) continue
    try { out.push(JSON.parse(l) as JournalEntry) } catch { /* a line being written: the rest reads */ }
  }
  return out
}

export type VoiceJournal = ReturnType<typeof createVoiceJournal>
// #endregion ceo-voice-journal
