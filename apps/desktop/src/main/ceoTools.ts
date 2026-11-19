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
import { listDashboards, pickDashboard } from '../shared/dashboardMatch.ts'
import { areaRect, boundLayouts, displayOf, fitAreas, layoutName, nearestArea, pickDisplay, WINDOW_AREAS, type DisplayLike, type Rect, type SavedLayouts, type SavedPlacement, type WindowArea } from '../shared/windowLayout.ts'

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
  // #region ceo-windows — docs: docs/adr/0197-the-ceo-is-a-console-session-fabric-keeps-with-a-fallback-runner.md#amendment-3-2026-11-19-the-ceo-closes-and-arranges-windows-and-opens-dashboards
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
    description: 'Put windows where the owner says: «console X on the left, dashboard Y on the right», halves, thirds, quarters, the whole screen or macOS full screen, on screen 1, 2 or the other one. A window is a console by its session id or its project (a project is looked up first), main (Fabric\'s window), ceo (the CEO window) or dashboards (Fabric Dashboards; with dashboard it opens that one first); a console window not open yet is opened. Windows named together stay on one screen unless a screen is named. Windows with no area take the room the others leave, beside the windows placed here before: up to four side by side or in a grid; the answer says when they had to overlap. save_as keeps the arrangement under a name (with no place, Fabric\'s windows and Fabric Dashboards\' as they stand now); restore puts a saved one back.',
    input: z.object({
      place: z.array(z.object({
        window: z.string().trim().min(1).max(400).describe('main, ceo, dashboards, a session id, or a project (its running console).'),
        area: z.enum(WINDOW_AREAS).optional().describe('Where on the screen; with none, the windows named without an area share the screen.'),
        dashboard: z.string().trim().min(1).max(200).optional().describe('With window dashboards: open this dashboard (its key or words of its name) and place it.'),
        display: z.enum(['1', '2', '3', '4', '5', '6', '7', '8', 'primary', 'other', 'current']).optional().describe('Which screen: 1, 2… counted left to right, primary, other.')
      }).strict()).max(8).optional(),
      display: z.enum(['1', '2', '3', '4', '5', '6', '7', '8', 'primary', 'other', 'current']).optional().describe('The screen for every window that names none; by default the screen of the first Fabric window named, so windows named together stay on one screen.'),
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
      display: z.enum(['1', '2', '3', '4', '5', '6', '7', '8', 'primary', 'other', 'current']).optional(),
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
/** Where Fabric Dashboards' window stands, when it can be known: `known: false` is «cannot tell», never «closed». */
export type CeoDashboardsWindow = { known: true; rect: Rect | null } | { known: false; why: string }
export interface CeoDashboardsPort {
  list(): CeoDashboard[]
  /** Hand a fabric-dashboards:// link to the installed app (`shell.openExternal`); throws when macOS could not. */
  open(link: string): Promise<void>
  /** Where its front window stands. `ask` false reads only once macOS has let Fabric reach it (no consent raised). */
  window(ask: boolean): Promise<CeoDashboardsWindow>
  /** Wait up to `ms` for its window to exist (a cold start after a link). */
  waitWindow(ms: number): Promise<CeoDashboardsWindow>
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

  // #region ceo-windows-ops — docs: docs/adr/0197-the-ceo-is-a-console-session-fabric-keeps-with-a-fallback-runner.md#amendment-3-2026-11-19-the-ceo-closes-and-arranges-windows-and-opens-dashboards
  const noWindows = (): Answer => refuse('this Fabric has no window system to act on')
  const now = deps.now ?? (() => new Date())
  /** Where the CEO put each window (`main`, `ceo`, `dashboards`, `session:<id>`), and whether the owner named the area:
   *  a window placed with no area is placed again beside the next one (PL-1), one with an area keeps it. */
  const placedHere = new Map<string, { screen: number; area: WindowArea; named: boolean }>()
  /** Saves of layouts run one after another, so two at once both land (ER-9). */
  let saving: Promise<unknown> = Promise.resolve()

  const ordered = (ds: Array<DisplayLike & { label: string }>) => [...ds].sort((a, b) => a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y)
  const screenNumber = (ds: Array<DisplayLike & { label: string }>, r: Rect | null): number | null => {
    if (!r) return null
    const d = displayOf(ds, r)
    return d ? ordered(ds).indexOf(d) + 1 : null
  }

  async function windows(): Promise<Answer> {
    const w = deps.windows
    if (!w) return noWindows()
    const names = await projectNames()
    const displays = w.displays()
    const rows = w.list().map((x) => {
      const s = x.kind === 'session' && x.subject ? deps.ptys.get(x.subject) : null
      // DA-1: an editor by its file's name only, a console by its project; a window's title carries their full paths.
      return {
        kind: x.kind, session_id: x.kind === 'session' ? x.subject : undefined, file: x.kind === 'editor' && x.subject ? path.basename(x.subject) : undefined,
        project: s ? names.get(s.projectId) ?? null : undefined, session_state: s ? s.state : undefined,
        title: x.kind === 'main' || x.kind === 'ceo' ? x.title : undefined, screen: screenNumber(displays, x.bounds), bounds: x.bounds, full_screen: x.fullScreen, minimized: x.minimized, focused: x.focused
      }
    })
    let dashboards: Answer | null = null
    if (deps.dashboards) {
      // A listing never raises macOS's consent (ER-7): it reads Fabric Dashboards' window only once Fabric may.
      const d = await deps.dashboards.window(false).catch((): CeoDashboardsWindow => ({ known: false, why: 'it could not be read' }))
      dashboards = !d.known ? { open: null, why: d.why } : d.rect ? { open: true, screen: screenNumber(displays, d.rect), bounds: d.rect } : { open: false }
    }
    return {
      ok: true,
      windows: rows,
      dashboards_window: dashboards,
      screens: ordered(displays).map((d, i) => ({ screen: i + 1, primary: d.primary, label: d.label, work_area: d.workArea })),
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
    for (const id of closed) placedHere.delete(`session:${id}`)
    deps.record('ceo.window.close', { sessions: closed.length, scope: a.session_id ? 'session' : a.project ? 'project' : 'all', reason: a.reason })
    return {
      ok: true,
      closed: closed.map((id) => ({ session_id: id, still_running: deps.ptys.get(id)?.running ?? false })),
      note: 'The sessions keep running; open one again with fabric_ceo_session_open.'
    }
  }

  type Target = { kind: 'main' | 'ceo' | 'session'; subject: string | null; project_id?: string | null } | { kind: 'dashboards'; open?: CeoDashboard }
  const keyOf = (t: Target) => (t.kind === 'session' ? `session:${t.subject}` : t.kind)
  const MAIN_WORDS = ['main', 'главное', 'главное окно', 'основное окно', 'окно fabric', 'fabric window']
  const CEO_WORDS = ['ceo', 'сео', 'сиео', 'окно ceo', 'окно сео']
  const DASH_WORDS = ['dashboards', 'dashboard', 'fabric dashboards', 'дашборд', 'дашборды', 'дашборда', 'дашборде']

  /** A window the owner names: a console by its id, then a project's most recently active running console (a project
   *  may be called «fabric» or «main»: its console is what the owner means, UX-7), then Fabric's own windows by word. */
  async function resolveWindow(word: string, dashboard?: string): Promise<Target | { refused: string }> {
    const lower = word.toLowerCase().trim()
    if (dashboard) {
      if (!DASH_WORDS.includes(lower)) return { refused: 'dashboard goes with window dashboards' }
      const pick = pickDashboard(deps.dashboards?.list() ?? [], dashboard)
      if ('missing' in pick) return { refused: `no dashboard «${dashboard}»: fabric_ceo_dashboards lists them` }
      if ('ambiguous' in pick) return { refused: `«${dashboard}» fits several dashboards: ${pick.ambiguous.slice(0, 6).map((d) => `${d.name} (${d.key})`).join(', ')}; ask the owner which` }
      return { kind: 'dashboards', open: pick.found as CeoDashboard }
    }
    const s = deps.ptys.get(word)
    if (s) return s.sessionId === deps.ceoSessionId() ? { kind: 'ceo', subject: null } : { kind: 'session', subject: s.sessionId, project_id: s.projectId }
    const found = findProject(await deps.projects(), word)
    if ('found' in found) {
      const live = deps.ptys.list().filter((x) => x.running && x.projectId === found.found.id && x.sessionId !== deps.ceoSessionId())
        .sort((x, y) => String(y.lastActivityAt ?? '').localeCompare(String(x.lastActivityAt ?? '')))
      if (live.length) return { kind: 'session', subject: live[0].sessionId, project_id: found.found.id }
    }
    if (MAIN_WORDS.includes(lower)) return { kind: 'main', subject: null }
    if (CEO_WORDS.includes(lower)) return { kind: 'ceo', subject: null }
    if (DASH_WORDS.includes(lower)) return { kind: 'dashboards' }
    if ('ambiguous' in found) return { refused: `«${word}» names several projects: ${found.ambiguous.join(', ')}` }
    if ('found' in found) return { refused: `project «${found.found.name}» runs no console: start one with fabric_ceo_session_start` }
    return { refused: `«${word}» is no window, session or project: a session id, a project, main, ceo or dashboards` }
  }

  type Want = { target: Target; area?: WindowArea; display?: string }
  type Placed = { window: string; ok: boolean; area?: WindowArea; screen?: number; reason?: string; overlaps?: boolean; moved_to?: number }

  /**
   * Put each window where it was asked, as one arrangement:
   * - windows named together go to one screen (PL-2): the call's `display`, else the screen of the first Fabric window
   *   named, else the main window's; a window's own `display` wins; a screen this computer lacks falls back to the
   *   primary one and says so (ER-12);
   * - windows with an area take it; those without take the room left beside the named areas and beside the windows
   *   placed here before with no area, which are placed again with them (PL-1, `fitAreas`);
   * - Fabric's main window moves before the CEO window, its child, so the child ends where it was asked (ER-1).
   */
  async function arrange(wants: Want[], callDisplay: string | undefined): Promise<Placed[]> {
    const w = deps.windows!
    const displays = w.displays()
    const list = w.list()
    const boundsOf = (t: Target): Rect | null => t.kind === 'dashboards' ? null
      : list.find((x) => x.kind === t.kind && (t.kind !== 'session' || x.subject === t.subject))?.bounds ?? null
    const main = list.find((x) => x.kind === 'main')?.bounds ?? null
    const anchor = wants.map((x) => boundsOf(x.target)).find((b) => b !== null) ?? main
    const callScreen = pickDisplay(displays, callDisplay, anchor ? displayOf(displays, anchor) : null)
    const screenOf = (x: Want): { d: (DisplayLike & { label: string }) | null; movedTo?: number } => {
      if (!x.display) return { d: callScreen }
      const d = pickDisplay(displays, x.display, callScreen)
      if (d) return { d }
      const primary = pickDisplay(displays, 'primary', null)
      return { d: primary, movedTo: primary ? ordered(displays).indexOf(primary) + 1 : undefined }
    }
    const resolved = wants.map((x) => ({ ...x, ...screenOf(x) }))
    // The windows placed here before with no area, still open and not named now, share again (PL-1).
    const namedKeys = new Set(wants.map((x) => keyOf(x.target)))
    const openKeys = new Set(list.map((x) => (x.kind === 'session' ? `session:${x.subject}` : x.kind)))
    const dashOpen = deps.dashboards ? await deps.dashboards.window(false).catch(() => ({ known: false as const, why: '' })) : null
    if (dashOpen && dashOpen.known && dashOpen.rect) openKeys.add('dashboards')
    for (const [key, p] of placedHere) {
      if (namedKeys.has(key) || p.named || !openKeys.has(key)) continue
      const d = ordered(displays)[p.screen - 1]
      if (!d || !resolved.some((r) => r.d?.id === d.id && !r.area)) continue
      const target: Target = key.startsWith('session:') ? { kind: 'session', subject: key.slice(8) } : key === 'dashboards' ? { kind: 'dashboards' } : { kind: key as 'main' | 'ceo', subject: null }
      // The window placed first keeps the first place (left, then top): it goes before the ones named now.
      resolved.unshift({ target, d })
    }
    // Areas per screen: the named ones are fixed, plus those the earlier placements named.
    const overlapsOn = new Set<number>()
    for (const d of new Set(resolved.map((r) => r.d).filter((x): x is NonNullable<typeof x> => !!x))) {
      const here = resolved.filter((r) => r.d?.id === d.id)
      const fixed = here.filter((r) => r.area && r.area !== 'fullscreen').map((r) => r.area as WindowArea)
      for (const [key, p] of placedHere) if (p.named && !namedKeys.has(key) && openKeys.has(key) && ordered(displays)[p.screen - 1]?.id === d.id) fixed.push(p.area)
      const free = here.filter((r) => !r.area)
      const fit = fitAreas(d.workArea, fixed, free.length)
      free.forEach((r, i) => { r.area = fit.areas[i] })
      if (fit.overlaps) overlapsOn.add(d.id)
    }
    // Main before its child, the CEO window (ER-1); the rest in the order named.
    resolved.sort((a, b) => (a.target.kind === 'main' ? 0 : a.target.kind === 'ceo' ? 1 : 2) - (b.target.kind === 'main' ? 0 : b.target.kind === 'ceo' ? 1 : 2))
    const out: Placed[] = []
    for (const x of resolved) {
      const label = x.target.kind === 'session' ? x.target.subject ?? 'session' : x.target.kind
      if (!x.d) { out.push({ window: label, ok: false, reason: 'this computer reports no screen' }); continue }
      const area = x.area ?? 'full'
      const screen = ordered(displays).indexOf(x.d) + 1
      const to: CeoPlacement = area === 'fullscreen' ? { fullScreen: true } : { bounds: areaRect(x.d.workArea, area) }
      const done = (ok: boolean, reason?: string) => {
        out.push({ window: label, ok, area, screen, ...(reason ? { reason } : {}), ...(overlapsOn.has(x.d!.id) ? { overlaps: true } : {}), ...(x.movedTo ? { moved_to: x.movedTo } : {}) })
        // A window named with an area keeps it next time; one placed beside others is placed again with the next ones.
        const asked = wants.find((wa) => keyOf(wa.target) === keyOf(x.target))
        if (ok) placedHere.set(keyOf(x.target), { screen, area, named: asked ? asked.area !== undefined : false })
      }
      if (x.target.kind === 'dashboards') {
        if (!deps.dashboards) { done(false, 'Fabric Dashboards is not reachable from here'); continue }
        if (x.target.open) {
          try { await deps.dashboards.open(dashLink(x.target.open.key, '/')) } catch { done(false, 'Fabric Dashboards did not take the link'); continue }
        }
        // A cold start: the window comes after the link (UX-5, ER-5).
        const there = await deps.dashboards.waitWindow(8000)
        if (there.known && !there.rect) { done(false, 'Fabric Dashboards shows no window yet; ask again in a moment'); continue }
        const r = await deps.dashboards.place(to)
        if (r.ok) done(true); else done(false, r.reason)
        continue
      }
      const t = x.target
      if (!list.some((y) => y.kind === t.kind && (t.kind !== 'session' || y.subject === t.subject))) w.open(t.kind, t.subject ?? undefined)
      done(w.place(t.kind, t.kind === 'session' ? t.subject : null, to), 'the window did not open')
    }
    return out
  }

  const dashLink = (key: string, page: string) => `fabric-dashboards://service/${encodeURIComponent(key)}?path=${encodeURIComponent(page)}`

  async function windowLayout(a: z.infer<typeof CEO_TOOLS.window_layout.input>): Promise<Answer> {
    const w = deps.windows
    if (!w) return noWindows()
    if (a.restore && (a.place?.length || a.save_as)) return refuse('restore stands alone: give place and save_as without it')
    if (!a.restore && !a.place?.length && !a.save_as) return refuse('give place, save_as or restore')
    // Everything is checked before a window moves (ER-2).
    const saveName = a.save_as ? layoutName(a.save_as) : null
    if (a.save_as && !saveName) return refuse('a layout name is up to 40 letters, digits, spaces, _ or -')
    if (a.save_as && !deps.layouts) return refuse('layouts cannot be kept on this computer')
    const wants: Want[] = []
    const skipped: Answer[] = []
    if (a.restore) {
      const saved = deps.layouts?.read() ?? {}
      const name = layoutName(a.restore)
      const layout = name && Object.hasOwn(saved, name) ? saved[name] : undefined
      if (!layout) return refuse(`no layout «${a.restore}»; saved: ${Object.keys(saved).join(', ') || 'none'}`)
      for (const p of layout.placements) {
        const display = p.display === undefined ? undefined : String(p.display)
        if (p.window !== 'session') { wants.push({ target: p.window === 'dashboards' ? { kind: 'dashboards' } : { kind: p.window, subject: null }, area: p.area, display }); continue }
        const same = p.session_id ? deps.ptys.get(p.session_id) : null
        const live = same?.running ? same : deps.ptys.list().find((s) => s.running && p.project_id && s.projectId === p.project_id && s.sessionId !== deps.ceoSessionId())
        if (live) wants.push({ target: { kind: 'session', subject: live.sessionId, project_id: live.projectId }, area: p.area, display })
        else skipped.push({ window: p.session_id ?? p.project_id ?? 'session', reason: 'its session ended and its project runs no console' })
      }
    } else if (a.place?.length) {
      for (const p of a.place) {
        const t = await resolveWindow(p.window, p.dashboard)
        if ('refused' in t) return refuse(t.refused)
        wants.push({ target: t, area: p.area, display: p.display })
      }
    }
    const placed = wants.length ? await arrange(wants, a.display) : []
    let savedAs: string | null = null
    if (saveName && deps.layouts) {
      const layouts = deps.layouts
      let placements: SavedPlacement[]
      const asScreen = (n: number | undefined): SavedPlacement['display'] => (n && n >= 1 && n <= 8 ? n : undefined)
      if (wants.length) {
        // The screen each one went to is kept, so a restore on two screens puts it back there (UX-8).
        placements = placed.filter((p) => p.ok).map((p): SavedPlacement => {
          const key = p.window
          const want = wants.find((x) => (x.target.kind === 'session' ? x.target.subject : x.target.kind) === key)
          const t = want?.target
          return t && t.kind === 'session'
            ? { window: 'session', session_id: t.subject ?? undefined, project_id: t.project_id ?? null, area: p.area ?? 'full', display: asScreen(p.screen) }
            : { window: (t?.kind ?? key) as 'main' | 'ceo' | 'dashboards', area: p.area ?? 'full', display: asScreen(p.screen) }
        })
      } else {
        // The windows as they stand: each one's nearest area on its own screen, Fabric Dashboards' too (UX-8, ER-10).
        const displays = w.displays()
        const at = (r: Rect, full: boolean): { area: WindowArea; display?: SavedPlacement['display'] } | null => {
          const d = displayOf(displays, r)
          return d ? { area: full ? 'fullscreen' : nearestArea(d.workArea, r), display: asScreen(ordered(displays).indexOf(d) + 1) } : null
        }
        placements = w.list().filter((x) => x.kind !== 'editor' && !x.minimized).flatMap((x): SavedPlacement[] => {
          const p = at(x.bounds, x.fullScreen)
          if (!p) return []
          if (x.kind === 'session') {
            const s = x.subject ? deps.ptys.get(x.subject) : null
            return [{ window: 'session', session_id: x.subject ?? undefined, project_id: s?.projectId ?? null, ...p }]
          }
          return [{ window: x.kind as 'main' | 'ceo', ...p }]
        })
        const dash = deps.dashboards ? await deps.dashboards.window(false).catch(() => null) : null
        if (dash && dash.known && dash.rect) { const p = at(dash.rect, false); if (p) placements.push({ window: 'dashboards', ...p }) }
        if (!placements.length) return refuse('no window is open to keep')
      }
      const write = saving.then(() => {
        // Read again just before the write, in turn with every other save (DA-3, ER-9).
        const all: SavedLayouts = Object.assign(Object.create(null), layouts.read())
        all[saveName] = { saved_at: now().toISOString(), placements: placements.slice(0, 12) }
        layouts.write(boundLayouts(all))
      })
      saving = write.catch(() => undefined)
      try {
        await write
        savedAs = saveName
      } catch (e) { /* said to the caller as the tool's refusal, never as success; the act's record says it failed */
        // DA-5: the caller (and the voice call) gets the error's code; the message, with its paths, stays in the record.
        const code = (e as { code?: unknown })?.code
        deps.record('ceo.window.layout', { outcome: 'failed', saved: saveName, windows: placed.length, error: e instanceof Error ? e.message.slice(0, 200) : String(e), reason: a.reason })
        return refuse(`the layout could not be kept${typeof code === 'string' ? ` (${code})` : ''}`, { placed })
      }
    }
    const failed = placed.filter((p) => !p.ok).length
    deps.record('ceo.window.layout', { windows: placed.length, failed, skipped: skipped.length, restored: a.restore ?? null, saved: savedAs, reason: a.reason })
    // ER-3: a restore that put nothing back, or left some out, does not answer as a success.
    const ok = failed === 0 && skipped.length === 0 && (placed.length > 0 || (!!savedAs && !a.restore))
    return { ok, ...(ok ? {} : { partial: placed.some((p) => p.ok) || !!savedAs }), placed, skipped, saved_as: savedAs }
  }

  async function dashboards(a: z.infer<typeof CEO_TOOLS.dashboards.input>): Promise<Answer> {
    if (!deps.dashboards) return refuse('Fabric Dashboards is not reachable from here')
    const all = deps.dashboards.list()
    const found = listDashboards(all, a.query)
    return { ok: true, dashboards: found.slice(0, 100).map((d) => ({ key: d.key, name: d.name, what: d.summary, placement: d.placement })), total: all.length }
  }

  async function dashboardOpen(a: z.infer<typeof CEO_TOOLS.dashboard_open.input>): Promise<Answer> {
    if (!deps.dashboards) return refuse('Fabric Dashboards is not reachable from here')
    const pick = pickDashboard(deps.dashboards.list(), a.dashboard)
    // UX-1, UX-2, ER-4: a tie or a weak match is asked about, never guessed.
    if ('missing' in pick) return refuse(`no dashboard «${a.dashboard}»: fabric_ceo_dashboards lists them`)
    if ('ambiguous' in pick) return refuse(`«${a.dashboard}» fits several dashboards; ask the owner which`, { candidates: pick.ambiguous.slice(0, 8).map((d) => ({ key: d.key, name: d.name, placement: d.placement })) })
    const top = pick.found
    const link = dashLink(top.key, a.path ?? '/')
    try {
      await deps.dashboards.open(link)
    } catch { /* said to the caller as the tool's refusal, never as success; the act's record says it failed */
      deps.record('ceo.dashboard.open', { key: top.key, outcome: 'failed', reason: a.reason })
      return refuse('Fabric Dashboards did not take the link: is it installed?')
    }
    let placed: Placed | null = null
    if (a.area || a.display) {
      placed = deps.windows
        ? (await arrange([{ target: { kind: 'dashboards' }, area: a.area ?? 'full', display: a.display }], undefined))[0] ?? null
        : { window: 'dashboards', ok: false, reason: 'this Fabric reads no screens to place it on' }
    }
    deps.record('ceo.dashboard.open', { key: top.key, area: a.area ?? null, placed: placed ? placed.ok : null, reason: a.reason })
    // ER-5: the dashboard opened; a move asked for and not made is said at the top, not only inside `placed`.
    return {
      ok: !placed || placed.ok, ...(placed && !placed.ok ? { partial: true } : {}),
      opened: { key: top.key, name: top.name }, link, ...(placed ? { placed } : {}),
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
