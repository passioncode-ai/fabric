// #region bug-tracker — docs: docs/reports/2026-11-15-quality-audit/2026-11-15-bug-tracker-design.md#35-fingerprint-and-dedup
// One record per bug on this machine (W4 of the quality waves, wave 1, the bug tracker's §3.5): every failure the
// operations log records with an error is folded into its fingerprint, so a thousand repeats are one row with a count,
// the versions it was seen in and its newest log correlation. Kept in `userData/bugs.json` (0600), at most 200 rows,
// older than 30 days dropped first, then the rarest. Nothing here leaves the machine; it never throws, like `ops.ts`.
import { createHash } from 'node:crypto'
import { chmodSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { fingerprintInput, messageTemplate } from '../shared/bugFingerprint.ts'

export const BUG_ROWS = 200
const DAY_MS = 86_400_000
export const BUG_MAX_AGE_MS = 30 * DAY_MS

export interface BugRow {
  fp: string
  cls: string
  code: string
  errorName: string
  messageTemplate: string
  firstSeen: string
  lastSeen: string
  count: number
  versions: string[]
  lastCorrelationId: string | null
}

export interface BugStore {
  /** Fold one failure in; answers its fingerprint. */
  record(input: { cls: string; code: string; error: unknown; version: string; correlationId?: string | null }): string
  rows(): BugRow[]
  /** Write the file if anything changed; answers whether it was written. */
  flush(): boolean
}

export function bugFingerprint(input: { cls: string; code: string; errorName: string; message: string; stack?: string }): string {
  return createHash('sha256').update(fingerprintInput(input)).digest('hex').slice(0, 12)
}

const partsOf = (error: unknown): { errorName: string; message: string; stack?: string } =>
  error instanceof Error ? { errorName: error.name || 'Error', message: error.message, stack: error.stack }
    : error && typeof error === 'object' ? { errorName: 'Object', message: String((error as { message?: unknown }).message ?? (error as { code?: unknown }).code ?? 'an object') }
    : { errorName: typeof error, message: String(error) }

export function createBugStore(file: string, now: () => number = Date.now): BugStore {
  const byFp = new Map<string, BugRow>()
  let dirty = false
  try {
    const read = JSON.parse(readFileSync(file, 'utf8')) as { rows?: BugRow[] }
    for (const r of read.rows ?? []) if (r && typeof r.fp === 'string') byFp.set(r.fp, r)
  } catch {
    // Absent or unreadable: the store starts empty and the next flush writes a whole file; the log keeps every failure.
  }
  const prune = (): void => {
    const t = now()
    for (const [fp, r] of byFp) if (t - Date.parse(r.lastSeen) > BUG_MAX_AGE_MS) byFp.delete(fp)
    if (byFp.size > BUG_ROWS) {
      const rarest = [...byFp.values()].sort((a, b) => a.count - b.count || Date.parse(a.lastSeen) - Date.parse(b.lastSeen))
      for (const r of rarest.slice(0, byFp.size - BUG_ROWS)) byFp.delete(r.fp)
    }
  }
  return {
    record(input) {
      const parts = partsOf(input.error)
      const fp = bugFingerprint({ cls: input.cls, code: input.code, ...parts })
      const at = new Date(now()).toISOString()
      const row = byFp.get(fp)
      if (row) {
        row.count += 1
        row.lastSeen = at
        if (!row.versions.includes(input.version)) row.versions = [...row.versions, input.version].slice(-5)
        if (input.correlationId) row.lastCorrelationId = input.correlationId
      } else {
        byFp.set(fp, { fp, cls: input.cls, code: input.code, errorName: parts.errorName, messageTemplate: messageTemplate(parts.message),
          firstSeen: at, lastSeen: at, count: 1, versions: [input.version], lastCorrelationId: input.correlationId ?? null })
        prune()
      }
      dirty = true
      return fp
    },
    rows: () => [...byFp.values()].sort((a, b) => b.count - a.count),
    flush() {
      if (!dirty) return false
      try {
        prune()
        const tmp = `${file}.tmp`
        writeFileSync(tmp, JSON.stringify({ schema: 'fabric-bugs/1', rows: [...byFp.values()] }), { mode: 0o600 })
        chmodSync(tmp, 0o600)
        renameSync(tmp, file)
        dirty = false
        return true
      } catch {
        // A full or read-only disk: the rows stay in memory and the next flush tries again; the log still holds them.
        return false
      }
    }
  }
}
// #endregion bug-tracker
