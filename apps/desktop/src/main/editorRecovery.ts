// #region editor-recovery — docs: docs/adr/0106-fabric-adopts-the-product-lifecycle-contract.md#amendment--after-the-independent-review-2026-10-03-same-day
/**
 * Unsaved editor work survives a quit, a signal and a crash (ADR-0106 amendment, lifecycle LC-01).
 *
 * The first attempt made an editor with unsaved changes STOP the quit and ask. Two reviews showed why that
 * cannot hold: Chromium consumes SIGTERM before any Node handler and quits at once, so a quit cannot tell a
 * person's Cmd+Q from a supervisor's signal; a stopped quit ignored SIGTERM with no deadline, a second
 * signal killed the process without shutdown, and a quit soon after "Keep editing" discarded the work
 * without asking. So a quit never waits for an editor. Instead the editor keeps its unsaved buffer here as
 * the person types, and the next open of that file offers it back.
 *
 * One JSON file per edited path (named by a hash of the path, never the path), written atomically, mode
 * 0600 in a 0700 directory under the app's data. Bounded (LC-12): a buffer over `maxBytes` is not kept,
 * at most `maxFiles` records, and records older than `maxAgeMs` are swept at start.
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export interface RecoveryRecord {
  path: string
  content: string
  baseHash: string
  at: string
}

export interface EditorRecoveryOptions {
  dir: string
  now?: () => number
  maxBytes?: number
  maxFiles?: number
  maxAgeMs?: number
}

export const RECOVERY_MAX_BYTES = 10 * 1024 * 1024
export const RECOVERY_MAX_FILES = 50
export const RECOVERY_MAX_AGE_MS = 30 * 24 * 60 * 60_000

export function createEditorRecovery(o: EditorRecoveryOptions) {
  const now = o.now ?? Date.now
  const maxBytes = o.maxBytes ?? RECOVERY_MAX_BYTES
  const maxFiles = o.maxFiles ?? RECOVERY_MAX_FILES
  const maxAgeMs = o.maxAgeMs ?? RECOVERY_MAX_AGE_MS
  const fileFor = (p: string): string => path.join(o.dir, createHash('sha256').update(p).digest('hex').slice(0, 32) + '.json')
  const ensureDir = (): void => { mkdirSync(o.dir, { recursive: true, mode: 0o700 }) }
  const records = (): Array<{ file: string; mtime: number }> => {
    try {
      return readdirSync(o.dir).filter((n) => n.endsWith('.json')).map((n) => {
        const file = path.join(o.dir, n)
        return { file, mtime: statSync(file).mtimeMs }
      })
    } catch {
      // No directory yet (nothing was ever kept) is the empty store, not an error.
      return []
    }
  }

  return {
    /** Keep `content` for `p` (null discards). A buffer over the cap is not kept, and says so. */
    keep(p: string, content: string | null, baseHash: string): { kept: boolean; reason?: string } {
      if (typeof p !== 'string' || !p || p.length > 4096) return { kept: false, reason: 'invalid_path' }
      const file = fileFor(p)
      if (content === null) { rmSync(file, { force: true }); return { kept: false, reason: 'discarded' } }
      if (typeof content !== 'string' || typeof baseHash !== 'string') return { kept: false, reason: 'invalid' }
      if (Buffer.byteLength(content) > maxBytes) { rmSync(file, { force: true }); return { kept: false, reason: 'too_large' } }
      ensureDir()
      const record: RecoveryRecord = { path: p, content, baseHash, at: new Date(now()).toISOString() }
      const tmp = `${file}.${process.pid}.tmp`
      writeFileSync(tmp, JSON.stringify(record), { mode: 0o600 })
      renameSync(tmp, file)
      // The cap holds by count too: the oldest records go first.
      const all = records().sort((a, b) => a.mtime - b.mtime)
      for (const r of all.slice(0, Math.max(0, all.length - maxFiles))) rmSync(r.file, { force: true })
      return { kept: true }
    },
    /** The kept buffer for `p`, or null. A record for another path under the same name is not returned. */
    read(p: string): RecoveryRecord | null {
      try {
        const r = JSON.parse(readFileSync(fileFor(p), 'utf8')) as RecoveryRecord
        return r && r.path === p && typeof r.content === 'string' ? r : null
      } catch {
        // Absent or unreadable: there is nothing to offer back, which the editor shows as nothing.
        return null
      }
    },
    /** Remove records past their age; run at start. Returns how many went. */
    sweep(): number {
      let n = 0
      for (const r of records()) if (now() - r.mtime > maxAgeMs) { rmSync(r.file, { force: true }); n++ }
      const names = (() => {
        try { return readdirSync(o.dir) } catch {
          // No directory: nothing to sweep.
          return []
        }
      })()
      for (const name of names) {
        if (name.endsWith('.tmp')) { rmSync(path.join(o.dir, name), { force: true }); n++ }
      }
      return n
    }
  }
}
// #endregion editor-recovery
