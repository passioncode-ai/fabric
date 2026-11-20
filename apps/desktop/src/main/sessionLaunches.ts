// #region session-launches-disk — docs: docs/evidence/specs/2026-11-19-session-launch-journal.md#4-on-disk
/**
 * The launch journal on disk (`shared/sessionLaunches.ts` is its pure half): one JSON line per event in
 * `<userData>/launches/launches-YYYY-MM.jsonl` (the month in UTC), the folder 0700 and the files 0600, appended in the
 * order the events happened and never rewritten; files older than 13 months are removed at start. A failed write is
 * said once per kind in the operations log and never stops a console. What it never holds: an argument list, an
 * environment, a token. The reason a caller gave is redacted and cut to 1 000 characters.
 */
import { gitRun } from './gitRun.ts'
import { mkdir, appendFile, readdir, readFile, rm, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { foldLaunches, endOf, parseLaunchLine, type Launch, type LaunchBy, type LaunchLine, type LaunchOrigin } from '../shared/sessionLaunches.ts'

export const KEEP_MONTHS = 13
/** How many months a read looks back by default. */
export const READ_MONTHS = 2
/** A month's file larger than this is read from its tail (a torn first line is dropped by the parser). */
export const READ_MAX_BYTES = 8 * 1024 * 1024
/** When the runner's own session id is looked for after a start, then every five minutes while it runs. */
export const RUNNER_SESSION_POLL_MS = [2_000, 6_000, 20_000, 60_000] as const
export const RUNNER_SESSION_EVERY_MS = 5 * 60_000

export interface LaunchJournalDeps {
  dir: string
  machine: string
  appVersion: string
  appPid: number
  now?: () => Date
  /** The redaction every text Fabric keeps goes through (`shared/redact.ts`). */
  redact: (text: string) => string
  /** The folder's branch, or null; never throws. */
  readBranch?: (cwd: string) => Promise<string | null>
  /** The runner's own session id for a process, or null; never throws (`claudeSessionOf`). */
  readRunnerSession?: (runner: string, pid: number, env: Record<string, string | undefined>) => Promise<string | null>
  /** One line of the operations log, said once per kind. */
  failed?: (kind: string, error: unknown) => void
  /** The quit coordinator's own word, read at each end beside `markQuitting`. */
  quitting?: () => boolean
  setTimer?: (fn: () => void, ms: number) => { cancel(): void }
}

export interface OpenedLaunch {
  sessionId: string
  projectId: string
  cwd: string
  runner: string
  optionId: string
  program: string
  pid: number | null
  origin: LaunchOrigin
  env?: Record<string, string | undefined>
}

const monthOf = (at: Date): string => at.toISOString().slice(0, 7)
const FILE = /^launches-(\d{4}-\d{2})\.jsonl$/

export function createLaunchJournal(deps: LaunchJournalDeps) {
  const now = deps.now ?? (() => new Date())
  const setTimer = deps.setTimer ?? ((fn, ms) => { const t = setTimeout(fn, ms); t.unref?.(); return { cancel: () => clearTimeout(t) } })
  const saidFailed = new Set<string>()
  const failed = (kind: string, e: unknown): void => {
    if (saidFailed.has(kind)) return
    saidFailed.add(kind)
    deps.failed?.(kind, e)
  }
  let quitFlag = false
  const quittingNow = (): boolean => quitFlag || (deps.quitting?.() ?? false)
  let ready: Promise<void> | null = null
  let tail: Promise<void> = Promise.resolve()
  const watches = new Map<string, { cancel(): void }>()
  const stopAsked = new Set<string>()
  /** Ended before its opening was written: no runner-session watch is started for it. */
  const endedEarly = new Set<string>()

  // DA-9 (0.3.26 review): a failed mkdir is tried again by the next write, never kept for the life of the process.
  const ensureDir = (): Promise<void> => (ready ??= mkdir(deps.dir, { recursive: true, mode: 0o700 }).then(() => undefined, (e: unknown) => { ready = null; throw e }))

  function write(line: LaunchLine): Promise<void> {
    const file = path.join(deps.dir, `launches-${monthOf(new Date(line.at))}.jsonl`)
    tail = tail.then(async () => {
      await ensureDir()
      await appendFile(file, JSON.stringify(line) + '\n', { mode: 0o600 })
    }).catch((e: unknown) => failed('write', e))
    return tail
  }
  const reasonOf = (t: string | undefined | null): string | null => (t ? deps.redact(t).slice(0, 1000) : null)

  function watchRunnerSession(sessionId: string, runner: string, pid: number, env: Record<string, string | undefined>): void {
    if (!deps.readRunnerSession) return
    let last: string | null = null
    let step = 0
    const look = (): void => {
      void deps.readRunnerSession!(runner, pid, env).then((id) => {
        if (!watches.has(sessionId)) return
        if (id && id !== last) {
          last = id
          void write({ v: 1, at: now().toISOString(), event: 'runner-session', session_id: sessionId, runner_session_id: id })
        }
        step++
        const wait = step < RUNNER_SESSION_POLL_MS.length ? RUNNER_SESSION_POLL_MS[step]! - RUNNER_SESSION_POLL_MS[step - 1]! : RUNNER_SESSION_EVERY_MS
        watches.set(sessionId, setTimer(look, wait))
      }, (e: unknown) => failed('runner-session', e))
    }
    watches.set(sessionId, setTimer(look, RUNNER_SESSION_POLL_MS[0]))
  }

  return {
    /** A console started. Written once its branch is read (at most the branch reader's deadline later). */
    async opened(o: OpenedLaunch): Promise<void> {
      const at = now().toISOString()
      const branch = deps.readBranch ? await deps.readBranch(o.cwd).catch(() => null) : null
      await write({
        v: 1, at, event: 'opened', session_id: o.sessionId, project_id: o.projectId, cwd: o.cwd, branch,
        runner: o.runner, option_id: o.optionId, program: o.program, by: o.origin.by, via: o.origin.via ?? null,
        reason: reasonOf(o.origin.reason), parent_session_id: o.origin.parentSessionId ?? null, task_id: o.origin.taskId ?? null,
        request_id: o.origin.requestId ?? null, machine: deps.machine, app_pid: deps.appPid, app_version: deps.appVersion, pid: o.pid
      })
      if (endedEarly.delete(o.sessionId)) return
      if (o.pid !== null && !quittingNow()) watchRunnerSession(o.sessionId, o.runner, o.pid, o.env ?? {})
    },
    /** Someone asked a console to stop: the person, the CEO. Its end then reads `stopped`, never a crash. */
    stopAsked(sessionId: string, by: LaunchBy, reason?: string): Promise<void> {
      stopAsked.add(sessionId)
      return write({ v: 1, at: now().toISOString(), event: 'stop-asked', session_id: sessionId, by, reason: reasonOf(reason) })
    },
    ended(sessionId: string, e: { exitCode: number | null; signal: number | null; stopRequested: boolean }): Promise<void> {
      const watch = watches.get(sessionId)
      if (watch) { watch.cancel(); watches.delete(sessionId) } else endedEarly.add(sessionId)
      const end = endOf({ quitting: quittingNow() && !stopAsked.has(sessionId), stopRequested: e.stopRequested || stopAsked.has(sessionId), signal: e.signal, exitCode: e.exitCode })
      stopAsked.delete(sessionId)
      return write({ v: 1, at: now().toISOString(), event: 'ended', session_id: sessionId, exit_code: e.exitCode, signal: e.signal, end })
    },
    /** Fabric is quitting: a console that ends from here on ends with the app, and is one a restore brings back. */
    markQuitting(): void { quitFlag = true },
    /** Every write queued so far, written (the quit waits for it). */
    flush(): Promise<void> { return tail },
    /** The launches of the last `months` months, newest first, optionally of one session, project or runner session. */
    async read(q: { months?: number; sessionId?: string; projectId?: string; limit?: number } = {}): Promise<Launch[]> {
      let names: string[]
      try { names = (await readdir(deps.dir)).filter((f) => FILE.test(f)).sort() } catch { return [] /* no launch written yet */ }
      const lines: LaunchLine[] = []
      for (const name of names.slice(-(q.months ?? READ_MONTHS))) {
        const file = path.join(deps.dir, name)
        try {
          const size = (await stat(file)).size
          let text = await readFile(file, 'utf8')
          if (size > READ_MAX_BYTES) text = text.slice(-READ_MAX_BYTES)
          for (const raw of text.split('\n')) {
            const l = raw.trim() ? parseLaunchLine(raw) : null
            if (l) lines.push(l)
          }
        } catch (e) { failed('read', e) /* said once in the operations log (`failed`); the other months still read */ }
      }
      let all = foldLaunches(lines)
      if (q.sessionId) all = all.filter((l) => l.sessionId === q.sessionId || l.runnerSessionId === q.sessionId)
      if (q.projectId) all = all.filter((l) => l.projectId === q.projectId)
      return q.limit ? all.slice(0, q.limit) : all
    },
    /** Files older than KEEP_MONTHS months removed; nothing else in the folder is touched. */
    async prune(): Promise<string[]> {
      const cutoff = new Date(now())
      cutoff.setUTCMonth(cutoff.getUTCMonth() - KEEP_MONTHS)
      const oldest = monthOf(cutoff)
      const removed: string[] = []
      let names: string[]
      try { names = await readdir(deps.dir) } catch { return removed /* nothing written yet */ }
      for (const name of names) {
        const m = FILE.exec(name)
        if (!m || m[1]! >= oldest) continue
        try { await rm(path.join(deps.dir, name)); removed.push(name) } catch (e) { failed('prune', e) /* said once in the operations log (`failed`); the next start tries again */ }
      }
      return removed
    },
    dispose(): void {
      for (const w of watches.values()) w.cancel()
      watches.clear()
    }
  }
}
export type LaunchJournal = ReturnType<typeof createLaunchJournal>

/** A folder's branch, through the hardened git runner (`gitRun.ts`), 2 s; null outside a repository or on any failure. */
export async function readGitBranch(repoPath: string): Promise<string | null> {
  try { return (await gitRun(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD'], { timeoutMs: 2000, killSignal: 'SIGKILL' })).trim().slice(0, 200) || null }
  catch { return null /* not a repository, or git did not answer: the launch is written without a branch */ }
}

/**
 * Claude Code's own session id for a process it runs: Claude Code writes `<config>/sessions/<pid>.json` with
 * `sessionId` and `pid` (measured on 2.1.299, 2026-11-19). The id is what `claude --resume` takes; it changes after
 * /clear, which is why it is read again while the console runs. Another runner: null, said as unknown.
 */
export async function claudeSessionOf(runner: string, pid: number, env: Record<string, string | undefined>): Promise<string | null> {
  if (runner !== 'claude-code') return null
  const config = env.CLAUDE_CONFIG_DIR || path.join(homedir(), '.claude')
  try {
    const j = JSON.parse(await readFile(path.join(config, 'sessions', `${pid}.json`), 'utf8')) as { pid?: unknown; sessionId?: unknown }
    return j.pid === pid && typeof j.sessionId === 'string' && /^[0-9a-f-]{36}$/i.test(j.sessionId) ? j.sessionId : null
  } catch { return null /* not written yet, or Claude Code ended: the next look reads it */ }
}
// #endregion session-launches-disk
