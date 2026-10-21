// Where the operations log actually lands (M81).
//
// A FILE, NOT A TABLE, and the reason decides it: the failures that matter most
// are the ones where the database is unreachable. A monitor that needs Postgres
// to record that Postgres is down records nothing on the night it is needed.
// JSONL under `userData/logs`, one file, capped by line count, newest kept.
//
// ELECTRON-FREE for the same reason `localState.ts` is: the directory arrives as
// an argument, so a probe can fill it, corrupt it and take away its permissions.
//
// IT NEVER THROWS. This is called from inside `catch` blocks, and a logger that
// throws there converts a handled failure into a crash — the observability
// turning into the outage. Every path here swallows its own errors, and that is
// the one place in this repository where swallowing is correct: the alternative
// is worse and there is nothing downstream to tell.

import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { atLeast, opsRecord, type OpsLevel, type OpsOutcome, type OpsRecord } from '../shared/opsLog.ts'

// #region ops-retention — docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#stability
// ST-4 of the 0.3.9 stability audit: a 20 000-line cap held 12 hours at the measured 1 770 lines an hour, so the
// evidence of every outage of the week was gone, and the trim rewrote the whole 4.7 MB file every thousand appends
// (ST-9). Now the log is sized by TIME within a BYTE budget: the current file rotates into segments named by when they
// were closed (`operations.<epoch ms>.jsonl`), nothing is rewritten in place, segments older than `maxAgeMs` go, and
// the oldest go first when the budget is passed. A budget cut into the last `retainMs` (a week) is recorded, once per
// cut, so a too-small budget is a fact in the log rather than a quietly short history.
const DAY_MS = 24 * 3_600_000
/** A segment is closed past this size. */
const DEFAULT_SEGMENT_BYTES = 8 * 1024 * 1024
/** The whole log, every segment included, never passes this: a hard ceiling, because a full disk is ST-1's outage. */
const DEFAULT_BUDGET_BYTES = 96 * 1024 * 1024
/** The history the budget is sized for: a week. */
const DEFAULT_RETAIN_MS = 7 * DAY_MS
/** Older segments go even under the budget. */
const DEFAULT_MAX_AGE_MS = 30 * DAY_MS
/** A successful fast IPC read is written once per window per operation and counted otherwise. */
const DEFAULT_SAMPLE_WINDOW_MS = 10 * 60_000
/** A successful call slower than this is always written: a slow path is the one worth finding (ST-13). */
const SLOW_MS = 1_000
const SEGMENT = /^operations\.(\d+)\.jsonl$/

/**
 * Which records are high-frequency polling successes (59 % of the log in ST-4: `ipc.feed:replay`,
 * `ipc.terminal:list`, `ipc.comms:heads`): a successful, fast, informational IPC call. A failure, a warning, a slow
 * call and every state change are never sampled.
 */
export function sampledByDefault(input: { op: string; outcome: OpsOutcome; level?: OpsLevel; ms?: number }): boolean {
  return input.op.startsWith('ipc.') && input.outcome === 'ok' && (input.level === undefined || input.level === 'info') && (input.ms ?? 0) < SLOW_MS
}
// #endregion ops-retention

export interface OpsContext {
  correlationId: string
  estateId?: string
  projectId?: string
  sessionId?: string
}

export interface Ops {
  /** A new id for one caller-visible operation. Every IPC call takes one at the
   *  boundary, so everything it causes can be joined back to it. */
  correlate(): string
  record(input: {
    op: string
    outcome: OpsOutcome
    level?: OpsLevel
    ms?: number
    detail?: Record<string, unknown>
    error?: unknown
    ctx: OpsContext
  }): void
  /** Start timing one operation; the returned function closes it. The duration
   *  is measured rather than guessed, which is the only way a slow path is ever
   *  found in a log. */
  begin(op: string, ctx: OpsContext): (outcome: OpsOutcome, extra?: { detail?: Record<string, unknown>; error?: unknown }) => void
  read(opts?: { level?: OpsLevel; correlationId?: string; limit?: number }): OpsRecord[]
  /** Where the file is, so a person can open it without the app. */
  file(): string
  /** How many records this sink is KNOWN to have failed to write, since the
   *  last time it managed to say so (S05).
   *
   *  A log that drops lines and reports nothing turns a partial corpus into a
   *  claimed whole one, and an eval run over it measures a subset and reports
   *  a total. The number is not decoration: it is the difference between
   *  "nothing went wrong" and "we cannot see whether anything did". */
  lost(): number
}

export function createOps(opts: {
  dir: string
  now?: () => Date
  segmentBytes?: number
  budgetBytes?: number
  retainMs?: number
  maxAgeMs?: number
  sampleWindowMs?: number
  /** Which records are counted rather than written each time; `sampledByDefault` unless given. */
  sampled?: (input: { op: string; outcome: OpsOutcome; level?: OpsLevel; ms?: number }) => boolean
}): Ops {
  const now = opts.now ?? (() => new Date())
  const file = path.join(opts.dir, 'operations.jsonl')
  const segmentBytes = Math.max(1024, opts.segmentBytes ?? DEFAULT_SEGMENT_BYTES)
  const budgetBytes = Math.max(segmentBytes * 2, opts.budgetBytes ?? DEFAULT_BUDGET_BYTES)
  const retainMs = opts.retainMs ?? DEFAULT_RETAIN_MS
  const maxAgeMs = Math.max(retainMs, opts.maxAgeMs ?? DEFAULT_MAX_AGE_MS)
  const sampleWindowMs = Math.max(1_000, opts.sampleWindowMs ?? DEFAULT_SAMPLE_WINDOW_MS)
  const sampled = opts.sampled ?? sampledByDefault
  /** Bytes in the current file; read once from disk, then counted (no read per line). */
  let size: number | null = null
  let lost = 0
  /** The sampling window: when it opened, which operations were written in it, and how many were not. */
  let windowStart: number | null = null
  let written = new Set<string>()
  let counts: Record<string, number> = {}

  const line = (input: Parameters<Ops['record']>[0], at: Date): string =>
    JSON.stringify(
      opsRecord({
        at,
        op: input.op,
        outcome: input.outcome,
        level: input.level,
        ms: input.ms,
        correlationId: input.ctx.correlationId,
        estateId: input.ctx.estateId,
        projectId: input.ctx.projectId,
        sessionId: input.ctx.sessionId,
        detail: input.detail,
        error: input.error
      })
    )

  /** Segments on disk, oldest first, with their size and when they were closed. */
  const segments = (): Array<{ name: string; closedAt: number; bytes: number }> => {
    const out: Array<{ name: string; closedAt: number; bytes: number }> = []
    for (const name of readdirSync(opts.dir)) {
      const m = SEGMENT.exec(name)
      if (!m) continue
      try {
        out.push({ name, closedAt: Number(m[1]), bytes: statSync(path.join(opts.dir, name)).size })
      } catch {
        // A segment removed between the listing and the stat (a second reader pruning) is simply not there.
      }
    }
    return out.sort((a, b) => a.closedAt - b.closedAt || a.name.localeCompare(b.name))
  }

  /** Close the current file into a segment, then drop what is past its age or over the budget. */
  const rotate = (at: number): void => {
    let closedAt = at
    while (existsSync(path.join(opts.dir, `operations.${closedAt}.jsonl`))) closedAt++
    renameSync(file, path.join(opts.dir, `operations.${closedAt}.jsonl`))
    size = 0
    const all = segments()
    let total = all.reduce((n, s) => n + s.bytes, 0)
    let cutInsideFloor: number | null = null
    for (const s of all) {
      const tooOld = at - s.closedAt > maxAgeMs
      if (!tooOld && total <= budgetBytes - segmentBytes) break
      rmSync(path.join(opts.dir, s.name), { force: true })
      total -= s.bytes
      if (!tooOld && at - s.closedAt < retainMs) cutInsideFloor = s.closedAt
    }
    if (cutInsideFloor !== null) {
      const note = line(
        {
          op: 'ops.retention-short',
          outcome: 'ok',
          level: 'warn',
          ctx: { correlationId: 'ops-sink' },
          detail: { kept_hours: Math.round((at - cutInsideFloor) / 3_600_000), budget_bytes: budgetBytes, note: 'the byte budget cut the log inside its one-week floor; older records are gone' }
        },
        new Date(at)
      )
      appendFileSync(file, note + '\n', { mode: 0o600 })
      size += Buffer.byteLength(note) + 1
    }
  }

  const write = (text: string, at: number): void => {
    try {
      mkdirSync(opts.dir, { recursive: true })
      if (size === null) {
        try {
          size = statSync(file).size
        } catch {
          // No file yet: the first write makes it.
          size = 0
        }
      }
      // The gap marker goes in FIRST, on the first write that works after a
      // failure — bounded to one line per outage however long it ran. Reading
      // the log later, the hole says how big it was instead of looking like a
      // quiet afternoon.
      if (lost > 0) {
        const missing = lost
        const marker =
          JSON.stringify(
            opsRecord({
              at: new Date(at),
              op: 'ops.gap',
              outcome: 'unknown',
              level: 'warn',
              correlationId: 'ops-sink',
              detail: { lost: missing, note: 'records the log could not write; the corpus is incomplete' }
            })
          ) + '\n'
        appendFileSync(file, marker, { mode: 0o600 })
        size += Buffer.byteLength(marker)
        // Cleared only once the marker is actually ON DISK. Clearing first
        // loses the count when the marker's own write fails — the outage goes
        // 1 → 0 → 1 across three lost records and reports one, which is the
        // undercount this whole mechanism exists to prevent. Caught by
        // test/ops.test.mjs against a read-only directory.
        lost = 0
      }
      appendFileSync(file, text + '\n', { mode: 0o600 })
      size += Buffer.byteLength(text) + 1
      // Counted, not read: rotation renames the file and never rewrites it (ST-9's full-file trim is gone).
      if (size >= segmentBytes) rotate(at)
    } catch {
      // Deliberate, and the only correct swallow in this repository: this runs
      // inside other people's catch blocks. There is nowhere left to report to.
      // It is not silent, though — the count is what the next successful write
      // publishes, and what `lost()` answers in the meantime.
      lost++
      // The size is read again next time: a failed rotation leaves the file as it was.
      size = null
    }
  }

  /** Close the sampling window when it has run its length: one line with what was counted and not written. */
  const closeWindow = (at: number, force = false): void => {
    if (windowStart === null || (!force && at - windowStart < sampleWindowMs)) return
    const counted = counts
    const opened = windowStart
    windowStart = null
    written = new Set()
    counts = {}
    if (Object.keys(counted).length === 0) return
    write(
      line(
        {
          op: 'ops.sampled',
          outcome: 'ok',
          level: 'info',
          ctx: { correlationId: 'ops-sink' },
          detail: { window_s: Math.round((at - opened) / 1000), counts: counted, note: 'successful fast reads counted rather than written; failures and slow calls are always written' }
        },
        new Date(at)
      ),
      at
    )
  }

  return {
    correlate: () => randomUUID(),

    lost: () => lost,

    record(input) {
      try {
        const at = now()
        const t = at.getTime()
        closeWindow(t)
        if (sampled(input)) {
          if (windowStart === null) windowStart = t
          if (written.has(input.op)) {
            counts[input.op] = (counts[input.op] ?? 0) + 1
            return
          }
          written.add(input.op)
        }
        write(line(input, at), t)
      } catch {
        // A record that cannot even be built is not worth a crash either.
      }
    },

    begin(op, ctx) {
      const started = Date.now()
      return (outcome, extra) =>
        this.record({ op, outcome, ms: Date.now() - started, ctx, detail: extra?.detail, error: extra?.error })
    },

    read(query = {}) {
      try {
        // Newest first, so a limited read stops at the files it needs; returned oldest first, as written.
        const files = [file, ...segments().reverse().map((s) => path.join(opts.dir, s.name))]
        const out: OpsRecord[] = []
        for (const f of files) {
          if (!existsSync(f)) continue
          const part: OpsRecord[] = []
          for (const text of readFileSync(f, 'utf8').split('\n')) {
            if (!text) continue
            let r: OpsRecord
            try {
              r = JSON.parse(text) as OpsRecord
            } catch {
              // One unparseable line is litter, not a reason to lose the rest.
              continue
            }
            if (query.level && !atLeast(query.level, r.level)) continue
            if (query.correlationId && r.correlationId !== query.correlationId) continue
            part.push(r)
          }
          out.unshift(...part)
          if (query.limit && out.length >= query.limit) break
        }
        return query.limit ? out.slice(-query.limit) : out
      } catch {
        return []
      }
    },

    file: () => file
  }
}
