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
import { areaRect, autoAreas, displayOf, layoutName, nearestArea, pickDisplay, WINDOW_AREAS, type DisplayLike, type Rect, type SavedLayouts, type SavedPlacement, type WindowArea } from '../shared/windowLayout.ts'

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
  projects: {
    mcp: 'fabric_ceo_projects',
    title: 'Fabric\'s projects',
    description: 'The projects Fabric knows, with their folders, default runner and how many of their consoles run. Use it to find where to start or look; Observatory knows every project of the computer.',
    input: z.object({ query: z.string().trim().max(200).optional().describe('Only projects whose name or folder holds these words.') }).strict()
  },
  // #region ceo-windows — docs: docs/adr/0197-the-ceo-is-a-console-session-fabric-keeps-with-a-fallback-runner.md#the-session-control-tools
  windows: {
    mcp: 'fabric_ceo_windows',
    title: 'The open windows and screens',
    description: 'The windows open now: Fabric\'s main window, the CEO window, each console window (with its session and project) and each editor, with where it stands and on which screen; the screens of this computer counted left to right from 1; and the layouts saved by name. Use it before you close or arrange windows.',
    input: z.object({}).strict()
  },
  window_close: {
    mcp: 'fabric_ceo_window_close',
    title: 'Close console windows, sessions keep running',
    description: 'Close console windows. The sessions keep running in the background and keep their screen: fabric_ceo_session_open opens the same session again with its history. Name one session, every console window of a project, or all. To end a session use fabric_ceo_session_stop instead.',
    input: z.object({
      session_id: sessionId.optional(),
      project: z.string().trim().max(400).optional().describe('Close every console window of this project (name, id or folder).'),
      all: z.boolean().optional().describe('Close every console window.'),
      reason
    }).strict()
  },
  window_layout: {
    mcp: 'fabric_ceo_window_layout',
    title: 'Arrange windows on the screens',
    description: 'Put windows where the owner says: «console X on the left, dashboard Y on the right», halves, thirds, quarters, the whole screen or macOS full screen, on screen 1, 2 or the other one. A window is main (Fabric), ceo (the CEO window), dashboards (Fabric Dashboards) or a console by its session id or its project; a console window not open yet is opened. Windows with no area share the screen without covering one another. save_as keeps the arrangement under a name (with no place, the windows as they stand now); restore puts a saved one back.',
    input: z.object({
      place: z.array(z.object({
        window: z.string().trim().min(1).max(400).describe('main, ceo, dashboards, a session id, or a project (its running console).'),
        area: z.enum(WINDOW_AREAS).optional().describe('Where on the screen; with none, the windows named without an area share the screen.'),
        display: z.union([z.number().int().min(1).max(8), z.enum(['primary', 'other', 'current'])]).optional().describe('Which screen: 1, 2… left to right, primary, other; the window\'s own by default.')
      }).strict()).max(8).optional(),
      display: z.union([z.number().int().min(1).max(8), z.enum(['primary', 'other', 'current'])]).optional().describe('The screen for every window that names none.'),
      save_as: z.string().trim().min(1).max(40).optional().describe('Keep this arrangement under a name («рабочая», «звонок»).'),
      restore: z.string().trim().min(1).max(40).optional().describe('Put back the arrangement saved under this name.'),
      reason
    }).strict()
  },
  dashboards: {
    mcp: 'fabric_ceo_dashboards',
    title: 'The dashboards of this computer',
    description: 'The agents and services whose dashboards Fabric Dashboards shows (the same registry it lists): key, name and what each does, local or online. Use it to find the one the owner means («Аня», «Growth») before fabric_ceo_dashboard_open.',
    input: z.object({ query: z.string().trim().max(200).optional().describe('Only dashboards whose name, key or description holds these words.') }).strict()
  },
  dashboard_open: {
    mcp: 'fabric_ceo_dashboard_open',
    title: 'Open a dashboard in Fabric Dashboards',
    description: 'Open a dashboard in Fabric Dashboards (never in a browser): by its key or by words of its name («открой Аню», «покажи Growth»). Opening another one switches to it. area puts the Fabric Dashboards window on the screen (fullscreen for macOS full screen, full for the whole screen, left or right beside a console).',
    input: z.object({
      dashboard: z.string().trim().min(1).max(200).describe('The service key (id.instance) or words of its name.'),
      path: z.string().trim().max(400).regex(/^\//).optional().describe('A page of the dashboard, starting with /.'),
      area: z.enum(WINDOW_AREAS).optional(),
      display: z.union([z.number().int().min(1).max(8), z.enum(['primary', 'other', 'current'])]).optional(),
      reason
    }).strict()
  }
  // #endregion ceo-windows
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
  /** Fabric's own windows (`index.ts`); absent where there is no window system (the tests that do not need it). */
  windows?: CeoWindowsPort
  /** Fabric Dashboards: the registry it lists, its links, and its window (another app's, moved through macOS). */
  dashboards?: CeoDashboardsPort
  /** The layouts saved by name, in Fabric's data folder. */
  layouts?: { read(): SavedLayouts; write(all: SavedLayouts): void }
  now?: () => Date
}

/** One of Fabric's windows as the CEO reads it. `subject`: a console's session id, an editor's file. */
export interface CeoWindow { kind: 'main' | 'ceo' | 'session' | 'editor'; subject: string | null; title: string; bounds: Rect; fullScreen: boolean; minimized: boolean; focused: boolean }
export type CeoPlacement = { bounds: Rect } | { fullScreen: true }

export interface CeoWindowsPort {
  list(): CeoWindow[]
  displays(): Array<DisplayLike & { label: string }>
  /** Close a console's window; the session runs on. False when no window shows it. */
  closeSession(sessionId: string): boolean
  /** Open (or bring forward) main, ceo, or a console's window. */
  open(kind: 'main' | 'ceo' | 'session', subject?: string): void
  /** Move a window; false when it is not open. */
  place(kind: 'main' | 'ceo' | 'session', subject: string | null, to: CeoPlacement): boolean
}

export interface CeoDashboard { key: string; name: string; summary: string | null; placement: 'local' | 'remote' }
export interface CeoDashboardsPort {
  list(): CeoDashboard[]
  /** Hand a fabric-dashboards:// link to the installed app (`shell.openExternal`); throws when macOS could not. */
  open(link: string): Promise<void>
  /** Where Fabric Dashboards' front window stands; null when it has none or macOS would not say. */
  bounds(): Promise<Rect | null>
  place(to: CeoPlacement): Promise<{ ok: true } | { ok: false; reason: string }>
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

function findTranscript(roots: readonly string[], id: string): string | null {
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
  const consoleRow = (s: TerminalSession, names: Map<string, string>): Answer => ({
    session_id: s.sessionId, kind: 'fabric-console', project: names.get(s.projectId) ?? null, project_id: s.projectId,
    folder: s.cwd, runner: s.optionId, state: s.state, running: s.running, started_at: s.startedAt,
    last_activity_at: s.lastActivityAt, last_line: redact(s.tail).text.slice(0, 200), is_ceo: s.sessionId === deps.ceoSessionId()
  })

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
    const machine = await machineRows()
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
    return {
      ok: true,
      fabric_consoles: consoles.map((s) => consoleRow(s, names)),
      machine_sessions: rows ?? { unread: (machine as { unread: string }).unread },
      note: 'Fabric consoles can be read, typed into, stopped and opened here; a machine session is read from its transcript, continued or ended through Switchboard.'
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

  async function start(a: z.infer<typeof CEO_TOOLS.start.input>): Promise<Answer> {
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
      const s = await deps.openConsole(project.id, runner, a.task)
      deps.record('ceo.session.start', { session_id: s.sessionId, project_id: project.id, runner: s.optionId, reason: a.reason })
      deps.note('session.start', { sessionId: s.sessionId, projectId: project.id, label: project.name, runner: s.optionId, reason: a.reason })
      return { ok: true, session_id: s.sessionId, project: project.name, folder: s.cwd, runner: s.optionId, state: s.state }
    } catch (e) { /* said to the caller as the tool's refusal, never as success; the act's record says it failed */
      deps.record('ceo.session.start', { project_id: project.id, outcome: 'failed', reason: a.reason })
      return refuse(`the session did not start: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  async function stop(a: z.infer<typeof CEO_TOOLS.stop.input>): Promise<Answer> {
    if (a.session_id === deps.ceoSessionId()) return refuse('this is your own console: the owner restarts the CEO from the popup')
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

  // #region ceo-windows-ops — docs: docs/adr/0197-the-ceo-is-a-console-session-fabric-keeps-with-a-fallback-runner.md#the-session-control-tools
  const noWindows = (): Answer => refuse('this Fabric has no window system to act on')
  const now = deps.now ?? (() => new Date())

  async function windows(): Promise<Answer> {
    const w = deps.windows
    if (!w) return noWindows()
    const names = await projectNames()
    const displays = w.displays()
    const ordered = [...displays].sort((a, b) => a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y)
    const screenOf = (r: Rect): number | null => { const d = displayOf(displays, r); return d ? ordered.indexOf(d) + 1 : null }
    const rows = w.list().map((x) => {
      const s = x.kind === 'session' && x.subject ? deps.ptys.get(x.subject) : null
      return {
        kind: x.kind, session_id: x.kind === 'session' ? x.subject : undefined, file: x.kind === 'editor' ? x.subject : undefined,
        project: s ? names.get(s.projectId) ?? null : undefined, session_state: s ? s.state : undefined,
        title: x.title, screen: screenOf(x.bounds), bounds: x.bounds, full_screen: x.fullScreen, minimized: x.minimized, focused: x.focused
      }
    })
    let dashboards: Answer | null = null
    if (deps.dashboards) {
      const b = await deps.dashboards.bounds().catch(() => null)
      dashboards = b ? { open: true, screen: screenOf(b), bounds: b } : { open: false }
    }
    return {
      ok: true,
      windows: rows,
      dashboards_window: dashboards,
      screens: ordered.map((d, i) => ({ screen: i + 1, primary: d.primary, label: d.label, work_area: d.workArea })),
      layouts: Object.keys(deps.layouts?.read() ?? {}),
      note: 'Closing a console window never stops its session; fabric_ceo_session_open opens it again with its history.'
    }
  }

  async function windowClose(a: z.infer<typeof CEO_TOOLS.window_close.input>): Promise<Answer> {
    const w = deps.windows
    if (!w) return noWindows()
    const named = [a.session_id ? 1 : 0, a.project ? 1 : 0, a.all ? 1 : 0].reduce((x, y) => x + y, 0)
    if (named !== 1) return refuse('name exactly one: session_id, project or all')
    const open = w.list().filter((x) => x.kind === 'session' && x.subject).map((x) => x.subject as string)
    let targets: string[]
    if (a.session_id) {
      if (!open.includes(a.session_id)) return { ok: true, closed: [], note: 'no window shows this session; nothing to close' }
      targets = [a.session_id]
    } else if (a.project) {
      const found = findProject(await deps.projects(), a.project)
      if ('ambiguous' in found) return refuse(`«${a.project}» names several projects: ${found.ambiguous.join(', ')}`)
      if ('missing' in found) return refuse(`no project «${a.project}»`)
      targets = open.filter((id) => deps.ptys.get(id)?.projectId === found.found.id)
    } else targets = open
    const closed = targets.filter((id) => w.closeSession(id))
    deps.record('ceo.window.close', { sessions: closed.length, scope: a.session_id ? 'session' : a.project ? 'project' : 'all', reason: a.reason })
    return {
      ok: true,
      closed: closed.map((id) => ({ session_id: id, still_running: deps.ptys.get(id)?.running ?? false })),
      note: 'The sessions keep running; open one again with fabric_ceo_session_open.'
    }
  }

  type Target = { kind: 'main' | 'ceo' | 'session'; subject: string | null; project_id?: string | null } | { kind: 'dashboards' }
  /** A window the owner names: a word for Fabric's own, a console by id, or a project's running console (the newest). */
  async function resolveWindow(word: string): Promise<Target | { refused: string }> {
    const lower = word.toLowerCase()
    if (['main', 'fabric', 'фабрик', 'главное'].includes(lower)) return { kind: 'main', subject: null }
    if (['ceo', 'сео', 'сиео'].includes(lower)) return { kind: 'ceo', subject: null }
    if (['dashboards', 'dashboard', 'дашборд', 'дашборды'].includes(lower)) return { kind: 'dashboards' }
    const s = deps.ptys.get(word)
    if (s) {
      if (s.sessionId === deps.ceoSessionId()) return { kind: 'ceo', subject: null }
      return { kind: 'session', subject: s.sessionId, project_id: s.projectId }
    }
    const found = findProject(await deps.projects(), word)
    if ('ambiguous' in found) return { refused: `«${word}» names several projects: ${found.ambiguous.join(', ')}` }
    if ('missing' in found) return { refused: `«${word}» is no window, session or project: main, ceo, dashboards, a session id or a project` }
    const live = deps.ptys.list().filter((x) => x.running && x.projectId === found.found.id && x.sessionId !== deps.ceoSessionId())
      .sort((x, y) => String(y.lastActivityAt ?? '').localeCompare(String(x.lastActivityAt ?? '')))
    if (!live.length) return { refused: `project «${found.found.name}» runs no console: start one with fabric_ceo_session_start` }
    return { kind: 'session', subject: live[0].sessionId, project_id: found.found.id }
  }

  type Want = { target: Target; area?: WindowArea; display?: string | number }
  /** Put each window where it was asked; the windows with no area share their screen. Answers each one's outcome. */
  async function arrange(wants: Want[], fallbackDisplay: string | number | undefined): Promise<Answer[]> {
    const w = deps.windows!
    const displays = w.displays()
    const listNow = w.list()
    const boundsOf = (t: Target): Rect | null => t.kind === 'dashboards' ? null
      : listNow.find((x) => x.kind === t.kind && (t.kind !== 'session' || x.subject === t.subject))?.bounds ?? null
    const mainBounds = listNow.find((x) => x.kind === 'main')?.bounds ?? null
    const dashBounds = wants.some((x) => x.target.kind === 'dashboards') ? await deps.dashboards?.bounds().catch(() => null) ?? null : null
    // Each window's screen first, then the shared areas per screen.
    const withDisplay = wants.map((x) => {
      const own = x.target.kind === 'dashboards' ? dashBounds : boundsOf(x.target)
      const current = displayOf(displays, own ?? mainBounds ?? { x: 0, y: 0, width: 1, height: 1 })
      return { ...x, screen: pickDisplay(displays, x.display ?? fallbackDisplay, current) }
    })
    const shared = new Map<number, number[]>()
    withDisplay.forEach((x, i) => { if (!x.area && x.screen) shared.set(x.screen.id, [...(shared.get(x.screen.id) ?? []), i]) })
    for (const idx of shared.values()) { const areas = autoAreas(idx.length); idx.forEach((i, k) => { withDisplay[i].area = areas[k] }) }
    const out: Answer[] = []
    for (const x of withDisplay) {
      const label = x.target.kind === 'session' ? x.target.subject : x.target.kind
      if (!x.screen) { out.push({ window: label, ok: false, reason: 'no such screen on this computer' }); continue }
      const area = x.area ?? 'full'
      const to: CeoPlacement = area === 'fullscreen' ? { fullScreen: true } : { bounds: areaRect(x.screen.workArea, area) }
      if (x.target.kind === 'dashboards') {
        if (!deps.dashboards) { out.push({ window: label, ok: false, reason: 'Fabric Dashboards is not reachable from here' }); continue }
        const r = await deps.dashboards.place(to)
        out.push(r.ok ? { window: label, ok: true, area } : { window: label, ok: false, reason: r.reason })
        continue
      }
      const t = x.target
      if (!listNow.some((y) => y.kind === t.kind && (t.kind !== 'session' || y.subject === t.subject))) w.open(t.kind, t.subject ?? undefined)
      const placed = w.place(t.kind, t.kind === 'session' ? t.subject : null, to)
      out.push(placed ? { window: label, ok: true, area } : { window: label, ok: false, reason: 'the window did not open' })
    }
    return out
  }

  async function windowLayout(a: z.infer<typeof CEO_TOOLS.window_layout.input>): Promise<Answer> {
    const w = deps.windows
    if (!w) return noWindows()
    if (a.restore && (a.place?.length || a.save_as)) return refuse('restore stands alone: give place and save_as without it')
    if (!a.restore && !a.place?.length && !a.save_as) return refuse('give place, save_as or restore')
    const saved = deps.layouts?.read() ?? {}
    let wants: Want[] = []
    const skipped: Answer[] = []
    if (a.restore) {
      const name = layoutName(a.restore)
      const layout = name ? saved[name] : undefined
      if (!layout) return refuse(`no layout «${a.restore}»; saved: ${Object.keys(saved).join(', ') || 'none'}`)
      for (const p of layout.placements) {
        if (p.window !== 'session') { wants.push({ target: p.window === 'dashboards' ? { kind: 'dashboards' } : { kind: p.window, subject: null }, area: p.area, display: p.display }); continue }
        const same = p.session_id ? deps.ptys.get(p.session_id) : null
        const live = same?.running ? same : deps.ptys.list().find((s) => s.running && p.project_id && s.projectId === p.project_id && s.sessionId !== deps.ceoSessionId())
        if (live) wants.push({ target: { kind: 'session', subject: live.sessionId, project_id: live.projectId }, area: p.area, display: p.display })
        else skipped.push({ window: p.session_id ?? p.project_id ?? 'session', reason: 'its session ended and its project runs no console' })
      }
    } else if (a.place?.length) {
      for (const p of a.place) {
        const t = await resolveWindow(p.window)
        if ('refused' in t) return refuse(t.refused)
        wants.push({ target: t, area: p.area, display: p.display })
      }
    }
    const placed = wants.length ? await arrange(wants, a.display) : []
    let savedAs: string | null = null
    if (a.save_as) {
      const name = layoutName(a.save_as)
      if (!name) return refuse('a layout name is up to 40 letters, digits, spaces, _ or -')
      if (!deps.layouts) return refuse('layouts cannot be kept on this computer')
      let placements: SavedPlacement[]
      if (a.place?.length) {
        placements = wants.map((x, i) => {
          const area = (placed[i]?.area as WindowArea | undefined) ?? x.area ?? 'full'
          const display = typeof x.display === 'number' || x.display === 'primary' || x.display === 'other' ? x.display : undefined
          return x.target.kind === 'session'
            ? { window: 'session' as const, session_id: x.target.subject ?? undefined, project_id: x.target.project_id ?? null, area, display }
            : { window: x.target.kind, area, display }
        })
      } else {
        // The windows as they stand: each one's nearest area on its own screen.
        const displays = w.displays()
        const ordered = [...displays].sort((p, q) => p.bounds.x - q.bounds.x || p.bounds.y - q.bounds.y)
        placements = w.list().filter((x) => x.kind !== 'editor' && !x.minimized).flatMap((x): SavedPlacement[] => {
          const d = displayOf(displays, x.bounds)
          if (!d) return []
          const area: WindowArea = x.fullScreen ? 'fullscreen' : nearestArea(d.workArea, x.bounds)
          const display = ordered.indexOf(d) + 1
          if (x.kind === 'session') {
            const s = x.subject ? deps.ptys.get(x.subject) : null
            return [{ window: 'session', session_id: x.subject ?? undefined, project_id: s?.projectId ?? null, area, display }]
          }
          return [{ window: x.kind as 'main' | 'ceo', area, display }]
        })
        if (!placements.length) return refuse('no window is open to keep')
      }
      try {
        deps.layouts.write({ ...saved, [name]: { saved_at: now().toISOString(), placements: placements.slice(0, 12) } })
        savedAs = name
      } catch (e) { /* said to the caller as the tool's refusal, never as success; the act's record says it failed */
        deps.record('ceo.window.layout', { outcome: 'failed', saved: name, reason: a.reason })
        return refuse(`the layout could not be kept: ${e instanceof Error ? e.message : String(e)}`, { placed })
      }
    }
    deps.record('ceo.window.layout', { windows: placed.length, failed: placed.filter((p) => p.ok === false).length, restored: a.restore ?? null, saved: savedAs, reason: a.reason })
    return { ok: placed.every((p) => p.ok !== false), placed, skipped, saved_as: savedAs }
  }

  /** The dashboards the owner's words name, best first: every word of the request, as the start of a word of the
   *  dashboard's key, name or summary, with Russian endings forgiven («Аню» finds «Аня»). */
  function matchDashboards(all: CeoDashboard[], query: string): CeoDashboard[] {
    const exact = all.find((d) => d.key === query.trim())
    if (exact) return [exact]
    const stem = (w: string) => (w.length <= 3 ? w.slice(0, Math.max(2, w.length - 1)) : w.length <= 5 ? w.slice(0, w.length - 1) : w.slice(0, w.length - 2))
    const words = query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((x) => x.length >= 2).map(stem)
    if (!words.length) return all
    const scored = all.map((d) => {
      const tokens = `${d.key} ${d.name}`.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)
      const more = (d.summary ?? '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)
      let score = 0
      for (const w of words) score += tokens.some((t) => t.startsWith(w)) ? 3 : more.some((t) => t.startsWith(w)) ? 1 : 0
      return { d, score }
    }).filter((x) => x.score > 0)
    // A service of its own beats its showcase copy, a local one an online one, at the same score.
    scored.sort((x, y) => y.score - x.score || (x.d.key.startsWith('studio-showcase.') ? 1 : 0) - (y.d.key.startsWith('studio-showcase.') ? 1 : 0) || x.d.name.localeCompare(y.d.name))
    return scored.map((x) => x.d)
  }

  async function dashboards(a: z.infer<typeof CEO_TOOLS.dashboards.input>): Promise<Answer> {
    if (!deps.dashboards) return refuse('Fabric Dashboards is not reachable from here')
    const all = deps.dashboards.list()
    const found = a.query ? matchDashboards(all, a.query) : all
    return { ok: true, dashboards: found.slice(0, 100).map((d) => ({ key: d.key, name: d.name, what: d.summary, placement: d.placement })), total: all.length }
  }

  async function dashboardOpen(a: z.infer<typeof CEO_TOOLS.dashboard_open.input>): Promise<Answer> {
    if (!deps.dashboards) return refuse('Fabric Dashboards is not reachable from here')
    const found = matchDashboards(deps.dashboards.list(), a.dashboard)
    if (!found.length) return refuse(`no dashboard «${a.dashboard}»: fabric_ceo_dashboards lists them`)
    const top = found[0]
    const link = `fabric-dashboards://service/${encodeURIComponent(top.key)}?path=${encodeURIComponent(a.path ?? '/')}`
    try {
      await deps.dashboards.open(link)
    } catch (e) { /* said to the caller as the tool's refusal, never as success; the act's record says it failed */
      deps.record('ceo.dashboard.open', { key: top.key, outcome: 'failed', reason: a.reason })
      return refuse(`Fabric Dashboards did not take the link: ${e instanceof Error ? e.message : String(e)}`)
    }
    deps.record('ceo.dashboard.open', { key: top.key, area: a.area ?? null, reason: a.reason })
    let placed: Answer | null = null
    if (a.area || a.display) {
      // The app brings its window forward as it opens the page; give it that moment before moving it.
      await sleep(1200)
      placed = deps.windows
        ? (await arrange([{ target: { kind: 'dashboards' }, area: a.area ?? 'full', display: a.display }], undefined))[0] ?? null
        : { ok: false, reason: 'this Fabric reads no screens to place it on' }
    }
    return {
      ok: true, opened: { key: top.key, name: top.name }, link,
      also_matched: found.slice(1, 4).map((d) => ({ key: d.key, name: d.name })),
      ...(placed ? { placed } : {}),
      note: 'Opening another dashboard switches to it in the same window.'
    }
  }
  // #endregion ceo-windows-ops

  const table: { [K in CeoToolName]: (a: z.infer<(typeof CEO_TOOLS)[K]['input']>) => Promise<Answer> } = {
    sessions, read, input, start, stop, resume, open, projects,
    windows, window_close: windowClose, window_layout: windowLayout, dashboards, dashboard_open: dashboardOpen
  }

  /** Run one tool by its short name with unchecked arguments: checked here, refused with the first problem. */
  async function run(name: string, args: unknown): Promise<Answer> {
    if (!(name in CEO_TOOLS)) return refuse(`unknown tool ${name}`)
    const tool = CEO_TOOLS[name as CeoToolName]
    const parsed = tool.input.safeParse(args ?? {})
    if (!parsed.success) return refuse(`the arguments were refused: ${parsed.error.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; ').slice(0, 400)}`)
    try {
      const answer = await (table[name as CeoToolName] as (a: unknown) => Promise<Answer>)(parsed.data)
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
      async (args: unknown) => json(await ops.run(name, args))
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
