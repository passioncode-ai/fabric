// #region ceo-tools — docs: docs/adr/0197-the-ceo-is-a-console-session-fabric-keeps-with-a-fallback-runner.md#the-session-control-tools
/**
 * The CEO's session control (ADR-0197 §3; board task 3fc98668): list every session of this computer, read one, type
 * into one, start one in a project, stop or kill one, continue one that ended, open one for the person. One set of
 * operations with two doors: MCP tools on the agent surface, registered only for the CEO's own session
 * (`registerCeoTools`), and the voice call's function tools, run in the main process (`runCeoTool`). Each act is
 * recorded with its reason (`record`), and a stop or a start also as an act in История (the host's `note`).
 *
 * What is NOT here: a second implementation of any door. A start is the person's console launch (`openConsole`), a
 * stop the person's stop (`stop`), Switchboard's sessions its own CLI. The CEO never acts on its own console.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { TerminalSession } from '../shared/types.ts'
import { decodePty } from '../shared/pty-decode.ts'
import { findProject, keyBytes, screenText, typedText, type NamedProject } from '../shared/ceoAgent.ts'
import { redact } from '../shared/redact.ts'
import { chainOf, type Launch, type LaunchVia } from '../shared/sessionLaunches.ts'
import { withLaunchOrigin } from './launchOrigin.ts'
import type { DiskSession } from './diskSessions.ts'

const reason = z.string().trim().min(3).max(400).describe('Why: one sentence the owner reads in History.')
const sessionId = z.string().trim().min(1).max(128).describe('A session id from fabric_ceo_sessions (a Fabric console\'s or a Switchboard session\'s).')

/** The closed set, in the order the model reads it; each description says when to use it and which neighbour it is not. */
export const CEO_TOOLS = {
  sessions: {
    mcp: 'fabric_ceo_sessions',
    title: 'Every session on this computer',
    description: 'Every coding session on this computer: the consoles Fabric runs (with project, runner, state and the last line) and the sessions Switchboard sees (needs you, running, waiting on a limit; ended ones only with include_ended). Use it first; to read what one session shows use fabric_ceo_session_read.',
    input: z.object({
      include_ended: z.boolean().optional().describe('Also the sessions that ended (Fabric consoles still listed, Switchboard\'s last day).'),
      project: z.string().trim().max(200).optional().describe('Only the sessions of this project (name, id or folder).')
    }).strict()
  },
  read: {
    mcp: 'fabric_ceo_session_read',
    title: 'What a session shows',
    description: 'What one session shows now: a Fabric console\'s screen as text (its last lines), or a Claude Code session\'s last turns from its transcript. Use it before you answer a session, stop it or report on it.',
    input: z.object({ session_id: sessionId, lines: z.number().int().min(5).max(300).optional().describe('How many lines of the screen; 60 by default.') }).strict()
  },
  input: {
    mcp: 'fabric_ceo_session_input',
    title: 'Type into a Fabric console',
    description: 'Type text into a running Fabric console and press keys: answer its question, pick an option (a digit, up or down then enter), confirm (y, enter), interrupt (escape, ctrl-c). Text is followed by Enter unless submit is false or keys are given. Works for Fabric consoles only; a Switchboard session outside Fabric cannot be typed into.',
    input: z.object({
      session_id: sessionId,
      text: z.string().max(8000).optional().describe('Words to type.'),
      keys: z.array(z.string().trim().max(12)).max(20).optional().describe('Keys pressed after the text, in order: enter, escape, tab, backspace, space, up, down, left, right, ctrl-c, ctrl-d, or one digit or letter.'),
      submit: z.boolean().optional().describe('Press Enter after the text (default true when no keys are given).'),
      reason
    }).strict()
  },
  start: {
    mcp: 'fabric_ceo_session_start',
    title: 'Start a session in a project',
    description: 'Start a coding session in a project as its own Fabric console, with its first task. Name the project by its name, id or folder (fabric_ceo_projects lists them); a folder Fabric does not know becomes a project. Use it for new work; to steer a running session use fabric_ceo_session_input.',
    input: z.object({
      project: z.string().trim().min(1).max(400).describe('The project\'s name, id or absolute folder.'),
      task: z.string().trim().max(8000).optional().describe('The first instruction the session is given.'),
      runner: z.enum(['claude-code', 'codex', 'hermes', 'kimi-code', 'kilo', 'shell']).optional().describe('The coding agent; the project\'s own by default.'),
      reason
    }).strict()
  },
  stop: {
    mcp: 'fabric_ceo_session_stop',
    title: 'Stop or kill a session',
    description: 'Stop a session. A Fabric console stops as the person\'s own stop (force true kills it at once). A Switchboard session held by its session host ends through Switchboard; any other process on this computer is sent SIGTERM only with force true. Read the session first; never stop a session without a reason.',
    input: z.object({ session_id: sessionId, force: z.boolean().optional().describe('Kill it now instead of asking it to stop.'), reason }).strict()
  },
  resume: {
    mcp: 'fabric_ceo_session_resume',
    title: 'Continue a session that ended',
    description: 'Continue a session that ended: a Fabric console starts again in its project with the same runner (and the task you give, or one that says to carry on); a Switchboard session continues as itself (claude --resume in a Terminal window of its own).',
    input: z.object({ session_id: sessionId, task: z.string().trim().max(8000).optional(), reason }).strict()
  },
  open: {
    mcp: 'fabric_ceo_session_open',
    title: 'Open a session for the owner',
    description: 'Open a Fabric console in a window of its own for the owner to watch or type in. Only Fabric consoles open here.',
    input: z.object({ session_id: sessionId, reason }).strict()
  },
  launches: {
    mcp: 'fabric_ceo_launches',
    title: 'Who started which session',
    description: 'The launch history Fabric keeps on disk: every console it started, who asked (the owner on a screen, you, a routine, a chain, a board run, a restore), through what (console, voice), the reason given, the chain above it, the project, folder, branch, runner, the runner\'s own session id (what claude --resume takes) and how it ended (exited, stopped, crashed, app-quit; none when it runs or was cut by a restart). Use it for «who started this», to find what to continue after a restart, or to trace a chain; to see what runs now use fabric_ceo_sessions.',
    input: z.object({
      session_id: z.string().trim().min(1).max(128).optional().describe('Only this session: its Fabric id or its runner\'s own id.'),
      project: z.string().trim().max(200).optional().describe('Only this project (name, id or folder).'),
      open_only: z.boolean().optional().describe('Only launches with no end written: running now, or cut by a restart of Fabric or the computer.'),
      limit: z.number().int().min(1).max(100).optional().describe('How many, newest first; 30 by default.')
    }).strict()
  },
  projects: {
    mcp: 'fabric_ceo_projects',
    title: 'Fabric\'s projects',
    description: 'The projects Fabric knows, with their folders, default runner and how many of their consoles run. Use it to find where to start or look; Observatory knows every project of the computer.',
    input: z.object({ query: z.string().trim().max(200).optional().describe('Only projects whose name or folder holds these words.') }).strict()
  }
} as const

export type CeoToolName = keyof typeof CEO_TOOLS

/** One row of `switchboard --json sessions --rows`, as far as this module reads it. */
export interface MachineRow {
  session_id: string | null
  launch_id: string | null
  pid: number | null
  agent: string
  folder: string
  group: string
  why: string | null
  acts: string[]
}

export interface CeoOpsDeps {
  /** The consoles Fabric runs. */
  ptys: {
    list(): TerminalSession[]
    get(sessionId: string): TerminalSession | null
    scrollbackOf(sessionId: string): { text: string } | null
    write(sessionId: string, data: string): void
  }
  /** The CEO's own console: never typed into, stopped or killed through these tools. */
  ceoSessionId(): string | null
  projects(): Promise<Array<NamedProject & { default_agent?: string | null }>>
  /** A folder Fabric does not know, admitted as a project (the person's own admission). */
  admitFolder(folder: string): Promise<NamedProject>
  /** The person's console launch (`consoleOpen.ts`). */
  openConsole(projectId: string, runner: string, task: string | undefined): Promise<TerminalSession>
  /** The person's stop (`terminal.end`'s runtime). */
  stop(sessionId: string, force: boolean): Promise<{ state: string }>
  openWindow(sessionId: string): void
  /** `switchboard --json <args>`; null when Switchboard is not installed. Throws when it could not be read. */
  switchboard(args: string[]): Promise<{ code: number; stdout: string; stderr: string } | null>
  /** SIGTERM to a process outside Fabric. */
  signal(pid: number): void
  /** One line of the operations log, never thrown. */
  record(op: string, detail: Record<string, unknown>): void
  /** An act in История (`acts.note`), never thrown. */
  /** An act in История. `machine`: a session Switchboard runs, whose act has no inverse in Fabric. */
  note(kind: 'session.start' | 'session.stop', d: { sessionId: string; projectId: string | null; label: string; runner: string; reason: string; machine?: boolean }): void
  /** Wait, for the screen after typing; the tests pass none. */
  sleep?(ms: number): Promise<void>
  /** Where Claude Code keeps transcripts: the person's home, then Switchboard's runtimes. */
  transcriptRoots?: string[]
  /** The launch journal (`sessionLaunches.ts`), newest first; absent: no journal on this host. */
  launches?(q: { sessionId?: string; projectId?: string }): Promise<Launch[]>
  /** The Claude Code processes running on this computer, read from Claude Code's own files (`diskSessions.ts`). */
  diskSessions?(): Promise<DiskSession[]>
}

type Answer = Record<string, unknown>
const refuse = (why: string, extra: Answer = {}): Answer => ({ ok: false, reason: why, ...extra })

export function parseMachineRows(stdout: string): MachineRow[] | null {
  try {
    const j = JSON.parse(stdout) as { data?: { rows?: unknown } }
    const rows = j?.data?.rows
    if (!Array.isArray(rows)) return null
    return rows.flatMap((r): MachineRow[] => {
      if (!r || typeof r !== 'object') return []
      const x = r as Record<string, unknown>
      const str = (v: unknown, max = 200): string | null => (typeof v === 'string' && v ? v.slice(0, max) : null)
      if (typeof x.folder !== 'string') return []
      return [{
        session_id: str(x.session_id, 128), launch_id: str(x.launch_id, 128),
        pid: typeof x.pid === 'number' && Number.isInteger(x.pid) && x.pid > 1 ? x.pid : null,
        agent: str(x.agent, 64) ?? 'unknown', folder: x.folder.slice(0, 400), group: str(x.group, 32) ?? 'unknown',
        why: str(x.why, 120), acts: Array.isArray(x.acts) ? x.acts.filter((a): a is string => typeof a === 'string').slice(0, 8) : []
      }]
    })
  } catch {
    // Not JSON: the caller says the list was not read, never that it is empty.
    return null
  }
}

/** The last turns of a Claude Code transcript (JSONL): who spoke, their words, the tools they called. */
export function transcriptTurns(jsonl: string, max = 12): Array<{ role: string; text: string }> {
  const turns: Array<{ role: string; text: string }> = []
  for (const line of jsonl.split('\n')) {
    if (!line.trim()) continue
    let row: { type?: unknown; message?: { role?: unknown; content?: unknown } }
    try { row = JSON.parse(line) } catch { continue /* a line cut while being written: the rest still reads */ }
    if (row.type !== 'user' && row.type !== 'assistant') continue
    const content = row.message?.content
    const parts: string[] = []
    if (typeof content === 'string') parts.push(content)
    else if (Array.isArray(content))
      for (const c of content as Array<Record<string, unknown>>) {
        if (c?.type === 'text' && typeof c.text === 'string') parts.push(c.text)
        else if (c?.type === 'tool_use' && typeof c.name === 'string') parts.push(`[tool ${c.name}]`)
        else if (c?.type === 'tool_result') parts.push('[tool result]')
      }
    const text = parts.join(' ').replace(/\s+/g, ' ').trim()
    if (!text || text === '[tool result]') continue
    turns.push({ role: String(row.type), text: text.slice(0, 700) })
  }
  return turns.slice(-max)
}

export function findTranscript(roots: readonly string[], id: string): string | null {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null
  const name = `${id}.jsonl`
  const tryProjects = (projects: string): string | null => {
    let dirs: string[]
    try { dirs = readdirSync(projects) } catch { return null /* no projects folder in this root */ }
    for (const d of dirs) {
      const f = path.join(projects, d, name)
      if (existsSync(f)) return f
    }
    return null
  }
  for (const root of roots) {
    const direct = tryProjects(path.join(root, 'projects'))
    if (direct) return direct
    // Switchboard's runtimes: <root>/<home>/projects, one level down.
    let homes: string[]
    try { homes = readdirSync(root) } catch { continue /* a root not on this computer */ }
    for (const h of homes.slice(0, 200)) {
      const found = tryProjects(path.join(root, h, 'projects'))
      if (found) return found
    }
  }
  return null
}

export function defaultTranscriptRoots(): string[] {
  const home = homedir()
  return [path.join(home, '.claude'), path.join(home, 'Library/Application Support/ai.passioncode.fabric-switchboard/runtimes')]
}

export function createCeoOperations(deps: CeoOpsDeps) {
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const projectNames = async (): Promise<Map<string, string>> => {
    try { return new Map((await deps.projects()).map((p) => [p.id, p.name])) } catch { return new Map() /* names are a courtesy: ids still answer */ }
  }
  const machineRows = async (): Promise<{ rows: MachineRow[] } | { unread: string }> => {
    try {
      const r = await deps.switchboard(['--json', 'sessions', '--rows'])
      if (!r) return { unread: 'Switchboard is not installed on this computer' }
      if (r.code !== 0) return { unread: `switchboard answered ${r.code}: ${r.stderr.slice(0, 200)}` }
      const rows = parseMachineRows(r.stdout)
      return rows ? { rows } : { unread: 'switchboard did not answer in JSON' }
    } catch (e) { /* said to the caller as the tool's refusal, never as success; the act's record says it failed */
      return { unread: e instanceof Error ? e.message.slice(0, 200) : String(e) }
    }
  }
  const screen = (id: string, lines: number): string => {
    const sb = deps.ptys.scrollbackOf(id)
    // DA-6: what the CEO reads goes to its model (and to xAI during a call): Fabric's redaction first.
    return sb ? redact(screenText(decodePty(sb.text), lines)).text : ''
  }
  const launchesOf = async (q: { sessionId?: string; projectId?: string } = {}): Promise<Map<string, Launch>> => {
    try { return new Map((await deps.launches?.(q) ?? []).map((l) => [l.sessionId, l])) } catch { return new Map() /* the journal is a courtesy here: the consoles still answer */ }
  }
  const consoleRow = (s: TerminalSession, names: Map<string, string>, launches: Map<string, Launch> = new Map()): Answer => {
    const l = launches.get(s.sessionId)
    return {
      session_id: s.sessionId, kind: 'fabric-console', project: names.get(s.projectId) ?? null, project_id: s.projectId,
      folder: s.cwd, runner: s.optionId, state: s.state, running: s.running, started_at: s.startedAt,
      last_activity_at: s.lastActivityAt, last_line: redact(s.tail).text.slice(0, 200), is_ceo: s.sessionId === deps.ceoSessionId(),
      ...(l ? { launched_by: l.by, via: l.via, branch: l.branch, parent_session_id: l.parentSessionId, runner_session_id: l.runnerSessionId } : {})
    }
  }

  async function sessions(a: z.infer<typeof CEO_TOOLS.sessions.input>): Promise<Answer> {
    const names = await projectNames()
    let consoles = deps.ptys.list().filter((s) => a.include_ended || s.running)
    let folderFilter: string | null = null
    if (a.project) {
      const found = findProject(await deps.projects(), a.project)
      if ('ambiguous' in found) return refuse(`«${a.project}» names several projects: ${found.ambiguous.join(', ')}`)
      if ('missing' in found) return refuse(`no project «${a.project}»`)
      consoles = consoles.filter((s) => s.projectId === found.found.id)
      folderFilter = found.found.repo_path
    }
    const [machine, launches] = await Promise.all([machineRows(), launchesOf()])
    const fabricIds = new Set(deps.ptys.list().map((s) => s.sessionId))
    const seen = new Set<string>()
    const rows = 'rows' in machine ? machine.rows.filter((r) => {
      if (!a.include_ended && r.group === 'ended') return false
      if (folderFilter && !r.folder.startsWith(folderFilter)) return false
      const key = `${r.session_id ?? ''}:${r.pid ?? ''}:${r.launch_id ?? ''}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).slice(0, 80).map((r) => ({ ...r, in_fabric: r.session_id ? fabricIds.has(r.session_id) : false })) : null
    // Switchboard unread: the Claude Code processes running here, from Claude Code's own files (board request eef5abeb,
    // point 4), so the machine's sessions are still seen; the Fabric consoles among them are left out.
    let onDisk: Answer[] | undefined
    if (!rows && deps.diskSessions) {
      const runnerIds = new Set([...launches.values()].map((l) => l.runnerSessionId).filter(Boolean))
      try {
        onDisk = (await deps.diskSessions())
          .filter((d) => !runnerIds.has(d.sessionId) && (!folderFilter || d.cwd.startsWith(folderFilter)))
          .slice(0, 80)
          .map((d) => ({ session_id: d.sessionId, pid: d.pid, folder: d.cwd, name: d.name, status: d.status, kind: d.kind, entrypoint: d.entrypoint, started_at: d.startedAt, updated_at: d.updatedAt }))
      } catch { onDisk = undefined /* both unread: the answer says Switchboard's reason */ }
    }
    return {
      ok: true,
      fabric_consoles: consoles.map((s) => consoleRow(s, names, launches)),
      machine_sessions: rows ?? { unread: (machine as { unread: string }).unread },
      ...(onDisk ? { machine_sessions_on_disk: onDisk } : {}),
      note: 'Fabric consoles can be read, typed into, stopped and opened here; a machine session is read from its transcript, continued or ended through Switchboard. When Switchboard is unread, machine_sessions_on_disk lists the Claude Code processes running here, read from Claude Code\'s own files.'
    }
  }

  async function read(a: z.infer<typeof CEO_TOOLS.read.input>): Promise<Answer> {
    const s = deps.ptys.get(a.session_id)
    if (s) {
      const names = await projectNames()
      return { ok: true, ...consoleRow(s, names), screen: screen(s.sessionId, a.lines ?? 60) }
    }
    const file = findTranscript(deps.transcriptRoots ?? defaultTranscriptRoots(), a.session_id)
    if (!file) return refuse(`no Fabric console and no Claude Code transcript has the id ${a.session_id}`)
    let text: string
    try {
      const size = statSync(file).size
      text = readFileSync(file, 'utf8')
      if (size > 4_000_000) text = text.slice(-2_000_000)
    } catch (e) { /* said to the caller as the tool's refusal, never as success; the act's record says it failed */
      return refuse(`the transcript could not be read: ${e instanceof Error ? e.message : String(e)}`)
    }
    return { ok: true, kind: 'transcript', session_id: a.session_id, folder: path.basename(path.dirname(file)), turns: transcriptTurns(text).map((t) => ({ ...t, text: redact(t.text).text })) }
  }

  async function input(a: z.infer<typeof CEO_TOOLS.input.input>): Promise<Answer> {
    if (a.session_id === deps.ceoSessionId()) return refuse('this is your own console: answer in your reply instead')
    const s = deps.ptys.get(a.session_id)
    if (!s) return refuse('not a Fabric console: only consoles Fabric runs can be typed into; write to a Switchboard session through its own tools')
    if (!s.running) return refuse('the console has ended: continue it with fabric_ceo_session_resume')
    const keys: string[] = []
    for (const k of a.keys ?? []) {
      const b = keyBytes(k)
      if (b === null) return refuse(`unknown key «${k}»`)
      keys.push(b)
    }
    const text = typedText(a.text ?? '')
    if (!text && keys.length === 0) return refuse('give text, keys or both')
    const submit = a.submit ?? (keys.length === 0)
    try {
      if (text) deps.ptys.write(s.sessionId, text)
      if (text && (submit || keys.length)) await sleep(150)
      if (submit && text) deps.ptys.write(s.sessionId, '\r')
      for (const k of keys) { deps.ptys.write(s.sessionId, k); await sleep(80) }
    } catch (e) { /* said to the caller as the tool's refusal, never as success; the act's record says it failed */
      deps.record('ceo.session.input', { session_id: s.sessionId, outcome: 'failed', reason: a.reason })
      return refuse(`the console did not take the input: ${e instanceof Error ? e.message : String(e)}`)
    }
    deps.record('ceo.session.input', { session_id: s.sessionId, chars: text.length, keys: (a.keys ?? []).join(','), submit, reason: a.reason })
    await sleep(1200)
    return { ok: true, sent: { text_chars: text.length, keys: a.keys ?? [], submit }, screen_after: screen(s.sessionId, 30) }
  }

  async function start(a: z.infer<typeof CEO_TOOLS.start.input>, via?: LaunchVia): Promise<Answer> {
    const projects = await deps.projects()
    let found = findProject(projects, a.project)
    if ('missing' in found && path.isAbsolute(a.project) && existsSync(a.project)) {
      try { found = { found: await deps.admitFolder(a.project) } } catch (e) { /* said to the caller as the tool's refusal, never as success; the act's record says it failed */
        return refuse(`the folder could not become a project: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    if ('ambiguous' in found) return refuse(`«${a.project}» names several projects: ${found.ambiguous.join(', ')}; name one`)
    if ('missing' in found) return refuse(`no project «${a.project}»: name it by fabric_ceo_projects, or give its absolute folder`)
    const project = projects.find((p) => p.id === found.found.id) ?? found.found
    const runner = a.runner ?? ((project as { default_agent?: string | null }).default_agent || 'claude-code')
    try {
      const s = await withLaunchOrigin({ by: 'ceo', via: via ?? 'console', reason: a.reason, parentSessionId: deps.ceoSessionId() ?? undefined },
        () => deps.openConsole(project.id, runner, a.task))
      deps.record('ceo.session.start', { session_id: s.sessionId, project_id: project.id, runner: s.optionId, reason: a.reason })
      deps.note('session.start', { sessionId: s.sessionId, projectId: project.id, label: project.name, runner: s.optionId, reason: a.reason })
      return { ok: true, session_id: s.sessionId, project: project.name, folder: s.cwd, runner: s.optionId, state: s.state }
    } catch (e) { /* said to the caller as the tool's refusal, never as success; the act's record says it failed */
      deps.record('ceo.session.start', { project_id: project.id, outcome: 'failed', reason: a.reason })
      return refuse(`the session did not start: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  async function stop(a: z.infer<typeof CEO_TOOLS.stop.input>): Promise<Answer> {
    if (a.session_id === deps.ceoSessionId()) return refuse('this is your own console: the owner stops or restarts the CEO from its popup')
    const s = deps.ptys.get(a.session_id)
    if (s) {
      if (!s.running) return { ok: true, state: 'already-ended' }
      try {
        const r = await deps.stop(s.sessionId, a.force === true)
        deps.record('ceo.session.stop', { session_id: s.sessionId, force: a.force === true, state: r.state, reason: a.reason })
        const names = await projectNames()
        deps.note('session.stop', { sessionId: s.sessionId, projectId: s.projectId, label: names.get(s.projectId) ?? path.basename(s.cwd), runner: s.optionId, reason: a.reason })
        return { ok: true, state: r.state }
      } catch (e) { /* said to the caller as the tool's refusal, never as success; the act's record says it failed */
        return refuse(`the console did not stop: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    const machine = await machineRows()
    if (!('rows' in machine)) return refuse(`no Fabric console has this id, and Switchboard's sessions were not read: ${machine.unread}`)
    const row = machine.rows.find((r) => r.session_id === a.session_id || r.launch_id === a.session_id)
    if (!row) return refuse(`no session ${a.session_id} on this computer`)
    if (row.group === 'ended') return { ok: true, state: 'already-ended' }
    if (row.launch_id && row.acts.includes('end')) {
      const r = await deps.switchboard(['sessions', 'end', row.launch_id]).catch((e: unknown) => ({ code: 1, stdout: '', stderr: e instanceof Error ? e.message : String(e) }))
      deps.record('ceo.session.stop', { session_id: a.session_id, via: 'switchboard', code: r?.code ?? null, reason: a.reason })
      if (r && r.code === 0) {
        deps.note('session.stop', { sessionId: a.session_id, projectId: null, label: path.basename(row.folder) || 'Switchboard', runner: row.agent, reason: a.reason, machine: true })
        return { ok: true, state: 'ended', via: 'switchboard' }
      }
      if (!a.force) return refuse(`Switchboard did not end it: ${r?.stderr.slice(0, 200) ?? 'not installed'}`)
    }
    if (!a.force) return refuse('this session runs outside Fabric and no session host holds it: stop it with force true (SIGTERM to its process)')
    if (!row.pid) return refuse('Switchboard names no process for this session')
    try {
      deps.signal(row.pid)
      deps.record('ceo.session.stop', { session_id: a.session_id, via: 'sigterm', pid: row.pid, reason: a.reason })
      deps.note('session.stop', { sessionId: a.session_id, projectId: null, label: path.basename(row.folder) || 'Switchboard', runner: row.agent, reason: a.reason, machine: true })
      return { ok: true, state: 'signalled', pid: row.pid }
    } catch (e) { /* said to the caller as the tool's refusal, never as success; the act's record says it failed */
      return refuse(`the process did not take the signal: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  async function resume(a: z.infer<typeof CEO_TOOLS.resume.input>): Promise<Answer> {
    const s = deps.ptys.get(a.session_id)
    if (s) {
      if (s.running) return refuse('the console is still running: type into it with fabric_ceo_session_input')
      const task = a.task ?? 'Продолжи работу этой сессии с того места, где она остановилась: прочитай состояние проекта и свои незакрытые задачи.'
      try {
        const next = await deps.openConsole(s.projectId, s.optionId, task)
        deps.record('ceo.session.resume', { from_session: s.sessionId, session_id: next.sessionId, reason: a.reason })
        const names = await projectNames()
        deps.note('session.start', { sessionId: next.sessionId, projectId: s.projectId, label: names.get(s.projectId) ?? path.basename(s.cwd), runner: next.optionId, reason: a.reason })
        return { ok: true, session_id: next.sessionId, runner: next.optionId, folder: next.cwd }
      } catch (e) { /* said to the caller as the tool's refusal, never as success; the act's record says it failed */
        return refuse(`the session did not start again: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    if (!/^[0-9a-f-]{36}$/.test(a.session_id)) return refuse('not a session id Switchboard can continue')
    const r = await deps.switchboard(['sessions', 'continue', a.session_id]).catch((e: unknown) => ({ code: 1, stdout: '', stderr: e instanceof Error ? e.message : String(e) }))
    deps.record('ceo.session.resume', { session_id: a.session_id, via: 'switchboard', code: r?.code ?? null, reason: a.reason })
    if (!r) return refuse('Switchboard is not installed on this computer')
    if (r.code === 0) deps.note('session.start', { sessionId: a.session_id, projectId: null, label: 'Switchboard', runner: 'switchboard', reason: a.reason, machine: true })
    return r.code === 0 ? { ok: true, via: 'switchboard', said: r.stdout.slice(0, 400) } : refuse(`Switchboard did not continue it: ${(r.stderr || r.stdout).slice(0, 300)}`)
  }

  async function open(a: z.infer<typeof CEO_TOOLS.open.input>): Promise<Answer> {
    const s = deps.ptys.get(a.session_id)
    if (!s) return refuse('only a Fabric console opens in a Fabric window')
    deps.openWindow(s.sessionId)
    deps.record('ceo.session.open', { session_id: s.sessionId, reason: a.reason })
    return { ok: true, opened: s.sessionId }
  }

  async function projects(a: z.infer<typeof CEO_TOOLS.projects.input>): Promise<Answer> {
    const all = await deps.projects()
    const live = deps.ptys.list().filter((s) => s.running)
    const words = (a.query ?? '').toLowerCase().split(/\s+/).filter(Boolean)
    return {
      ok: true,
      projects: all
        .filter((p) => words.every((w) => `${p.name} ${p.repo_path ?? ''}`.toLowerCase().includes(w)))
        .slice(0, 200)
        .map((p) => ({ id: p.id, name: p.name, folder: p.repo_path, default_runner: p.default_agent ?? null, consoles_running: live.filter((s) => s.projectId === p.id).length }))
    }
  }

  async function launches(a: z.infer<typeof CEO_TOOLS.launches.input>): Promise<Answer> {
    if (!deps.launches) return refuse('this Fabric keeps no launch journal')
    let projectId: string | undefined
    if (a.project) {
      const found = findProject(await deps.projects(), a.project)
      if ('ambiguous' in found) return refuse(`«${a.project}» names several projects: ${found.ambiguous.join(', ')}`)
      if ('missing' in found) return refuse(`no project «${a.project}»`)
      projectId = found.found.id
    }
    const [names, all] = await Promise.all([projectNames(), deps.launches({})])
    const byId = new Map(all.map((l) => [l.sessionId, l]))
    let rows = all
    if (a.session_id) rows = rows.filter((l) => l.sessionId === a.session_id || l.runnerSessionId === a.session_id)
    if (projectId) rows = rows.filter((l) => l.projectId === projectId)
    if (a.open_only) rows = rows.filter((l) => l.end === null)
    const live = new Set(deps.ptys.list().filter((s) => s.running).map((s) => s.sessionId))
    return {
      ok: true,
      launches: rows.slice(0, a.limit ?? 30).map((l) => ({
        session_id: l.sessionId, project: names.get(l.projectId) ?? null, project_id: l.projectId, folder: l.cwd, branch: l.branch,
        runner: l.optionId, launched_by: l.by, via: l.via, reason: l.reason, parent_session_id: l.parentSessionId, task_id: l.taskId,
        request_id: l.requestId, machine: l.machine, started_at: l.startedAt, runner_session_id: l.runnerSessionId,
        resume: l.runnerSessionId && l.runner === 'claude-code' ? `claude --resume ${l.runnerSessionId}` : null,
        running_now: live.has(l.sessionId), ended_at: l.endedAt, end: l.end, exit_code: l.exitCode, stop_asked_by: l.stopAskedBy,
        chain: chainOf(l, byId).map((p) => ({ session_id: p.sessionId, launched_by: p.by, project: names.get(p.projectId) ?? null }))
      })),
      total: rows.length,
      note: 'end null with running_now false: the console was cut by a restart of Fabric or the computer (no end was written).'
    }
  }

  const table: { [K in CeoToolName]: (a: z.infer<(typeof CEO_TOOLS)[K]['input']>, via?: LaunchVia) => Promise<Answer> } = {
    sessions, read, input, start, stop, resume, open, launches, projects
  }

  /** Run one tool by its short name with unchecked arguments: checked here, refused with the first problem. `via`:
   *  the door it came through (the CEO's console over MCP, or the voice call), written with a launch it makes. */
  async function run(name: string, args: unknown, via?: LaunchVia): Promise<Answer> {
    if (!(name in CEO_TOOLS)) return refuse(`unknown tool ${name}`)
    const tool = CEO_TOOLS[name as CeoToolName]
    const parsed = tool.input.safeParse(args ?? {})
    if (!parsed.success) return refuse(`the arguments were refused: ${parsed.error.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; ').slice(0, 400)}`)
    try {
      const answer = await (table[name as CeoToolName] as (a: unknown, via?: LaunchVia) => Promise<Answer>)(parsed.data, via)
      // Every call, its name and whether it was refused: what the CEO looked at is as visible as what it did.
      deps.record(`ceo.tool.${name}`, { outcome: answer.ok === false ? 'refused' : 'ok' })
      return answer
    } catch (e) {
      // A door that threw refused the act: said, never an answer that looks like success.
      deps.record(`ceo.tool.${name}`, { outcome: 'failed', error: e instanceof Error ? e.message.slice(0, 200) : String(e) })
      return refuse(e instanceof Error ? e.message.slice(0, 300) : String(e))
    }
  }

  return { run }
}

export type CeoOperations = ReturnType<typeof createCeoOperations>

function json(value: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] }
}

/** The MCP door: every tool on the CEO session's server, nowhere else (`agentSurface.ts#serverFor`). */
export function registerCeoTools(server: McpServer, ops: CeoOperations): void {
  for (const [name, tool] of Object.entries(CEO_TOOLS)) {
    server.registerTool(
      tool.mcp,
      { title: tool.title, description: tool.description, inputSchema: tool.input.shape },
      async (args: unknown) => json(await ops.run(name, args, 'console'))
    )
  }
}

/** The voice door: the same tools as function definitions for the realtime session (`session.update`). */
export function ceoVoiceTools(): Array<{ type: 'function'; name: string; description: string; parameters: unknown }> {
  return Object.entries(CEO_TOOLS).map(([name, tool]) => ({
    type: 'function' as const,
    name: `session_${name}`,
    description: tool.description,
    parameters: z.toJSONSchema(tool.input)
  }))
}
// #endregion ceo-tools
