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

import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { atLeast, opsRecord, trim, type OpsLevel, type OpsOutcome, type OpsRecord } from '../shared/opsLog.ts'

/** Lines kept. A day of ordinary use is a few thousand; this holds several. */
const DEFAULT_CAP = 20_000

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

export function createOps(opts: { dir: string; cap?: number; now?: () => Date }): Ops {
  const cap = opts.cap ?? DEFAULT_CAP
  const now = opts.now ?? (() => new Date())
  const file = path.join(opts.dir, 'operations.jsonl')
  const checkEvery = Math.max(1, Math.min(1_000, Math.floor(cap / 4)))
  let sinceCheck = 0
  let lost = 0

  const write = (line: string): void => {
    try {
      mkdirSync(opts.dir, { recursive: true })
      // The gap marker goes in FIRST, on the first write that works after a
      // failure — bounded to one line per outage however long it ran. Reading
      // the log later, the hole says how big it was instead of looking like a
      // quiet afternoon.
      if (lost > 0) {
        const missing = lost
        appendFileSync(
          file,
          JSON.stringify(
            opsRecord({
              at: now(),
              op: 'ops.gap',
              outcome: 'unknown',
              level: 'warn',
              correlationId: 'ops-sink',
              detail: { lost: missing, note: 'records the log could not write; the corpus is incomplete' }
            })
          ) + '\n',
          { mode: 0o600 }
        )
        // Cleared only once the marker is actually ON DISK. Clearing first
        // loses the count when the marker's own write fails — the outage goes
        // 1 → 0 → 1 across three lost records and reports one, which is the
        // undercount this whole mechanism exists to prevent. Caught by
        // test/ops.test.mjs against a read-only directory.
        lost = 0
      }
      appendFileSync(file, line + '\n', { mode: 0o600 })
      // Counting appends rather than reading the file every time: the trim is a
      // housekeeping job and paying a full read per line would make the logger
      // the slowest thing in the process.
      // Scaled to the cap, not fixed. A check every thousand appends against a
      // cap of fifty lets the log reach twenty times its limit, which is not a
      // limit — found by the probe rather than by reading this line.
      if (++sinceCheck >= checkEvery) {
        sinceCheck = 0
        const lines = readFileSync(file, 'utf8').split('\n').filter(Boolean)
        if (lines.length > cap) {
          const kept = trim(lines, cap)
          const tmp = `${file}.tmp`
          writeFileSync(tmp, kept.join('\n') + '\n', { mode: 0o600 })
          renameSync(tmp, file)
        }
      }
    } catch {
      // Deliberate, and the only correct swallow in this repository: this runs
      // inside other people's catch blocks. There is nowhere left to report to.
      // It is not silent, though — the count is what the next successful write
      // publishes, and what `lost()` answers in the meantime.
      lost++
    }
  }

  return {
    correlate: () => randomUUID(),

    lost: () => lost,

    record(input) {
      try {
        write(
          JSON.stringify(
            opsRecord({
              at: now(),
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
        )
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
        if (!existsSync(file)) return []
        const out: OpsRecord[] = []
        for (const line of readFileSync(file, 'utf8').split('\n')) {
          if (!line) continue
          let r: OpsRecord
          try {
            r = JSON.parse(line) as OpsRecord
          } catch {
            // One unparseable line is litter, not a reason to lose the rest.
            continue
          }
          if (query.level && !atLeast(query.level, r.level)) continue
          if (query.correlationId && r.correlationId !== query.correlationId) continue
          out.push(r)
        }
        return query.limit ? out.slice(-query.limit) : out
      } catch {
        return []
      }
    },

    file: () => file
  }
}
