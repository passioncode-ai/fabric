// #region ops-digest-run — docs: docs/adr/0188-fabric-reads-its-own-logs-observatory-keeps-what-every-agent-learned.md#decision
/**
 * The hourly and daily reading of Fabric's own operations log (CO-500, ADR-0188 §1, §2). The sink hands every record to
 * `observe` before it decides whether to write or count it, so a sampled success is counted here too. When the clock
 * passes an hour, the hour closes: its digest is appended to `hourly-YYYY-MM.jsonl` in the digests folder; when it
 * passes a UTC day, the day's hourly digests fold into one line of `daily-YYYY-MM.jsonl`. The newest hour's rises are
 * what the operator is told («На проверке»). Nothing here reads the log back and nothing leaves the machine; CO-503 sends
 * the daily digest on. A write that fails is said once in the ops log and the counts go on.
 */
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { countInto, foldDay, foldHour, hourStart, type DailyDigest, type HourCounts, type HourlyDigest } from '../shared/opsDigest.ts'

export interface OpsDigestRun {
  /** One record the sink took; `at` in ms. Never throws. */
  observe(op: string, outcome: string, at: number): void
  /** The cycle's tick: closes an hour the clock has passed even when nothing was recorded since. */
  tick(): { hourly: HourlyDigest | null; daily: DailyDigest | null }
  /** The newest closed hour, or null before the first. */
  latest(): HourlyDigest | null
}

export function createOpsDigestRun(deps: {
  dir: string
  now?: () => number
  /** Said when a digest could not be written; the ops sink's own `failed`. */
  onWriteFailed?: (file: string, e: unknown) => void
  append?: (file: string, line: string) => void
  read?: (file: string) => string
}): OpsDigestRun {
  const now = deps.now ?? Date.now
  const append = deps.append ?? ((file: string, line: string) => { mkdirSync(path.dirname(file), { recursive: true }); appendFileSync(file, line, { mode: 0o600 }) })
  const read = deps.read ?? ((file: string) => readFileSync(file, 'utf8'))
  let bucket = hourStart(now())
  let counts: HourCounts = new Map()
  let last: HourlyDigest | null = null
  // The day's hourly digests closed by this process; a restart reads the month's file back for the day.
  let today: HourlyDigest[] = []
  let failedOnce = false

  const month = (iso: string): string => iso.slice(0, 7)
  const write = (name: string, value: unknown): void => {
    const file = path.join(deps.dir, name)
    try {
      append(file, `${JSON.stringify(value)}\n`)
      failedOnce = false
    } catch (e) {
      // Marked before it is said: saying it is a record, and a record may close an hour again.
      const first = !failedOnce
      failedOnce = true
      if (first) deps.onWriteFailed?.(file, e)
    }
  }
  const hoursOf = (day: string): HourlyDigest[] => {
    const mine = today.filter((h) => h.from.slice(0, 10) === day)
    try {
      const lines = read(path.join(deps.dir, `hourly-${day.slice(0, 7)}.jsonl`)).split('\n').filter(Boolean)
      const seen = new Set(mine.map((h) => h.from))
      for (const l of lines) {
        try {
          const h = JSON.parse(l) as HourlyDigest
          if (h.schema === 'ops.digest.hourly@1' && h.from.slice(0, 10) === day && !seen.has(h.from)) { mine.push(h); seen.add(h.from) }
        } catch { /* a torn line is skipped */ }
      }
    } catch { /* no file yet: only this process's hours */ }
    return mine.sort((a, b) => (a.from < b.from ? -1 : 1))
  }

  // A close in progress is not entered again: what it writes or says is itself recorded, and lands in the next hour.
  let closing = false
  const pending: Array<[string, string, number]> = []
  const close = (to: number): { hourly: HourlyDigest | null; daily: DailyDigest | null } => {
    if (closing) return { hourly: null, daily: null }
    closing = true
    try {
      return closeHours(to)
    } finally {
      closing = false
      // What was recorded while closing is counted now, in the hour it belongs to.
      for (const [op, outcome, at] of pending.splice(0)) if (at >= bucket) countInto(counts, op, outcome)
    }
  }
  const closeHours = (to: number): { hourly: HourlyDigest | null; daily: DailyDigest | null } => {
    let hourly: HourlyDigest | null = null
    let daily: DailyDigest | null = null
    while (bucket + 60 * 60_000 <= to) {
      // An hour with nothing recorded is still closed when the app ran through it, so the next compares with zero.
      const h = foldHour(counts, bucket, last)
      write(`hourly-${month(h.from)}.jsonl`, h)
      last = h
      hourly = h
      today.push(h)
      const dayBefore = h.from.slice(0, 10)
      bucket += 60 * 60_000
      counts = new Map()
      const dayNow = new Date(bucket).toISOString().slice(0, 10)
      if (dayNow !== dayBefore) {
        daily = foldDay(dayBefore, hoursOf(dayBefore))
        write(`daily-${month(dayBefore)}.jsonl`, daily)
        today = today.filter((x) => x.from.slice(0, 10) !== dayBefore)
      }
      // A long sleep closes at most a day of empty hours one by one; beyond that, jump.
      if (to - bucket > 24 * 60 * 60_000) { bucket = hourStart(to); last = null }
    }
    return { hourly, daily }
  }

  return {
    observe(op, outcome, at) {
      try {
        if (closing) { pending.push([op, outcome, at]); return }
        if (at >= bucket + 60 * 60_000) close(at)
        if (at < bucket) return
        countInto(counts, op, outcome)
      } catch { /* the digest never breaks the sink */ }
    },
    tick: () => close(now()),
    latest: () => last
  }
}
// #endregion ops-digest-run
