// #region fabric-mcp-probe-runner — docs: docs/adr/0119-acp-is-the-generic-runner-drive-and-runners-are-catalogue-rows.md#4-connected-is-a-probe-result-not-a-flag
// Whether a coding agent opened in a terminal reaches Fabric (REQ-03 of 0.4.0, ADR-0134 §6): the runner's own config
// is read for its `fabric` entry (shared/fabricMcpRegistration.ts says where and how), the entry is compared with THIS
// Fabric's `bin/fabric-mcp` on real paths, and only then the registered command is started once and must answer MCP
// `initialize` as `fabric` and list `fabric_whoami`. Only that is `connected`.
//
// NOTHING IS ASKED OF THE OPERATOR AND NOTHING ENROLLS. The registered command is started with a throwaway home
// (HOME, XDG_DATA_HOME, LOCALAPPDATA, USERPROFILE all inside a temporary folder), so the fabric-mcp it starts finds no
// `hub.json`, never reaches the hub, and asks for nothing — the same isolation the release's packaged check uses
// (scripts/lib/smoke-platform.mjs). It inherits only PATH from Fabric's environment: no credential reaches it.
//
// BOUNDED. Every file call is asynchronous with a deadline (Electron's main thread never waits on a hung mount), a
// config larger than 16 MiB is not read, and the answer check is killed — its whole process group — at its bound. Its
// verdict is kept: ten minutes for an answer, thirty seconds for a failure, so a menu opening twice starts nothing new.
//
// NO SECRET IS READ OUT OR LOGGED. A config holds other servers' headers and keys: the readers return only the fabric
// entry's command and arguments, an unreadable file is a code, and the probe's `detail` is a fixed sentence.
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, realpath, rm, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  type Registration, type TerminalProbe, judgeEntry, readFabricEntry, registerLine, registrationOf
} from '../shared/fabricMcpRegistration.ts'
import { launchFor, processTreeStopInvocation } from './platform.ts'

/** A config larger than this is not a config file, and is not read. */
export const MAX_CONFIG_BYTES = 16 * 1024 * 1024
const FS_TIMEOUT_MS = 2000
export const ANSWER_TIMEOUT_MS = 10_000
const ANSWER_OK_TTL_MS = 10 * 60_000
const ANSWER_FAIL_TTL_MS = 30_000
/** The waiting tool every fabric-mcp lists (fabricMcp.ts#WAITING_TOOL). */
const WAITING_TOOL = 'fabric_whoami'

export interface ProbeFs {
  stat(p: string): Promise<{ size: number; isFile(): boolean }>
  readFile(p: string): Promise<string>
  realpath(p: string): Promise<string>
}
const REAL_FS: ProbeFs = { stat: (p) => stat(p), readFile: (p) => readFile(p, 'utf8'), realpath: (p) => realpath(p) }

export type Answer = { ok: true } | { ok: false; detail: string }
/** Starts `command args` and says whether it answered MCP as Fabric. */
export type AnswerCheck = (command: string, args: readonly string[]) => Promise<Answer>

async function bounded<T>(call: () => Promise<T>, ms: number): Promise<T | null> {
  let timer: NodeJS.Timeout | undefined
  try {
    return await Promise.race([call(), new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), ms) })])
  } catch {
    // Absent or unreadable is the answer "not there"; the caller turns it into a state.
    return null
  } finally {
    clearTimeout(timer)
  }
}

const expandHome = (p: string, home: string): string => (p === '~' ? home : p.startsWith('~/') ? path.join(home, p.slice(2)) : p)
const shownPath = (p: string, home: string): string => (p === home ? '~' : p.startsWith(home + path.sep) ? `~${p.slice(home.length)}` : p)

export interface ProbeDeps {
  env: Readonly<Record<string, string | undefined>>
  home: string
  /** This Fabric's `bin/fabric-mcp`, or null when it ships none (a development run). */
  launcher: string | null
  answer: AnswerCheck
  fs?: ProbeFs
  fsTimeoutMs?: number
}

/** The verdict for one runner. Never throws: a failure is a state. */
export async function probeTerminal(runner: string, deps: ProbeDeps): Promise<TerminalProbe> {
  const reg: Registration = registrationOf(runner)
  const fs = deps.fs ?? REAL_FS
  const ms = deps.fsTimeoutMs ?? FS_TIMEOUT_MS
  if (!reg.supported) return { runner, state: 'unsupported', config: null, register: null, detail: reg.reason }
  const launcher = deps.launcher ? await bounded(() => fs.realpath(deps.launcher as string), ms) : null
  const register = registerLine(reg, launcher ? deps.launcher : null)
  let unreadable: { config: string; detail: string } | null = null
  for (const loc of reg.locations) {
    const dir = (loc.dirEnv && deps.env[loc.dirEnv]) || expandHome(loc.dir, deps.home)
    for (const name of loc.files) {
      const file = path.join(dir, name)
      const config = shownPath(file, deps.home)
      const st = await bounded(() => fs.stat(file), ms)
      if (!st || !st.isFile()) continue
      if (st.size > MAX_CONFIG_BYTES) { unreadable ??= { config, detail: 'too-large' }; continue }
      const text = await bounded(() => fs.readFile(file), ms)
      if (text === null) { unreadable ??= { config, detail: 'not-read' }; continue }
      const read = readFabricEntry(reg.dialect, text)
      if (!read.ok) { unreadable ??= { config, detail: read.problem }; continue }
      if (!read.entry.found) continue
      const entry = read.entry
      let points: boolean | null = null
      if (launcher) {
        const target = entry.command && path.isAbsolute(entry.command) ? await bounded(() => fs.realpath(entry.command as string), ms) : null
        points = target !== null && target === launcher
      }
      const judged = judgeEntry({ entry, runner, pointsAtLauncher: points })
      if (judged.state !== 'ready-to-answer') return { runner, state: judged.state, config, register, detail: judged.detail }
      const answered = await deps.answer(entry.command as string, entry.args)
      return answered.ok
        ? { runner, state: 'connected', config, register, detail: null }
        : { runner, state: 'not-answering', config, register, detail: answered.detail }
    }
  }
  if (unreadable) return { runner, state: 'unreadable', config: unreadable.config, register, detail: unreadable.detail }
  if (!launcher) return { runner, state: 'no-launcher', config: null, register: null, detail: 'this Fabric build ships no bin/fabric-mcp' }
  return { runner, state: 'not-registered', config: null, register, detail: null }
}

/** Where this Fabric's launcher is: `<resources>/bin/fabric-mcp` (`.cmd` on Windows), or null. */
export async function launcherIn(resourcesPath: string | null, platform: NodeJS.Platform, fs: ProbeFs = REAL_FS): Promise<string | null> {
  if (!resourcesPath) return null
  const file = path.join(resourcesPath, 'bin', platform === 'win32' ? 'fabric-mcp.cmd' : 'fabric-mcp')
  const st = await bounded(() => fs.stat(file), FS_TIMEOUT_MS)
  return st?.isFile() ? file : null
}

const REQUESTS = [
  { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'fabric-probe', version: '1' } } },
  { jsonrpc: '2.0', method: 'notifications/initialized' },
  { jsonrpc: '2.0', id: 2, method: 'tools/list' }
]

/**
 * The real answer check: the registered command, a throwaway home, three MCP messages on stdin, the answers read
 * from stdout up to 1 MiB. `fabric` in `serverInfo.name` and `fabric_whoami` in the tool list, or a fixed sentence.
 */
export function answerCheck(opts: { env: Readonly<Record<string, string | undefined>>; platform?: NodeJS.Platform; timeoutMs?: number; tmpRoot?: string }): AnswerCheck {
  const platform = opts.platform ?? process.platform
  return async (command, args) => {
    const home = await mkdtemp(path.join(opts.tmpRoot ?? os.tmpdir(), 'fabric-mcp-probe-'))
    try {
      return await new Promise<Answer>((resolve) => {
        const env: Record<string, string> = {
          PATH: opts.env.PATH ?? '', HOME: home, USERPROFILE: home,
          XDG_DATA_HOME: path.join(home, '.local', 'share'), LOCALAPPDATA: path.join(home, 'AppData', 'Local'),
          TMPDIR: home, TEMP: home, TMP: home, ...(opts.env.SystemRoot ? { SystemRoot: opts.env.SystemRoot } : {})
        }
        const windows = platform === 'win32'
        const how = launchFor(command, [...args], platform)
        let child: ReturnType<typeof spawn>
        try {
          child = spawn(how.file, how.args, { env, cwd: home, detached: !windows, windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] })
        } catch {
          resolve({ ok: false, detail: 'the registered command could not be started' })
          return
        }
        let out = ''
        let done = false
        const answers = new Map<number, Record<string, unknown>>()
        const stop = (): void => {
          try {
            if (windows) {
              if (child.pid && child.exitCode === null) {
                const s = processTreeStopInvocation(child.pid, 'SIGKILL')
                spawn(s.file, s.args, { stdio: 'ignore', windowsHide: true })
              }
            } else if (child.pid) process.kill(-child.pid, 'SIGKILL')
          } catch {
            // The whole group is already gone: nothing left to stop.
          }
        }
        const finish = (a: Answer): void => {
          if (done) return
          done = true
          clearTimeout(timer)
          stop()
          child.stdout?.destroy()
          resolve(a)
        }
        const judge = (): void => {
          const init = answers.get(1)
          const list = answers.get(2)
          if (!init || !list) return
          const server = (init.result as { serverInfo?: { name?: unknown } } | undefined)?.serverInfo?.name
          if (server !== 'fabric') return finish({ ok: false, detail: 'the registered command answered as another MCP server' })
          const tools = ((list.result as { tools?: Array<{ name?: unknown }> } | undefined)?.tools ?? []).map((t) => t.name)
          finish(tools.includes(WAITING_TOOL) ? { ok: true } : { ok: false, detail: `the registered command answered as Fabric without ${WAITING_TOOL}` })
        }
        const timer = setTimeout(() => finish({ ok: false, detail: `the registered command did not answer MCP within ${Math.round((opts.timeoutMs ?? ANSWER_TIMEOUT_MS) / 1000)} s` }), opts.timeoutMs ?? ANSWER_TIMEOUT_MS)
        child.on('error', () => finish({ ok: false, detail: 'the registered command could not be started' }))
        // 'close', not 'exit': stdout may still hold the answers when the process has exited.
        child.on('close', () => finish({ ok: false, detail: 'the registered command exited before it answered MCP' }))
        child.stdin?.on('error', () => { /* It exited first; its exit says so. */ })
        child.stdout?.setEncoding('utf8')
        child.stdout?.on('data', (d: string) => {
          if (out.length > 1024 * 1024) return finish({ ok: false, detail: 'the registered command wrote more than an MCP answer' })
          out += d
          let nl: number
          while ((nl = out.indexOf('\n')) >= 0) {
            const line = out.slice(0, nl).trim()
            out = out.slice(nl + 1)
            if (!line) continue
            try {
              const msg = JSON.parse(line) as { id?: unknown }
              if (typeof msg.id === 'number') answers.set(msg.id, msg as Record<string, unknown>)
            } catch {
              // A line that is not JSON-RPC is not an answer (stdout must carry only MCP); keep reading.
            }
          }
          judge()
        })
        child.stdin?.write(REQUESTS.map((r) => JSON.stringify(r)).join('\n') + '\n')
      })
    } finally {
      await rm(home, { recursive: true, force: true }).catch(() => { /* A folder still held by an exiting process: the OS's temp clean-up has it. */ })
    }
  }
}

/** The answer check, remembered per command and arguments (an answer for ten minutes, a failure for thirty seconds). */
export function rememberedAnswers(check: AnswerCheck): AnswerCheck {
  const kept = new Map<string, { answer: Promise<Answer> }>()
  return (command, args) => {
    const key = [command, ...args].join('\0')
    const hit = kept.get(key)
    if (hit) return hit.answer
    const answer = check(command, args)
    const entry = { answer }
    kept.set(key, entry)
    void answer.then((a) => {
      setTimeout(() => { if (kept.get(key) === entry) kept.delete(key) }, a.ok ? ANSWER_OK_TTL_MS : ANSWER_FAIL_TTL_MS).unref?.()
    })
    return answer
  }
}
// #endregion fabric-mcp-probe-runner
