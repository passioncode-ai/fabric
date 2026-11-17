// #region session-holds — docs: docs/evidence/specs/2026-11-16-turn-end-waits.md#44-a-live-session-the-duty-officer-must-not-close
/**
 * The turn-end spec's wave T4 (task f53de384): a live Claude Code session that holds a claim is marked with Switchboard
 * so its duty officer, a duplicate close, a session host's idle close and a restart wave leave it alone
 * (`switchboard monitor hold --session <id> --until <unix s>`, SB-399), until its newest claim expires; renewed as the
 * claims are, released (`--until 0`) when it holds none. Fabric keeps what it asked per session and asks again only when
 * the end moved by a minute or more, so a renewal every five minutes is one call. Every call has a deadline and no
 * shell; a failure is said once per session and end in the operations log, and the next change asks again.
 */

import { execFile } from 'node:child_process'
import { findOnPath, widenProbePath } from './executorDetect.ts'

/** Switchboard takes a hold at most seven days ahead. */
export const HOLD_MAX_MS = 7 * 24 * 60 * 60_000
/** A new end closer than this to the one asked is not asked again. */
export const HOLD_SLACK_MS = 60_000
export const HOLD_DEADLINE_MS = 10_000
/** A machine without Switchboard is looked at again this often. */
export const MISSING_RECHECK_MS = 10 * 60_000

/** The end to ask for a session holding claims that expire at `expiries` (ISO): the newest, at most seven days ahead;
 *  0 (release) when it holds none or all have expired. In Unix seconds, as Switchboard takes it. */
export function holdUntil(expiries: readonly string[], now: number): number {
  const live = expiries.map((e) => Date.parse(e)).filter((t) => Number.isFinite(t) && t > now)
  if (!live.length) return 0
  return Math.floor(Math.min(Math.max(...live), now + HOLD_MAX_MS) / 1000)
}

export interface HoldDeps {
  /** `switchboard monitor hold --session <id> --until <s>`; resolves with the exit code, rejects when it cannot run. */
  hold(sessionId: string, until: number): Promise<{ code: number; stderr: string }>
  failed(sessionId: string, until: number, why: string): void
}

export interface SessionHolds {
  /** Asks Switchboard to hold (or, with 0, release) this Claude Code session; nothing when the same end was asked. */
  set(sessionId: string, until: number): Promise<void>
  /** What was last asked for a session, for tests and the ops log. */
  asked(sessionId: string): number | undefined
}

const SESSION = /^[A-Za-z0-9._-]{1,128}$/

/** In the app: Switchboard found on the session PATH (widened as agent detection widens it, looked up once and again
 *  after a miss), `monitor hold` asked with a deadline and no shell. A machine without Switchboard holds nothing and
 *  says so once in the operations log. */
export function createMachineSessionHolds(env: Record<string, string | undefined>, failed: HoldDeps['failed']): SessionHolds {
  let file: string | null = null
  let lookedAt = Number.NEGATIVE_INFINITY
  let missingSaid = false
  // 0.3.22 review, iteration 1, ER-2: holds asked together share one lookup, so none reads the binary as missing while
  // the first lookup is still running.
  let looking: Promise<string | null> | null = null
  const find = async (): Promise<string | null> => {
    if (looking) return looking
    if (file || Date.now() - lookedAt < MISSING_RECHECK_MS) return file
    lookedAt = Date.now()
    looking = (async () => {
      const PATH = await widenProbePath(env.PATH ?? '', env as Record<string, string>)
      file = await findOnPath('switchboard', PATH)
      return file
    })().finally(() => { looking = null })
    return looking
  }
  return createSessionHolds({
    failed,
    hold: async (sessionId, until) => {
      const bin = await find()
      if (!bin) {
        // Nothing holds sessions on a machine without Switchboard: said once, then each hold is a quiet no-op.
        if (missingSaid) return { code: 0, stderr: '' }
        missingSaid = true
        throw new Error('switchboard is not installed on this machine, so no session is held')
      }
      return await new Promise((resolve, reject) => {
        execFile(bin, ['monitor', 'hold', '--session', sessionId, '--until', String(until)], { timeout: HOLD_DEADLINE_MS, maxBuffer: 256 * 1024 }, (err, _stdout, stderr) => {
          const exit = (err as { code?: unknown } | null)?.code
          if (err && typeof exit !== 'number') return reject(err)
          resolve({ code: err ? (exit as number) : 0, stderr: String(stderr) })
        })
      })
    }
  })
}

export function createSessionHolds(deps: HoldDeps): SessionHolds {
  const asked = new Map<string, number>()
  const inFlight = new Set<string>()
  // 0.3.22 review, iteration 1, DO-9: a change asked while a call for the same session runs (a release while its hold is
  // in flight) is kept, newest wins, and asked once that call ends, so a release is never dropped.
  const next = new Map<string, number>()
  const holds: SessionHolds = {
    async set(sessionId, until) {
      if (!SESSION.test(sessionId)) return
      if (inFlight.has(sessionId)) { next.set(sessionId, until); return }
      const was = asked.get(sessionId)
      if (until === 0 ? was === undefined || was === 0 : was !== undefined && was !== 0 && Math.abs(was - until) * 1000 < HOLD_SLACK_MS) return
      inFlight.add(sessionId)
      try {
        const r = await deps.hold(sessionId, until)
        if (r.code === 0) {
          if (until === 0) asked.delete(sessionId)
          else asked.set(sessionId, until)
        } else deps.failed(sessionId, until, `exit ${r.code}: ${r.stderr.trim().slice(0, 300)}`)
      } catch (e) {
        // Said through `failed` (ops.failed in the app); nothing is remembered, so the next change asks again.
        deps.failed(sessionId, until, e instanceof Error ? e.message : String(e))
      } finally {
        inFlight.delete(sessionId)
      }
      const later = next.get(sessionId)
      if (later !== undefined) {
        next.delete(sessionId)
        await holds.set(sessionId, later)
      }
    },
    asked: (sessionId) => asked.get(sessionId)
  }
  return holds
}
// #endregion session-holds
