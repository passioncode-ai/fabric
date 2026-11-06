// #region ops-digest-run — docs: docs/adr/0188-fabric-reads-its-own-logs-observatory-keeps-what-every-agent-learned.md#decision
/**
 * The hourly and daily reading of Fabric's own operations log (CO-500, ADR-0188 §1, §2), written as the contract's
 * DEC-0153 says (CO-509). The sink hands every record to `observe` before it decides whether to write or count it, so a
 * sampled success is counted here too. An hour is written only when Fabric observed itself in it (a record or the
 * cycle's tick inside it): when the clock passes it, its digest is appended to `hourly-YYYY-MM.jsonl`; the hours the Mac
 * slept are not written, never filled (OD-1). When a UTC day ends, its hourly lines fold into one line of
 * `daily-YYYY-MM.jsonl`. The hour Fabric quits in is kept with its counts (`open-hour.json`, written whole or not at
 * all) and written at the next start, before any closed day is folded (OD-1, OD-5); `previous` at start is the last
 * hourly line written. At most 4095 operations a UTC day are counted by their name, the rest under `OVERFLOW_OP`
 * (OD-3). A record dated before the open hour (the clock set back) is counted in the open hour, never dropped. Hourly
 * files are kept three months and daily files thirteen. The newest hour's rises are what the operator is told («На
 * проверке»). Nothing leaves the machine; CO-503 sends the daily digest on. A write that fails is said once in the ops
 * log and the counts go on; `start` runs after the ops log exists, so a failure at start is said too (0.3.16 review,
 * DA-3).
 */
import { appendFileSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { countInto, DAY_NAMES_MAX, foldDay, foldHour, hourStart, OVERFLOW_OP, type DailyDigest, type HourCounts, type HourlyDigest, type OpCount } from '../shared/opsDigest.ts'

const HOUR_MS = 60 * 60_000
/** Months of files kept, the current one included. The daily file is what a collector reads (DEC-0153 OD-9). */
export const KEEP_HOURLY_MONTHS = 3
export const KEEP_DAILY_MONTHS = 13
const KEPT_FILE = 'open-hour.json'
const KEPT_SCHEMA = 'ops.digest.kept@1'

interface KeptHour {
  schema: typeof KEPT_SCHEMA
  from: string
  ops: OpCount[]
}

export interface OpsDigestRun {
  /** One record the sink took; `at` in ms. Never throws. */
  observe(op: string, outcome: string, at: number): void
  /** The cycle's tick: closes an hour the clock has passed even when nothing was recorded since. */
  tick(): { hourly: HourlyDigest | null; daily: DailyDigest | null }
  /** The newest closed hour when it is the hour just before the open one, else null (a rise from before a sleep or a
   *  restart is not today's). */
  latest(): HourlyDigest | null
  /** Once, after the ops log exists: writes the hour kept at the last quit, folds the closed days without a daily
   *  line, prunes old files. Never throws. */
  start(): void
  /** At quit: keeps the open hour with its counts for the next start. Never throws. */
  stop(): void
}

export function createOpsDigestRun(deps: {
  dir: string
  now?: () => number
  /** Said when a digest could not be written; the ops sink's own `failed`. */
  onWriteFailed?: (file: string, e: unknown) => void
  append?: (file: string, line: string) => void
  read?: (file: string) => string
  /** Writes a whole file or nothing (a temporary file renamed over it). */
  writeWhole?: (file: string, text: string) => void
  remove?: (file: string) => void
  list?: (dir: string) => string[]
}): OpsDigestRun {
  const now = deps.now ?? Date.now
  const append = deps.append ?? ((file: string, line: string) => { mkdirSync(path.dirname(file), { recursive: true }); appendFileSync(file, line, { mode: 0o600 }) })
  const read = deps.read ?? ((file: string) => readFileSync(file, 'utf8'))
  const writeWhole = deps.writeWhole ?? ((file: string, text: string) => {
    mkdirSync(path.dirname(file), { recursive: true })
    const tmp = `${file}.tmp`
    writeFileSync(tmp, text, { mode: 0o600 })
    renameSync(tmp, file)
  })
  const remove = deps.remove ?? ((file: string) => rmSync(file, { force: true }))
  const list = deps.list ?? ((dir: string) => readdirSync(dir))
  const at = (file: string): string => path.join(deps.dir, file)
  const month = (iso: string): string => iso.slice(0, 7)
  const dayOf = (ms: number): string => new Date(ms).toISOString().slice(0, 10)

  // Each month's hourly lines, read once (the 0.3.16 review, ER-12) and kept up to date with what this process writes;
  // the first line of an hour is the hour's (OD-5).
  const hourlyFiles = new Map<string, Map<string, HourlyDigest>>()
  const hourlyOf = (m: string): Map<string, HourlyDigest> => {
    let hours = hourlyFiles.get(m)
    if (hours) return hours
    hours = new Map()
    for (const h of linesOf(`hourly-${m}.jsonl`)) {
      const d = h as HourlyDigest | null
      if (d?.schema === 'ops.digest.hourly@1' && typeof d.from === 'string' && !hours.has(d.from)) hours.set(d.from, d)
    }
    hourlyFiles.set(m, hours)
    return hours
  }
  function linesOf(file: string): unknown[] {
    try {
      return read(at(file)).split('\n').filter(Boolean).map((l) => {
        try { return JSON.parse(l) } catch {
          // A torn line is skipped, as every reader does.
          return null
        }
      })
    } catch {
      // No file yet: nothing in it.
      return []
    }
  }
  const hoursOf = (day: string): HourlyDigest[] =>
    [...hourlyOf(month(day)).values()].filter((h) => h.from.slice(0, 10) === day).sort((a, b) => (a.from < b.from ? -1 : 1))

  let failedOnce = false
  const write = (name: string, value: unknown): boolean => {
    const file = at(name)
    try {
      append(file, `${JSON.stringify(value)}\n`)
      failedOnce = false
      return true
    } catch (e) {
      // Marked before it is said: saying it is a record, and a record may close an hour again.
      const first = !failedOnce
      failedOnce = true
      if (first) deps.onWriteFailed?.(file, e)
      return false
    }
  }
  const writeHour = (h: HourlyDigest): void => {
    const hours = hourlyOf(month(h.from))
    if (hours.has(h.from)) return
    // An hour not written is still the newest closed hour in memory: its rises are told and the next compares with it.
    if (!last || h.from > last.from) last = h
    if (write(`hourly-${month(h.from)}.jsonl`, h)) hours.set(h.from, h)
  }

  let bucket = hourStart(now())
  let counts: HourCounts = new Map()
  // The day's named operations (OD-3), rebuilt from the day's hourly lines and the hour kept at the last quit.
  let named = new Set<string>()
  const nameFor = (op: string): string => {
    if (op === OVERFLOW_OP || named.has(op)) return op
    if (named.size >= DAY_NAMES_MAX) return OVERFLOW_OP
    named.add(op)
    return op
  }
  const count = (op: string, outcome: string): void => countInto(counts, nameFor(op), outcome)

  // `previous` at start: the last hourly line written, of this month or the one before (OD-1).
  let last: HourlyDigest | null = null
  const monthBefore = (ms: number): string => { const d = new Date(ms); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)).toISOString().slice(0, 7) }
  try {
    for (const m of [monthBefore(bucket), month(new Date(bucket).toISOString())])
      for (const h of hourlyOf(m).values()) if (!last || h.from > last.from) last = h
    for (const h of hoursOf(dayOf(bucket))) for (const c of h.ops) if (c.op !== OVERFLOW_OP) named.add(c.op)
  } catch { /* the digest never breaks the start */ }

  // The hour kept at the last quit: the open hour again after a restart inside it (its counts go on), else a closed hour
  // written at `start`. A kept hour dated after the open one (the clock set back) is counted in the open hour.
  let keptClosed: KeptHour | null = null
  try {
    const kept = JSON.parse(read(at(KEPT_FILE))) as KeptHour
    const whole = (n: unknown): boolean => Number.isSafeInteger(n) && (n as number) >= 0
    if (kept?.schema === KEPT_SCHEMA && typeof kept.from === 'string' && !Number.isNaN(Date.parse(kept.from)) && Array.isArray(kept.ops) &&
        kept.ops.every((c) => typeof c?.op === 'string' && whole(c.ok) && whole(c.failed) && whole(c.unknown))) {
      const from = Date.parse(kept.from)
      if (from < bucket) {
        keptClosed = kept
        if (kept.from.slice(0, 10) === dayOf(bucket)) for (const c of kept.ops) if (c.op !== OVERFLOW_OP) named.add(c.op)
      } else {
        for (const c of kept.ops) {
          const into = counts.get(nameFor(c.op)) ?? { ok: 0, failed: 0, unknown: 0 }
          into.ok += c.ok; into.failed += c.failed; into.unknown += c.unknown
          counts.set(nameFor(c.op), into)
        }
      }
    }
  } catch { /* nothing kept, or unreadable: that hour is not written, never a partial line */ }

  // A close in progress is not entered again: what it writes or says is itself recorded, and lands in the next hour.
  let closing = false
  const pending: Array<[string, string]> = []
  const close = (to: number): { hourly: HourlyDigest | null; daily: DailyDigest | null } => {
    if (closing || to < bucket + HOUR_MS) return { hourly: null, daily: null }
    closing = true
    try {
      // The open hour was observed (it holds the start, a record or a tick), so it is written, an empty one included;
      // the hours between it and `to` were not observed (the Mac asleep) and are not written (OD-1).
      const h = foldHour(counts, bucket, last)
      writeHour(h)
      const dayBefore = h.from.slice(0, 10)
      bucket = hourStart(to)
      counts = new Map()
      let daily: DailyDigest | null = null
      if (dayOf(bucket) !== dayBefore) {
        named = new Set()
        daily = foldDay(dayBefore, hoursOf(dayBefore))
        if (daily) write(`daily-${month(dayBefore)}.jsonl`, daily)
      }
      return { hourly: h, daily }
    } finally {
      closing = false
      // What was recorded while closing is counted now, in the open hour.
      for (const [op, outcome] of pending.splice(0)) count(op, outcome)
    }
  }

  /** DEC-0153 OD-5 (CO-509): every closed UTC day of this and the previous month that has hourly lines and no daily
   *  line is folded from its hourly lines, read once. A day with no hourly line has no daily line. */
  const backfill = (): void => {
    const today = dayOf(bucket)
    for (const m of [month(new Date(bucket).toISOString()), monthBefore(bucket)]) {
      const done = new Set(linesOf(`daily-${m}.jsonl`).map((d) => ((d as DailyDigest | null)?.schema === 'ops.digest.daily@1' ? (d as DailyDigest).day : null)))
      const days = new Set([...hourlyOf(m).values()].map((h) => h.from.slice(0, 10)).filter((d) => d < today))
      for (const day of [...days].sort()) {
        if (done.has(day)) continue
        const d = foldDay(day, hoursOf(day))
        if (d) write(`daily-${m}.jsonl`, d)
      }
    }
  }

  /** Files older than their keep are removed; nothing else in the folder is touched (the 0.3.16 review, ER-9, DA-6). */
  const prune = (): void => {
    const d = new Date(bucket)
    const oldest = (keep: number): string => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - (keep - 1), 1)).toISOString().slice(0, 7)
    const keepFrom = { hourly: oldest(KEEP_HOURLY_MONTHS), daily: oldest(KEEP_DAILY_MONTHS) }
    for (const name of list(deps.dir)) {
      const m = /^(hourly|daily)-(\d{4}-\d{2})\.jsonl$/.exec(name)
      if (m && m[2] < keepFrom[m[1] as 'hourly' | 'daily']) remove(at(name))
    }
  }

  let started = false
  return {
    observe(op, outcome, at) {
      try {
        if (closing) { pending.push([op, outcome]); return }
        if (at >= bucket + HOUR_MS) close(at)
        count(op, outcome)
      } catch { /* the digest never breaks the sink */ }
    },
    tick: () => {
      try { return close(now()) } catch {
        // The digest never breaks the cycle: an hour that could not close closes on the next tick.
        return { hourly: null, daily: null }
      }
    },
    latest: () => (last && Date.parse(last.to) === bucket ? last : null),
    start() {
      if (started) return
      started = true
      // The stop hour first, so the day it closes folds with it (OD-1, OD-5).
      try {
        if (keptClosed) {
          const from = Date.parse(keptClosed.from)
          const kc: HourCounts = new Map(keptClosed.ops.map((c) => [c.op, { ok: c.ok, failed: c.failed, unknown: c.unknown }]))
          writeHour(foldHour(kc, from, last))
          if (hourlyOf(month(keptClosed.from)).has(new Date(from).toISOString())) remove(at(KEPT_FILE))
        } else remove(at(KEPT_FILE))
      } catch { /* left for the next start */ }
      try { backfill() } catch { /* a day left unfolded is folded at a later start */ }
      try { prune() } catch { /* pruned at a later start */ }
    },
    stop() {
      try {
        const kept: KeptHour = { schema: KEPT_SCHEMA, from: new Date(bucket).toISOString(), ops: [...counts.entries()].map(([op, c]) => ({ op, ...c })) }
        writeWhole(at(KEPT_FILE), JSON.stringify(kept))
      } catch { /* not kept: that hour is not written, never a partial line */ }
    }
  }
}
// #endregion ops-digest-run
