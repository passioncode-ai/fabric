// #region record-show-main — docs: docs/ux/scenarios.md#scn-188-show-the-ceo-what-you-mean
/**
 * «Записать показ» and «Снимок» in Fabric (SCN-188). The recorder is `scripts/record-show/record-show.mjs`, shipped
 * in the bundle's `Resources/record-show` and run by Electron's own binary as Node; it writes one folder per session
 * outside Git. This module starts and stops it, and watches the sessions it names a target for: each chunk and
 * screenshot, as soon as it is ready, is copied flat into the CEO's inbox (paths rewritten) and typed into the CEO
 * conversation, or added to a task as a note. What was delivered is kept in the session folder
 * (`fabric-delivered.json`), so a restart delivers nothing twice. A session older than `WATCH_MS` is left alone.
 */
import { spawn } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, renameSync } from 'node:fs'
import path from 'node:path'
import {
  IDLE_STATE, ceoText, duePieces, inboxFileName, noteBody, referencedFiles, refusalOf, rewritePaths, saidIn,
  type RecordShowAnswer, type RecordShowEvent, type RecordShowState, type RecordShowTarget, type ShotEntry
} from '../shared/recordShow.ts'

/** Sessions touched in the last six hours are watched; older ones were delivered or were never meant to be. */
export const WATCH_MS = 6 * 60 * 60_000
/** How often the sessions folder is read: one readdir and a stat per recent session. */
export const POLL_MS = 2000
const DELIVERED = 'fabric-delivered.json'

export interface RecordShowDeps {
  /** The recorder script, or null when this build does not carry it. */
  script: string | null
  /** The binary that runs it as Node, and the environment it needs. */
  node: string
  env: Record<string, string>
  /** Where the script keeps its sessions (`RECORD_SHOW_DIR`). */
  root: string
  /** The CEO's inbox, `<userData>/ceo/inbox`. */
  inbox: string
  locale(): string
  /** Type text, with files named by absolute path, into the CEO conversation; true once written. */
  toCeo(text: string, files: string[]): Promise<boolean>
  toTask(taskId: string, body: string): Promise<void>
  emit(event: RecordShowEvent): void
  record(op: string, data?: Record<string, unknown>): void
  now?: () => number
  platform?: NodeJS.Platform
}

interface Run { code: number | null; out: Record<string, unknown> | null; err: string }

function readJson<T>(file: string): T | null {
  try { return JSON.parse(readFileSync(file, 'utf8')) as T } catch { /* absent or half-written by the script: read again on the next pass */ return null }
}

function alive(pid: unknown): boolean {
  if (typeof pid !== 'number' || pid <= 0) return false
  try { process.kill(pid, 0); return true } catch { /* no such process: the recording has ended */ return false }
}

export function createRecordShow(deps: RecordShowDeps) {
  const now = deps.now ?? Date.now
  const available = Boolean(deps.script) && (deps.platform ?? process.platform) === 'darwin'
  let timer: NodeJS.Timeout | null = null
  let busy = false
  let last = JSON.stringify(IDLE_STATE)

  function run(args: string[], timeoutMs: number): Promise<Run> {
    return new Promise((resolve) => {
      if (!deps.script) return resolve({ code: null, out: null, err: 'unavailable' })
      const child = spawn(deps.node, [deps.script, ...args, '--json'], {
        env: { ...process.env, ...deps.env, RECORD_SHOW_DIR: deps.root },
        stdio: ['ignore', 'pipe', 'pipe']
      })
      let out = ''
      let err = ''
      child.stdout.on('data', (b: Buffer) => { out += b.toString('utf8') })
      child.stderr.on('data', (b: Buffer) => { err += b.toString('utf8') })
      const kill = setTimeout(() => child.kill('SIGKILL'), timeoutMs)
      child.on('error', (e) => { clearTimeout(kill); resolve({ code: null, out: null, err: e.message }) })
      child.on('close', (code) => {
        clearTimeout(kill)
        const lastLine = out.trim().split('\n').pop() ?? ''
        let parsed: Record<string, unknown> | null = null
        try { parsed = JSON.parse(lastLine) as Record<string, unknown> } catch { /* the script's own words are in err */ }
        resolve({ code, out: parsed, err: err.trim() })
      })
    })
  }

  /** The live session from the script's `current.json`, read directly: cheap enough for every poll. */
  function state(): RecordShowState {
    if (!available) return IDLE_STATE
    const c = readJson<{ dir?: string; ffmpegPid?: number; startedAt?: string }>(path.join(deps.root, 'current.json'))
    if (!c?.dir || !alive(c.ffmpegPid)) return { ...IDLE_STATE, available }
    const session = readJson<{ deliver?: RecordShowTarget | null }>(path.join(c.dir, 'session.json'))
    const manifest = readJson<{ items?: Array<{ kind?: string }> }>(path.join(c.dir, 'manifest.json'))
    return {
      available, recording: true, startedAt: c.startedAt ?? null, deliver: session?.deliver ?? null,
      chunksReady: manifest?.items?.filter((i) => i.kind === 'chunk').length ?? 0
    }
  }

  function answer(r: Run): RecordShowAnswer {
    const s = state()
    if (r.code === 0) return r.out?.cancelled ? { ok: false, reason: 'cancelled', message: '', state: s } : { ok: true, state: s }
    const message = String((r.out?.error as string | undefined) ?? r.err ?? '').trim()
    deps.record('record-show.refused', { code: r.code ?? -1 })
    return { ok: false, reason: r.code === null ? 'failed' : refusalOf(r.code), message, state: s }
  }

  async function toggle(to: RecordShowTarget): Promise<RecordShowAnswer> {
    if (!available) return { ok: false, reason: 'unavailable', message: '', state: state() }
    const recording = state().recording
    // A stop returns at once: the worker finishes the last chunk and the watch delivers it.
    const r = await run(recording ? ['stop', '--no-wait', '--no-copy'] : ['start', '--to', to], 60_000)
    deps.record(recording ? 'record-show.stopped' : 'record-show.started', { code: r.code ?? -1, to: to === 'ceo' ? 'ceo' : 'task' })
    const a = answer(r)
    changed()
    watch()
    return a
  }

  async function shot(mode: 'area' | 'window' | 'screen', to: RecordShowTarget): Promise<RecordShowAnswer> {
    if (!available) return { ok: false, reason: 'unavailable', message: '', state: state() }
    const r = await run(['shot', ...(mode === 'area' ? [] : [`--${mode}`]), '--to', to], 5 * 60_000)
    deps.record('record-show.shot', { code: r.code ?? -1, mode })
    watch()
    const a = answer(r)
    void tick()
    return a
  }

  function changed(delivered?: RecordShowEvent['delivered']): void {
    const s = state()
    const key = JSON.stringify(s)
    if (key === last && !delivered) return
    last = key
    deps.emit(delivered ? { state: s, delivered } : { state: s })
  }

  /** Session folders touched within `WATCH_MS`, newest last. */
  function recentSessions(): string[] {
    let names: string[] = []
    try { names = readdirSync(deps.root) } catch { /* no recording made yet: the folder appears with the first */ return [] }
    const cutoff = now() - WATCH_MS
    return names
      .map((n) => path.join(deps.root, n))
      .filter((d) => { try { const st = statSync(d); return st.isDirectory() && st.mtimeMs >= cutoff } catch { /* removed between the listing and the stat */ return false } })
      .sort()
  }

  function shotsOf(dir: string): ShotEntry[] {
    try {
      return readFileSync(path.join(dir, 'shots.jsonl'), 'utf8').split('\n').filter(Boolean)
        .map((l) => { try { return JSON.parse(l) as ShotEntry } catch { /* a line the script is still writing: read on the next pass */ return null } })
        .filter((s): s is ShotEntry => Boolean(s))
    } catch { /* no shots.jsonl yet: no screenshot taken */ return [] }
  }

  async function deliverSession(dir: string): Promise<void> {
    const session = readJson<{ deliver?: string | null }>(path.join(dir, 'session.json'))
    const deliveredFile = path.join(dir, DELIVERED)
    const delivered = readJson<string[]>(deliveredFile) ?? []
    let files: string[] = []
    try { files = readdirSync(dir) } catch { /* removed by the script's cleanup between the listing and now */ return }
    const due = duePieces({
      name: path.basename(dir), deliver: session?.deliver ?? null,
      chunkFiles: files.filter((f) => /^chunk-\d+\.md$/.test(f)), shots: shotsOf(dir), delivered
    })
    for (const piece of due) {
      const ok = await deliverPiece(dir, piece)
      if (!ok) return // tried again on the next poll
      delivered.push(piece.key)
      writeFileSync(`${deliveredFile}.tmp`, JSON.stringify(delivered))
      renameSync(`${deliveredFile}.tmp`, deliveredFile)
    }
  }

  async function deliverPiece(dir: string, piece: ReturnType<typeof duePieces>[number]): Promise<boolean> {
    const name = path.basename(dir)
    const manifest = readJson<{ items?: Array<{ kind?: string; index?: number; start?: number; end?: number }> }>(path.join(dir, 'manifest.json'))
    const chunk = manifest?.items?.find((i) => i.kind === 'chunk' && i.index === piece.index)
    const copy = (rel: string): string => {
      mkdirSync(deps.inbox, { recursive: true, mode: 0o700 })
      const target = path.join(deps.inbox, inboxFileName(name, rel))
      if (!existsSync(target)) copyFileSync(path.join(dir, rel), target)
      return target
    }
    try {
      if (piece.kind === 'shot') {
        const file = copy(piece.file)
        if (piece.to === 'ceo') {
          if (!(await deps.toCeo(ceoText({ kind: 'shot' }, deps.locale()), [file]))) return false
        } else await deps.toTask(piece.to.slice(5), `![](file://${encodeURI(file)})\n\n${file}`)
      } else {
        const md = readFileSync(path.join(dir, piece.file), 'utf8')
        const absolute = new Map(referencedFiles(md).filter((rel) => existsSync(path.join(dir, rel))).map((rel) => [rel, copy(rel)]))
        const body = rewritePaths(md, (rel) => absolute.get(rel) ?? path.join(dir, rel))
        if (piece.to === 'ceo') {
          const target = path.join(deps.inbox, inboxFileName(name, piece.file))
          writeFileSync(target, body, { mode: 0o600 })
          const text = ceoText({ kind: 'chunk', index: piece.index, start: chunk?.start, end: chunk?.end }, deps.locale())
          if (!(await deps.toCeo(text, [target]))) return false
        } else await deps.toTask(piece.to.slice(5), noteBody(body))
      }
    } catch (e) {
      // Recorded in the ops log through deps.record; the piece is offered again on the next pass.
      deps.record('record-show.delivery-failed', { kind: piece.kind, error: e instanceof Error ? e.name : 'unknown' })
      return false
    }
    deps.record('record-show.delivered', { kind: piece.kind, to: piece.to === 'ceo' ? 'ceo' : 'task' })
    changed({
      kind: piece.kind, to: piece.to,
      ...(piece.kind === 'chunk' ? { index: piece.index, said: saidIn(manifest, piece.index ?? -1), start: chunk?.start, end: chunk?.end } : {})
    })
    return true
  }

  /** One pass: every recent session's due pieces, then the state. One pass at a time. */
  async function tick(): Promise<void> {
    if (busy || !available) return
    busy = true
    try {
      const sessions = recentSessions()
      for (const dir of sessions) await deliverSession(dir)
      changed()
    } finally { busy = false }
  }

  function watch(): void {
    if (timer || !available) return
    timer = setInterval(() => { void tick() }, POLL_MS)
    timer.unref?.()
  }

  function stop(): void {
    if (timer) clearInterval(timer)
    timer = null
  }

  return { state, toggle, shot, tick, watch, stop, available }
}

export type RecordShow = ReturnType<typeof createRecordShow>

/** The recorder in this build: the bundle's `Resources/record-show`, else the repository's `scripts/record-show`. */
export function recordShowScript(resourcesPath: string | undefined, appPath: string, exists: (f: string) => boolean = existsSync): string | null {
  const candidates = [
    resourcesPath ? path.join(resourcesPath, 'record-show', 'record-show.mjs') : null,
    path.resolve(appPath, '..', '..', 'scripts', 'record-show', 'record-show.mjs')
  ].filter((p): p is string => Boolean(p))
  return candidates.find((p) => exists(p)) ?? null
}
// #endregion record-show-main
