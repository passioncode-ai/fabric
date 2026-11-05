// #region ops-digest — docs: docs/adr/0188-fabric-reads-its-own-logs-observatory-keeps-what-every-agent-learned.md#decision
/**
 * Fabric reads its own operations log (CO-500, ADR-0188 §1, §2): every record the sink takes is counted by operation
 * and outcome in the hour it happened, and each closed hour folds into one hourly digest; the day's hourly digests fold
 * into one daily digest. Pure arithmetic, no model. A failure count that rose against the previous hour past the
 * threshold is a finding the operator is told. Counts only: no detail, no path, no identifier leaves the record.
 */

/** The outcomes the sink records (`shared/opsRecord.ts`), as the digest counts them. */
export type DigestOutcome = 'ok' | 'failed' | 'unknown'

export interface OpCount {
  op: string
  ok: number
  failed: number
  unknown: number
}

export interface HourlyDigest {
  schema: 'ops.digest.hourly@1'
  /** The hour's start and end, ISO, end exclusive. */
  from: string
  to: string
  /** Every operation recorded in the hour, by name. */
  ops: OpCount[]
  total: { ok: number; failed: number; unknown: number }
  /** Operations whose failures rose past the threshold against the previous hour. */
  risen: Array<{ op: string; failed: number; previous: number }>
}

export interface DailyDigest {
  schema: 'ops.digest.daily@1'
  /** The UTC day, YYYY-MM-DD. */
  day: string
  /** How many hourly digests the day holds (24 when the app ran all day). */
  hours: number
  ops: OpCount[]
  total: { ok: number; failed: number; unknown: number }
  /** Every operation that rose in some hour of the day, with the hours it rose in. */
  risen: Array<{ op: string; hours: number; failed: number }>
}

/** A failure count is a rise when it is at least this many in the hour… */
export const RISE_MIN_FAILED = 10
/** …and at least this many times the previous hour's (a previous hour with none counts as one). */
export const RISE_FACTOR = 2

/** DEC-0153 OD-3: at most 4095 named operations a UTC day, the rest counted under one fixed overflow name, published
 *  with Fabric's outcome map (`docs/adr/0188-…`, the CO-509 amendment), so every hourly and daily line stays within the
 *  contract's 4096. */
export const DAY_NAMES_MAX = 4095
export const OVERFLOW_OP = 'ops.overflow'

const HOUR_MS = 60 * 60_000

export function hourStart(at: number): number {
  return Math.floor(at / HOUR_MS) * HOUR_MS
}

/** Counts of one hour: op → outcome → n. */
export type HourCounts = Map<string, { ok: number; failed: number; unknown: number }>

export function countInto(counts: HourCounts, op: string, outcome: string): void {
  const o: DigestOutcome = outcome === 'ok' || outcome === 'failed' ? outcome : 'unknown'
  const c = counts.get(op) ?? { ok: 0, failed: 0, unknown: 0 }
  c[o]++
  counts.set(op, c)
}

const byName = (a: OpCount, b: OpCount): number => (a.op < b.op ? -1 : a.op > b.op ? 1 : 0)

export function foldHour(counts: HourCounts, from: number, previous: HourlyDigest | null): HourlyDigest {
  const ops = [...counts.entries()].map(([op, c]) => ({ op, ...c })).sort(byName)
  const total = ops.reduce((t, c) => ({ ok: t.ok + c.ok, failed: t.failed + c.failed, unknown: t.unknown + c.unknown }), { ok: 0, failed: 0, unknown: 0 })
  // A previous digest counts only when it is the hour just before; a gap (the app was closed) compares with nothing.
  const prevOf = new Map((previous && Date.parse(previous.to) === from ? previous.ops : []).map((c) => [c.op, c.failed]))
  const risen = ops
    .filter((c) => c.failed >= RISE_MIN_FAILED && c.failed >= RISE_FACTOR * Math.max(1, prevOf.get(c.op) ?? 0))
    .map((c) => ({ op: c.op, failed: c.failed, previous: prevOf.get(c.op) ?? 0 }))
  return { schema: 'ops.digest.hourly@1', from: new Date(from).toISOString(), to: new Date(from + HOUR_MS).toISOString(), ops, total, risen }
}

/** The day's hourly digests (those whose hour starts on that UTC day) folded into one. */
export function foldDay(day: string, hourly: readonly HourlyDigest[]): DailyDigest {
  const mine = hourly.filter((h) => h.from.slice(0, 10) === day)
  const sum = new Map<string, OpCount>()
  const rose = new Map<string, { hours: number; failed: number }>()
  for (const h of mine) {
    for (const c of h.ops) {
      const s = sum.get(c.op) ?? { op: c.op, ok: 0, failed: 0, unknown: 0 }
      s.ok += c.ok; s.failed += c.failed; s.unknown += c.unknown
      sum.set(c.op, s)
    }
    for (const r of h.risen) {
      const x = rose.get(r.op) ?? { hours: 0, failed: 0 }
      x.hours++; x.failed += r.failed
      rose.set(r.op, x)
    }
  }
  const ops = [...sum.values()].sort(byName)
  const total = ops.reduce((t, c) => ({ ok: t.ok + c.ok, failed: t.failed + c.failed, unknown: t.unknown + c.unknown }), { ok: 0, failed: 0, unknown: 0 })
  const risen = [...rose.entries()].map(([op, x]) => ({ op, ...x })).sort((a, b) => b.failed - a.failed || (a.op < b.op ? -1 : 1))
  return { schema: 'ops.digest.daily@1', day, hours: mine.length, ops, total, risen }
}
/** The operator's queue rows for the newest hour's rises (CO-500, ADR-0188 §2), in the shape the sweep's rows take
 *  (`attention.ts#AttentionSources.swept`): one per operation, titled with the operation and its counts. */
export function risenRows(h: HourlyDigest | null): Array<{ key: string; kind: 'failures-rose'; project_id: null; task_id: null; request_id: null; still_since: string; title: string; is_task: false }> {
  if (!h) return []
  return h.risen.map((r) => ({
    key: `failures-rose:${r.op}`, kind: 'failures-rose' as const, project_id: null, task_id: null, request_id: null,
    still_since: h.from, title: `${r.op}: ${r.failed} / ${r.previous}`, is_task: false as const
  }))
}
// #endregion ops-digest
