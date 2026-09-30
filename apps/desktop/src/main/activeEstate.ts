/**
 * Which Estate this app opens (first-slice plan A1-6b, ADR-0079 §3, SCR-48 "opened").
 *
 * A RECORDED CHOICE, NEVER A GUESS. With no file, the app opens its default Estate and says so.
 * With a file, it opens exactly the Estate recorded there. A file that cannot be read — broken,
 * foreign-owned, readable by others, a symlink, an unknown schema — is `unreadable`, and the app
 * stops with that reason rather than open some other Estate in its place: a restored Estate the
 * operator chose, silently swapped for the old one, is the failure this exists to prevent.
 *
 * Written 0600 through a temporary file and a rename, so a crash leaves the old choice or the new
 * one, never half of either.
 */
import { closeSync, existsSync, fsyncSync, lstatSync, openSync, readFileSync, renameSync, rmSync, writeSync } from 'node:fs'
import path from 'node:path'

export const DEFAULT_ESTATE = '00000000-0000-0000-0000-000000000001'
export const ACTIVE_ESTATE_FILE = 'active-estate.json'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
export type ActiveEstateRead =
  | { status: 'default' | 'recorded'; estateId: string }
  | { status: 'unreadable'; estateId: null; problem: string }

export function readActiveEstate(rootDir: string): ActiveEstateRead {
  const file = path.join(rootDir, ACTIVE_ESTATE_FILE)
  const unreadable = (problem: string): ActiveEstateRead => ({ status: 'unreadable', estateId: null, problem })
  let st
  try { st = lstatSync(file) } catch (e) {
    if ((e as { code?: string }).code === 'ENOENT') return { status: 'default', estateId: DEFAULT_ESTATE }
    return unreadable('the file recording the chosen Estate could not be opened')
  }
  if (!st.isFile() || st.isSymbolicLink()) return unreadable('the file recording the chosen Estate is not a plain file')
  if ((st.mode & 0o077) !== 0 || (process.getuid && st.uid !== process.getuid())) return unreadable('the file recording the chosen Estate is not private to this user')
  if (st.size > 4096) return unreadable('the file recording the chosen Estate is too large')
  let v: unknown
  try { v = JSON.parse(readFileSync(file, 'utf8')) } catch { /* Not silence: the reason is returned and the app stops on it. */ return unreadable('the file recording the chosen Estate is not valid JSON') }
  const o = v as Record<string, unknown>
  if (!o || typeof o !== 'object' || o.schema !== 'ActiveEstate@1' || typeof o.estate_id !== 'string' || !UUID.test(o.estate_id) || Object.keys(o).sort().join() !== 'estate_id,recorded_at,schema')
    return unreadable('the file recording the chosen Estate does not name one Estate')
  return { status: 'recorded', estateId: o.estate_id }
}

export function recordActiveEstate(rootDir: string, estateId: string): { ok: true } | { ok: false; reason: 'invalid_estate' | 'write_failed' } {
  if (typeof estateId !== 'string' || !UUID.test(estateId)) return { ok: false, reason: 'invalid_estate' }
  const file = path.join(rootDir, ACTIVE_ESTATE_FILE), tmp = file + '.tmp'
  try {
    rmSync(tmp, { force: true })
    const fd = openSync(tmp, 'wx', 0o600)
    try { writeSync(fd, JSON.stringify({ schema: 'ActiveEstate@1', estate_id: estateId, recorded_at: new Date().toISOString() })); fsyncSync(fd) } finally { closeSync(fd) }
    renameSync(tmp, file)
  } catch {
    // Not silence: the caller is told the choice was not recorded and must not restart into it.
    if (existsSync(tmp)) rmSync(tmp, { force: true })
    return { ok: false, reason: 'write_failed' }
  }
  const back = readActiveEstate(rootDir)
  return back.status === 'recorded' && back.estateId === estateId ? { ok: true } : { ok: false, reason: 'write_failed' }
}

/** The startup failure for an unreadable choice, classified by `startupFailure.ts`. */
export function activeEstateUnreadable(problem: string): Error & { code: string } {
  return Object.assign(new Error(problem), { code: 'FABRIC_ACTIVE_ESTATE_UNREADABLE' })
}
