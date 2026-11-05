// #region ops-digest-collect — docs: docs/evidence/specs/2026-11-04-agents-logs-and-the-improvement-loop.md#23-logs-read-every-hour-and-every-day-and-the-improvement-loop-co-500-co-502-co-503
/**
 * Fabric as the collector of the contract's DEC-0153 OD-9 (CO-503): which folders a local service descriptor declares
 * for its daily digests, and which daily lines are still to be sent. Pure: the main process reads the files and sends.
 * A declaration the contract's `FAC-SEM-168` would refuse is refused here as a whole (a collector never reads a folder
 * outside the service's own data folder); a line the daily schema would refuse is skipped, as every reader does.
 */
import { fitsOpName, OP_NAME_MAX } from './toolOutcome.ts'

export const OPS_DIGEST_EXTENSION = 'https://fabric.passioncode.ai/agent-contract/extensions/ops-digest/0.1'
export const OPS_MAX = 4096
const SOURCE = /^[a-z][a-z0-9-]{0,31}$/
const DAY = /^\d{4}-\d{2}-\d{2}$/
/** Code points a file system or a tool may drop from a name (DEC-0153 OD-9's default-ignorable set, the usual ones). */
const IGNORABLE = /[­͏؜ᅟᅠ឴឵᠋-᠏​-‏‪-‮⁠-⁯ㅤ︀-️﻿ﾠ￰-￸]/gu

export interface DigestFolder {
  dir: string
  source: string
}

export interface ServiceRef {
  id: string
  instance: string
}

/** The folders a descriptor declares, or the reason it declares none a collector may read. */
export function declaredFolders(d: Record<string, unknown>): { folders: DigestFolder[] } | { refused: string } | null {
  const ext = d.extensions as Record<string, unknown> | undefined
  if (!ext || typeof ext !== 'object' || !(OPS_DIGEST_EXTENSION in ext)) return null
  if (d.placement === 'remote') return { refused: 'declared on a remote placement' }
  const data = (d.paths as { data?: unknown } | undefined)?.data
  if (typeof data !== 'string' || !data) return { refused: 'no paths.data' }
  const value = ext[OPS_DIGEST_EXTENSION]
  if (!Array.isArray(value) || value.length < 1 || value.length > 8) return { refused: 'not 1 to 8 folders' }
  const folders: DigestFolder[] = []
  const sources = new Set<string>()
  const dirs = new Set<string>()
  for (const v of value) {
    if (!v || typeof v !== 'object' || Object.keys(v).sort().join() !== 'dir,source') return { refused: 'a folder is not {dir, source}' }
    const { dir, source } = v as Record<string, unknown>
    if (typeof source !== 'string' || !SOURCE.test(source)) return { refused: 'a source outside its grammar' }
    if (typeof dir !== 'string' || !dirFits(dir)) return { refused: 'a dir outside its grammar' }
    const key = foldDir(dir)
    if (sources.has(source) || dirs.has(key)) return { refused: 'a source or a dir named twice' }
    sources.add(source); dirs.add(key)
    folders.push({ dir, source })
  }
  return { folders }
}

/** A package path inside `paths.data`, read the four ways OD-9 reads it: no absolute or home start, no drive, no
 *  backslash, no empty, `.` or `..` segment, no home folder, no lone surrogate. */
export function dirFits(dir: string): boolean {
  if (!dir || dir.length > 256 || /^[/~]/.test(dir) || /^[A-Za-z]:/.test(dir) || dir.includes('\\')) return false
  if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(dir)) return false
  const ways = [dir, dir.replace(IGNORABLE, '')]
  for (const w of [...ways, ...ways.map((x) => x.split('/').map((s) => s.replace(/[. ]+$/u, '')).join('/'))]) {
    for (const seg of w.split('/')) if (seg === '' || seg === '.' || seg === '..') return false
    if (/(^|[^A-Za-z0-9])(home|users|Users)(\/|%2F|%252F)[A-Za-z0-9_]/i.test(w)) return false
    if (/(^|[^A-Za-z0-9])-(home|users|Users)-[A-Za-z0-9]/.test(w)) return false
  }
  return true
}

/** One folder under two spellings is one folder: compared caseless, without ignorable code points and trailing dots. */
export function foldDir(dir: string): string {
  return dir.replace(IGNORABLE, '').normalize('NFD').toLowerCase().toUpperCase().toLowerCase().normalize('NFC')
    .split('/').map((s) => s.replace(/[. ]+$/u, '')).join('/')
}

const whole = (n: unknown): n is number => Number.isSafeInteger(n) && (n as number) >= 0

/** Whether a parsed line is an `ops.digest.daily@1` a reader keeps: its shape, its names, its sums. */
export function dailyFits(x: unknown): x is { schema: 'ops.digest.daily@1'; day: string; hours: number } {
  if (!x || typeof x !== 'object') return false
  const d = x as Record<string, unknown>
  if (Object.keys(d).sort().join() !== 'day,hours,ops,risen,schema,total') return false
  if (d.schema !== 'ops.digest.daily@1' || typeof d.day !== 'string' || !DAY.test(d.day) || Number.isNaN(Date.parse(`${d.day}T00:00:00Z`))) return false
  if (!whole(d.hours) || d.hours < 1 || d.hours > 24) return false
  if (!Array.isArray(d.ops) || d.ops.length > OPS_MAX || !Array.isArray(d.risen) || d.risen.length > OPS_MAX) return false
  const sum = { ok: 0, failed: 0, unknown: 0 }
  const seen = new Set<string>()
  for (const c of d.ops as Array<Record<string, unknown>>) {
    if (!c || typeof c.op !== 'string' || c.op.length > OP_NAME_MAX || !fitsOpName(c.op) || seen.has(c.op)) return false
    if (!whole(c.ok) || !whole(c.failed) || !whole(c.unknown)) return false
    seen.add(c.op)
    sum.ok += c.ok; sum.failed += c.failed; sum.unknown += c.unknown
  }
  const t = d.total as Record<string, unknown> | undefined
  return !!t && t.ok === sum.ok && t.failed === sum.failed && t.unknown === sum.unknown
}

/** The key a line is sent under once (Observatory keys a record by project, service, source and day). */
export const sentKey = (service: ServiceRef, source: string, day: string): string => `${service.id}.${service.instance}|${source}|${day}`

/** The daily lines of one folder still to send: the first line a reader keeps for each closed day before `today`. */
export function pendingLines(text: string, service: ServiceRef, source: string, today: string, sent: ReadonlySet<string>): Array<{ day: string; line: string; key: string }> {
  const out: Array<{ day: string; line: string; key: string }> = []
  const days = new Set<string>()
  for (const line of text.split('\n')) {
    if (!line) continue
    let x: unknown
    try { x = JSON.parse(line) } catch {
      // A torn line is skipped, as every reader does.
      continue
    }
    if (!dailyFits(x) || days.has(x.day)) continue
    days.add(x.day)
    const key = sentKey(service, source, x.day)
    if (x.day < today && !sent.has(key)) out.push({ day: x.day, line, key })
  }
  return out
}
// #endregion ops-digest-collect
