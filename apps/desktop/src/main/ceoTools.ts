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
import { isCeoAddress } from '../shared/ceoAddress.ts'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { TerminalSession } from '../shared/types.ts'
import { decodePty } from '../shared/pty-decode.ts'
import { findProject, isCopyFolder, keyBytes, screenText, typedText, type NamedProject, type ProjectLookup, type WorkFolder } from '../shared/ceoAgent.ts'
import { isScratchFolder } from '../shared/scratchFolder.ts'
import { catalogue as catalogueOf, holder, matchProject, type CatalogueRow, type ProjectMatch } from '../shared/estateSearch.ts'
import { redact } from '../shared/redact.ts'
import { readTail, READ_TAIL_BYTES } from './machineSessions.ts'
import { chainOf, type Launch, type LaunchVia } from '../shared/sessionLaunches.ts'
import { withLaunchOrigin } from './launchOrigin.ts'
import { SHELL_TAKES_NO_TASK, TAKES_NO_TASK } from './consoleOpen.ts'
import { switchboardHomeRoots, type DiskSession } from './diskSessions.ts'

const reason = z.string().trim().min(3).max(400).describe('Why: one sentence the owner reads in History.')
const sessionId = z.string().trim().min(1).max(128).describe('A session id from fabric_ceo_sessions (session_sessions by voice): a Fabric console\'s or a Switchboard session\'s.')

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
    description: 'Start a coding session in a project as its own Fabric console, with its first task (a task in words goes to a coding agent only: with runner shell, give no task, then type commands with fabric_ceo_session_input); first_task in the answer says whether the task reached the session (delivered: a turn started; resubmitted; written_unconfirmed: typed, no turn seen; not_delivered; or pending), each but delivered and resubmitted (a turn started) with its next step. Name the project by its exact name, id, alias or own folder (fabric_ceo_projects lists them); a name matched by sound is asked back, a folder inside a project or an agent\'s worktree is refused with where to go, a cache or temporary folder is refused, and another folder Fabric does not know becomes a project. A typo in a typed name is forgiven (a name heard by voice is asked back); a canonical folder wins over a worktree, a duplicate or a temporary one, and several answer one list with each folder and role. Use it for new work; to steer a running session use fabric_ceo_session_input.',
    input: z.object({
      project: z.string().trim().min(1).max(400).describe('The project\'s name, id, absolute folder or folder name.'),
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
    description: 'Continue a session that ended, as itself, in a Fabric console: give a Fabric console\'s id (also one from before Fabric restarted: fabric_ceo_sessions with include_ended lists them) or a Claude Code or Codex session id (fabric_knowledge_search answers it). Fabric reads which Claude or Codex session the console ran as and opens a console with claude --resume (codex resume) in its project. Give no task to continue it as itself: a task always starts a new conversation in the project with that task, as does a console that never recorded its session (it gets one that says to carry on when no task is given). Switchboard is asked only for a session Fabric never saw.',
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
      via: z.enum(['console', 'voice']).optional().describe('Only launches made through this door: voice for the ones the voice call started (to find and stop your own hung starts).'),
      limit: z.number().int().min(1).max(100).optional().describe('How many, newest first; 30 by default.')
    }).strict()
  },
  projects: {
    mcp: 'fabric_ceo_projects',
    title: 'Fabric\'s projects',
    description: 'The projects Fabric knows, each with its folder and role (canonical, duplicate of which folder, worktree of which repository, temporary: ~/.cache, /tmp, listed only with include_temporary), default runner and how many of their consoles run. A query matches by words, by a folder (the projects in it) and, for a name heard by voice, by sound (Cyrillic or Latin, «DC» for «Диззи»). Call it ONCE with the word you heard instead of trying spellings in other tools. With exact, go on with that project unless the owner said otherwise; with understood_as or worktree, ask the owner first; with several and no exact, ask which one; why too-broad means a folder of many projects. Observatory knows every project of the computer.',
    input: z.object({
      query: z.string().trim().max(200).optional().describe('Only projects whose name or folder holds these words, or that sound like them.'),
      include_temporary: z.boolean().optional().describe('Also the projects in temporary folders.')
    }).strict()
  },
  task: {
    mcp: 'fabric_ceo_session_task',
    title: 'Did a session take its task',
    description: 'Whether a console Fabric started took its first task: delivered (a turn started), resubmitted, written_unconfirmed, not_delivered, pending, or unknown (no task tracked), each but delivered and resubmitted with its next step, and the last lines of its screen. Use it after fabric_ceo_session_start when first_task was pending, or before you tell the owner a session is working on something.',
    input: z.object({ session_id: sessionId }).strict()
  },
  alias: {
    mcp: 'fabric_ceo_project_alias',
    title: 'Remember another name for a project',
    description: 'Remember a name the owner uses for a project («Диззи» for dissy, «плейтюн» for playtune), so it is found by that name from now on, by voice and in the console. Only when the owner said which project the name means.',
    input: z.object({
      project: z.string().trim().min(1).max(400).describe('The project, by name, id or folder.'),
      alias: z.string().trim().min(2).max(60).describe('The other name, as the owner says it.'),
      remove: z.boolean().optional().describe('Forget this name instead (it was kept for the wrong project).'),
      reason
    }).strict()
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
  /** What became of a console's first task (`consoleOpen.ts#firstInstruction`); absent: not followed. */
  firstTask?(sessionId: string): Promise<{ state: string; reason?: string; attempts: number }> | null
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
  /** Every project with its role (`estateSearch.ts#catalogue`); absent: the roles from the folders alone. */
  catalogue?(): Promise<CatalogueRow[]>
  /** What the journal and the estate index know of a session that does not run in Fabric now (`knowledgeTools.ts#recallSession`). */
  recall?(id: string): Promise<RecalledSession | null>
  /** Consoles Fabric ran, newest first, also those from before it restarted. */
  pastConsoles?(limit: number): Promise<RecalledSession[]>
  /** A Fabric console that continues a Claude Code or Codex session as itself (`claude --resume`, `codex resume`). */
  openResumed?(projectId: string, runner: 'claude-code' | 'codex', runtimeSessionId: string, cwd: string | null, env: Record<string, string>): Promise<TerminalSession>
  /** The launch journal (`sessionLaunches.ts`), newest first; absent: no journal on this host. */
  launches?(q: { sessionId?: string; projectId?: string }): Promise<Launch[]>
  /** The Claude Code processes running on this computer, read from Claude Code's own files (`diskSessions.ts`). */
  diskSessions?(): Promise<DiskSession[]>
  /** Keep another name for a project (`ceoProjectAliases.ts`); answers the project's names after the write. */
  saveAlias?(projectId: string, alias: string): Promise<string[]>
  /** Forget one name of a project; answers its names after the write. */
  removeAlias?(projectId: string, alias: string): Promise<string[]>
  /** Whether a folder is a cache or temporary one, never made a project; the host's default reads its own home. */
  scratch?(folder: string): boolean
}

/** A tool as both doors name it (0.3.27 review, UX-7): the console's MCP name and the voice's function name. */
const T = {
  read: 'fabric_ceo_session_read (session_read by voice)',
  input: 'fabric_ceo_session_input (session_input by voice)',
  resume: 'fabric_ceo_session_resume (session_resume by voice)',
  projects: 'fabric_ceo_projects (session_projects by voice)',
  task: 'fabric_ceo_session_task (session_task by voice)',
  open: 'fabric_ceo_session_open (session_open by voice)'
} as const
/** By voice, a start waits this long for the first task, then answers pending (0.3.27 review, UX-6): the line is silent. */
export const VOICE_FIRST_TASK_WAIT_MS = 8000

/** Voice CEO retro 2026-11-20, finding 3: the voice typed twelve commands into a shell in two minutes, debugging by
 *  hand. The voice door types into one console at most this many times in VOICE_INPUT_WINDOW_MS: a shell fewer. */
export const VOICE_INPUTS = { shell: 3, agent: 6 } as const
export const VOICE_INPUT_WINDOW_MS = 3 * 60_000
/** Finding 8: the same tool refused this many times in VOICE_REPEAT_WINDOW_MS (the voice guessed names one by one). */
export const VOICE_REPEATS = 3
export const VOICE_REPEAT_WINDOW_MS = 30_000
/** A session that does not run in Fabric now, as the journal and the estate index know it. */
export interface RecalledSession {
  id: string
  kind: 'console' | 'transcript'
  projectId: string | null
  folder: string | null
  /** The console's runner (`claude-code`, `codex`, `shell`...), or the transcript's. */
  runner: string | null
  /** The Claude Code or Codex session it ran as. */
  runtimeSessionId: string | null
  /** The Claude config home of a Switchboard account, when the transcript is there. */
  configDir: string | null
  title: string | null
  at: string | null
}

type Answer = Record<string, unknown>
/** How long fabric_ceo_session_start waits for the first task's end before it answers `pending`. A Claude Code console can
 *  hold its first task up to a minute for its input box (`deliveryQueue.ts#PROMPT_WAIT_MS`), so a slow start often answers
 *  `pending`, and `fabric_ceo_session_task` reads the end later (0.3.27 review, run four, DO-40). */
export const FIRST_TASK_WAIT_MS = 70_000
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

/** The last turns of a Claude Code transcript (JSONL): who spoke, their words, the tools they called. `clean` runs on
 *  a turn's whole text before it is cut, so a cut never splits a credential the cleaning would have caught. */
export function transcriptTurns(jsonl: string, max = 12, clean: (text: string) => string = (x) => x): Array<{ role: string; text: string }> {
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
    turns.push({ role: String(row.type), text: clean(text).slice(0, 700) })
  }
  return turns.slice(-max)
}

/** Another session's turns as they may reach a screen or a model: redacted whole, then cut (0.3.26 review, iteration 2,
 *  DA-13; DA-14 tests it with a key across the cut). */
export const redactedTurns = (jsonl: string, max = 12): Array<{ role: string; text: string }> => transcriptTurns(jsonl, max, (x) => redact(x).text)

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
    // Switchboard's runtimes and homes: <root>/<home>/projects, one level down.
    let homes: string[]
    try { homes = readdirSync(root) } catch { continue /* a root not on this computer */ }
    for (const h of homes.slice(0, 200)) {
      const found = tryProjects(path.join(root, h, 'projects'))
      if (found) return found
    }
  }
  return null
}

/** `~/.claude` and Switchboard's folders of Claude homes (`runtimes`, `homes`; `diskSessions.ts#switchboardHomeRoots`). */
export function defaultTranscriptRoots(home = homedir()): string[] {
  return [path.join(home, '.claude'), ...switchboardHomeRoots(home)]
}

export function createCeoOperations(deps: CeoOpsDeps) {
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const scratch = deps.scratch ?? ((folder: string) => isScratchFolder(folder, homedir(), tmpdir()))
  /** The folders sessions work in, each with its project: an agent's worktree copy is found through them. */
  // Only an agent's worktree copy is a work folder here (0.3.27 review, ER-1): a console of a project with no repository
  // runs in the home folder, which must never make every folder under home that project's.
  const workFolders = async (): Promise<WorkFolder[]> => {
    const out: WorkFolder[] = deps.ptys.list().map((s) => ({ path: s.cwd, projectId: s.projectId }))
    try { for (const l of (await deps.launches?.({})) ?? []) out.push({ path: l.cwd, projectId: l.projectId }) } catch { /* the journal is a courtesy here: the consoles still answer */ }
    return out.filter((f) => f.path && f.projectId && isCopyFolder(f.path) && !isScratchFolder(f.path))
  }
  // `~` is the home folder (0.3.27 review, UX-13): «~» alone is then too broad, «~/DATA/x» a folder.
  const lookup = async <P extends NamedProject>(projects: readonly P[], query: string): Promise<ProjectLookup<P>> =>
    findProject(projects, /^~(\/|$)/.test(query.trim()) ? path.join(homedir(), query.trim().slice(1)) : query, await workFolders())
  /** A console's Claude Code session id from the launch journal, for a resume where it ran (0.3.27 review, UX-35). */
  const runnerIdOf = async (sessionId: string): Promise<string | null> => {
    try { return (await deps.launches?.({ sessionId }))?.find((l) => l.sessionId === sessionId)?.runnerSessionId ?? null } catch { return null /* the journal is a courtesy here */ }
  }
  /** A lookup that found no one project, said so the voice can act on it in one more step (findings 4 and 8). */
  const notOne = (query: string, found: Exclude<ProjectLookup<NamedProject>, { found: NamedProject }>, folderHint = false): Answer => {
    if ('ambiguous' in found) {
      const choices = found.ambiguous.slice(0, 3)
      return refuse(`«${query}» names several projects: ${choices.join(', ')}${found.ambiguous.length > 3 ? ` and ${found.ambiguous.length - 3} more` : ''}`, {
        choices,
        next: `ask the owner which one, reading at most these ${choices.length} aloud, then call again with the chosen choice exactly as written here (its folder decides)`
      })
    }
    if (found.why === 'ceo-itself') return refuse(`«${query}» is the CEO itself, not a project`, { next: 'ask the owner which project he means' })
    if (found.why === 'too-broad') return refuse(`«${query}» is a folder that holds many projects, not one project: name the project`, { next: `call ${T.projects} once with a word of its name` })
    return refuse(`no project «${query}»${folderHint ? `: name it by ${T.projects}, or give its absolute folder` : ''}`, {
      ...(found.near.length ? { near: found.near } : {}),
      next: found.near.length
        ? `read these near names to the owner and ask which one was meant: ${found.near.join(', ')}`
        : `call ${T.projects} once with a word of the name; do not try spellings one by one`
    })
  }
  /** Voice inputs per console, newest last; refusals per tool, for the voice door's limits. */
  const voiceInputs = new Map<string, number[]>()
  const voiceRefusals = new Map<string, number[]>()
  const now = (): number => Date.now()
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
  const rolesOf = async (): Promise<Array<CatalogueRow & NamedProject & { default_agent?: string | null }>> => {
    const all = await deps.projects()
    // A catalogue that fails is recorded; the roles are then read from the folders alone (0.3.27 review ER-75).
    const rows = deps.catalogue ? await deps.catalogue().catch((e: unknown) => { deps.record('ceo.projects.catalogue-failed', { error_class: e instanceof Error ? e.constructor.name : typeof e }); return null }) : null
    const byId = new Map((rows ?? catalogueOf(all)).map((r) => [r.id, r]))
    return all.map((p) => ({ ...p, ...(byId.get(p.id) ?? { role: 'canonical' as const, of: null }) }))
  }
  /** «names several projects» as one list a person reads: each folder with its role. */
  const listOf = (m: Extract<ProjectMatch, { ambiguous: CatalogueRow[] }>['ambiguous']): Array<Record<string, unknown>> =>
    m.slice(0, 10).map((r) => ({ name: r.name, folder: r.repo_path, role: r.role, ...(r.of ? { of: r.of } : {}) }))
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
      const found = await lookup(await deps.projects(), a.project)
      if (!('found' in found)) return notOne(a.project, found)
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
    let past: Answer[] | { unread: string } = []
    if (a.include_ended && deps.pastConsoles) {
      try {
        const live = new Set(deps.ptys.list().map((s) => s.sessionId))
        past = (await deps.pastConsoles(40)).filter((r) => !live.has(r.id) && (!a.project || folderFilter === null || (r.folder ?? '').startsWith(folderFilter)))
          .map((r) => ({ session_id: r.id, kind: 'fabric-console-ended', project: r.projectId ? names.get(r.projectId) ?? null : null, project_id: r.projectId, folder: r.folder,
            runner: r.runner, continues: r.runtimeSessionId, last_activity_at: r.at, resumable_as_itself: !!r.runtimeSessionId }))
      } catch (e) { past = { unread: e instanceof Error ? e.message.slice(0, 200) : String(e) } /* said in the answer, never read as no past consoles */ }
    }
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
      ...(a.include_ended ? { past_fabric_consoles: past } : {}),
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
      // ER-16 (0.3.26 review, iteration 2): the tail only, through a handle, never the whole transcript in memory.
      text = await readTail(file, READ_TAIL_BYTES)
    } catch (e) { /* said to the caller as the tool's refusal, never as success; the act's record says it failed */
      return refuse(`the transcript could not be read: ${e instanceof Error ? e.message : String(e)}`)
    }
    return { ok: true, kind: 'transcript', session_id: a.session_id, folder: path.basename(path.dirname(file)), turns: redactedTurns(text) }
  }

  async function input(a: z.infer<typeof CEO_TOOLS.input.input>, via?: LaunchVia): Promise<Answer> {
    if (a.session_id === deps.ceoSessionId()) {
      // Finding 6: the voice typed into the CEO's own console; the CEO takes a request through ask_ceo.
      return via === 'voice'
        ? refuse('this is the CEO\'s own console: hand the request to the CEO with ask_ceo, then read its answer with ceo_reply')
        : refuse('this is your own console: answer in your reply instead')
    }
    const s = deps.ptys.get(a.session_id)
    if (!s) return refuse('not a Fabric console: only consoles Fabric runs can be typed into; write to a Switchboard session through its own tools')
    if (!s.running) return refuse(`the console has ended: continue it with ${T.resume}`)
    if (via === 'voice') {
      // Finding 3: the voice answers a question or picks an option; it does not do a session's work by hand.
      const shell = s.optionId === 'shell'
      const limit = shell ? VOICE_INPUTS.shell : VOICE_INPUTS.agent
      const recent = (voiceInputs.get(s.sessionId) ?? []).filter((t) => now() - t < VOICE_INPUT_WINDOW_MS)
      if (recent.length >= limit) {
        return refuse(`${recent.length} inputs into this console in ${Math.round(VOICE_INPUT_WINDOW_MS / 60_000)} minutes: that is doing the work by hand`, {
          next: shell
            ? 'start the project\'s coding agent with session_start and the task in words, hand it to the CEO with ask_ceo, or open the console for the owner to type in with session_open'
            : 'let the session work, read it later with session_read, hand the request to the CEO with ask_ceo, or open the console for the owner with session_open'
        })
      }
      voiceInputs.set(s.sessionId, [...recent, now()])
      // Consoles that ended leave the map (0.3.27 review, ER-12).
      for (const id of voiceInputs.keys()) if (!deps.ptys.get(id)?.running) voiceInputs.delete(id)
    }
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

  /** The first task's end, waited for at most FIRST_TASK_WAIT_MS; past it the answer says it is still on its way. */
  async function firstTaskOf(sessionId: string, via?: LaunchVia): Promise<Answer> {
    const pending = deps.firstTask?.(sessionId)
    if (!pending) return { state: 'unknown', next: `read the session with ${T.read} before you rely on it` }
    const wait = via === 'voice' ? VOICE_FIRST_TASK_WAIT_MS : FIRST_TASK_WAIT_MS
    const timeout = new Promise<null>((res) => { const t = setTimeout(() => res(null), wait); (t as { unref?: () => void }).unref?.() })
    const o = await Promise.race([pending.catch(() => null), timeout])
    if (!o) return { state: 'pending', next: `the session is still taking its task: check in a minute with ${T.task}; if its prompt is empty, type the task with ${T.input}` }
    if (o.state === 'not_delivered') return { state: o.state, reason: o.reason ?? null, attempts: o.attempts, next: `the task did not reach the session: read its screen with ${T.read}, then type the task with ${T.input}` }
    if (o.state === 'written_unconfirmed') return { state: o.state, reason: o.reason ?? null, attempts: o.attempts, next: `the task was typed but no turn started: read the screen with ${T.read}; if the prompt is empty or holds the task, press enter or type it again with ${T.input}` }
    return { state: o.state, attempts: o.attempts }
  }

  async function start(a: z.infer<typeof CEO_TOOLS.start.input>, via?: LaunchVia): Promise<Answer> {
    const projects = await rolesOf()
    let found: ProjectLookup<NamedProject> = await lookup(projects, a.project)
    // Main's matcher as a second opinion (the estate index, 2026-11-19): a canonical folder wins over a temporary or
    // duplicate one of the same name, and a typo in a typed name is forgiven; one heard by voice is asked back.
    // The second opinion never overrides the address words («SEO», «шеф» mean the CEO itself, 0.3.27 review UX-63),
    // a folder too broad to be one project, or a folder path: a path is its own project, never a near name's whose
    // folder merely begins the same way (UX-65).
    const typedPath = path.isAbsolute(a.project.trim())
    if (!('found' in found) && !('missing' in found && (found.why === 'ceo-itself' || found.why === 'too-broad')) && !typedPath) {
      const m = matchProject(projects, a.project)
      if ('found' in m) found = { found: projects.find((p) => p.id === m.found.id) ?? projects[0]!, ...(via === 'voice' && m.via !== 'id' && m.via !== 'folder' && m.found.name.toLowerCase() !== a.project.trim().toLowerCase() ? { heard: true as const } : {}) }
      else if ('ambiguous' in m && 'ambiguous' in found) return { ...notOne(a.project, found, true), candidates: listOf(m.ambiguous) }
    }
    if ('missing' in found && path.isAbsolute(a.project) && existsSync(a.project) && scratch(a.project)) {
      // Finding 5: a cache or temporary folder never becomes a project.
      return refuse(`«${a.project}» is a cache or temporary folder, never a project's: name the project or its own folder`)
    }
    let admittedNow = false
    if ('missing' in found && found.why !== 'too-broad' && path.isAbsolute(a.project) && existsSync(a.project)) {
      admittedNow = true
      try { found = { found: await deps.admitFolder(a.project) } } catch (e) { /* said to the caller as the tool's refusal, never as success; the act's record says it failed */
        return refuse(`the folder could not become a project: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    if (!('found' in found)) return notOne(a.project, found, true)
    const project = projects.find((p) => p.id === found.found.id) ?? found.found
    // 0.3.27 review, UX-1: a name matched by sound is asked back, never acted on: «SEO» is not the project ceo until
    // the owner says so. The second call names the project exactly.
    if ('heard' in found && found.heard) {
      return refuse(`«${a.project}» sounds like the project ${project.name}; nothing was started`, {
        understood_as: project.name, choices: [project.name],
        next: `ask the owner whether ${project.name} is meant; if yes, call again with the name ${project.name}`
      })
    }
    // 0.3.27 review, UX-2: a folder that is not the project's own (a subfolder, an agent's worktree) is not where the
    // console would open: it opens in the project's folder. Said, never done silently.
    // UX-15: a worktree named by its folder name is the same case: never the main folder in its place. UX-23: a folder
    // this call admitted is its project's own, whatever path the admission stored.
    const asked = /^[/~]/.test(a.project.trim()) ? path.resolve(a.project.trim().replace(/^~(?=\/|$)/, homedir())).replace(/\/+$/, '') : null
    const other = ('worktree' in found && found.worktree) || (!admittedNow && asked && project.repo_path && asked !== project.repo_path.replace(/\/+$/, '') ? asked : null)
    if (other) {
      const inThere = deps.ptys.list().filter((x) => x.cwd.replace(/\/+$/, '') === String(other).replace(/\/+$/, ''))
      const there = inThere.find((x) => x.running) ?? inThere.at(-1)
      return refuse(`${other} belongs to the project ${project.name}, whose console opens in ${project.repo_path ?? 'its own folder'}, not in that folder; nothing was started`, {
        choices: [project.name],
        next: there?.running
          ? `an agent works in that folder (session ${there.sessionId}): answer it with ${T.input}; or call again with the name ${project.name} to work in the project's own folder`
          : there
            ? `the session there (${there.sessionId}) has ended; open it for the owner with ${T.open}${(await runnerIdOf(there.sessionId)) ? `, or continue it where it ran with ${T.resume} and the id ${await runnerIdOf(there.sessionId)}` : ''}, or call again with the name ${project.name} to work in the project's own folder`
            : `to work in the project's own folder, call again with the name ${project.name}`
      })
    }
    const heard = {}
    const runner = a.runner ?? ((project as { default_agent?: string | null }).default_agent || 'claude-code')
    // 2026-11-20: a task in words typed into zsh is a parse error, never work. Refused before anything starts.
    if (a.task?.trim() && TAKES_NO_TASK.has(runner)) return refuse(`${SHELL_TAKES_NO_TASK}: start it with a coding agent (runner claude-code, codex, hermes, kimi-code or kilo), or without a task and type the command with ${T.input}`)
    try {
      const s = await withLaunchOrigin({ by: 'ceo', via: via ?? 'console', reason: a.reason, parentSessionId: deps.ceoSessionId() ?? undefined },
        () => deps.openConsole(project.id, runner, a.task))
      deps.record('ceo.session.start', { session_id: s.sessionId, project_id: project.id, runner: s.optionId, reason: a.reason })
      deps.note('session.start', { sessionId: s.sessionId, projectId: project.id, label: project.name, runner: s.optionId, reason: a.reason })
      // 2026-11-20: a started session sat 40 minutes on an empty prompt and the CEO believed it had its task. The answer
      // now waits for the task's delivery (bounded) and says what became of it.
      const firstTask = a.task?.trim() ? await firstTaskOf(s.sessionId, via) : null
      return { ok: true, session_id: s.sessionId, project: project.name, folder: s.cwd, runner: s.optionId, state: s.state,
        ...heard, ...(firstTask ? { first_task: firstTask } : {}) }
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

  const CARRY_ON = 'Продолжи работу этой сессии с того места, где она остановилась: прочитай состояние проекта и свои незакрытые задачи.'

  /** A Fabric console that continues `runtimeId` as itself, in `projectId` (or the project that holds `folder`). */
  async function resumeAsItself(r: RecalledSession, reason: string, from: string): Promise<Answer | null> {
    const runner = r.runner === 'codex' || r.runner === 'claude-code' ? r.runner : r.kind === 'transcript' ? (r.runner === 'codex' ? 'codex' : 'claude-code') : null
    if (!r.runtimeSessionId || !runner || !deps.openResumed) return null
    let projectId = r.projectId
    if (!projectId && r.folder) {
      const all = await deps.projects()
      projectId = holder(new Map(all.filter((p) => p.repo_path).map((p) => [p.repo_path!, p.id])), r.folder)?.value ?? null
      // A cache or temporary folder never becomes a project, here as in start (0.3.27 review ER-74).
      if (!projectId && path.isAbsolute(r.folder) && existsSync(r.folder) && !scratch(r.folder)) projectId = (await deps.admitFolder(r.folder)).id
    }
    if (!projectId) return null
    const env: Record<string, string> = r.configDir ? { CLAUDE_CONFIG_DIR: r.configDir } : {}
    const next = await deps.openResumed(projectId, runner, r.runtimeSessionId, r.folder, env)
    deps.record('ceo.session.resume', { from_session: from, session_id: next.sessionId, runtime_session_id: r.runtimeSessionId, via: 'resume-as-itself', reason })
    const names = await projectNames()
    deps.note('session.start', { sessionId: next.sessionId, projectId, label: names.get(projectId) ?? path.basename(next.cwd), runner: next.optionId, reason })
    return { ok: true, session_id: next.sessionId, continues: r.runtimeSessionId, runner: next.optionId, folder: next.cwd, as_itself: true }
  }

  async function resume(a: z.infer<typeof CEO_TOOLS.resume.input>): Promise<Answer> {
    const s = deps.ptys.get(a.session_id)
    if (s?.running) return refuse('the console is still running: type into it with fabric_ceo_session_input')
    // What Fabric itself knows of the session (a console before a restart, a transcript): continued in a Fabric console.
    let recalled: RecalledSession | null = null
    try { recalled = deps.recall ? await deps.recall(a.session_id) : null } catch (e) { /* the index not open: the console's own facts and Switchboard still answer */
      deps.record('ceo.session.recall', { session_id: a.session_id, outcome: 'failed', error: e instanceof Error ? e.message.slice(0, 200) : String(e) })
    }
    if (s && !recalled) recalled = { id: s.sessionId, kind: 'console', projectId: s.projectId, folder: s.cwd, runner: s.optionId, runtimeSessionId: null, configDir: null, title: null, at: null }
    // The launch journal knows a console's Claude Code session when the index does not (the voice retro's UX-35).
    if (recalled && recalled.kind === 'console' && !recalled.runtimeSessionId) recalled = { ...recalled, runtimeSessionId: await runnerIdOf(a.session_id) }
    if (recalled) {
      try {
        const itself = !a.task ? await resumeAsItself(recalled, a.reason, a.session_id) : null
        if (itself) return itself
        // A console that ran outside its project's folder (an agent's worktree) and cannot continue as itself would come
        // back in the project's own folder: refused, never a fresh agent told to carry on somewhere else (0.3.27 review,
        // UX-27, PL-21).
        if (recalled.kind === 'console' && recalled.projectId && recalled.folder) {
          const own = (await deps.projects()).find((p) => p.id === recalled!.projectId)?.repo_path?.replace(/\/+$/, '')
          if (own && recalled.folder.replace(/\/+$/, '') !== own) {
            const rid = recalled.runtimeSessionId
            return refuse(`this console ran in ${recalled.folder}, but a resume would open in the project's folder ${own}; nothing was started`, {
              next: rid ? `continue it where it ran with ${T.resume} and the id ${rid} (its Claude Code session), open it for the owner with ${T.open}, or start new work in the project with its name` : `open it for the owner with ${T.open}, or start new work in the project with its name`
            })
          }
        }
        if (recalled.kind === 'console' && recalled.projectId) {
          const next = await deps.openConsole(recalled.projectId, recalled.runner ?? 'claude-code', a.task ?? CARRY_ON)
          deps.record('ceo.session.resume', { from_session: a.session_id, session_id: next.sessionId, via: 'new-console', reason: a.reason })
          const names = await projectNames()
          deps.note('session.start', { sessionId: next.sessionId, projectId: recalled.projectId, label: names.get(recalled.projectId) ?? path.basename(next.cwd), runner: next.optionId, reason: a.reason })
          return { ok: true, session_id: next.sessionId, runner: next.optionId, folder: next.cwd, as_itself: false,
            why: recalled.runtimeSessionId ? 'a task was given, so a new conversation starts with it' : 'the console never recorded which Claude or Codex session it ran as' }
        }
        // A transcript (an id the knowledge search gives) with a task: a new conversation in the session's project, with
        // that task; never a task dropped on the way to Switchboard (0.3.27 review run nine, UX-75).
        if (recalled.kind !== 'console' && a.task) {
          let pid = recalled.projectId
          if (!pid && recalled.folder) {
            const all = await deps.projects()
            pid = holder(new Map(all.filter((p) => p.repo_path).map((p) => [p.repo_path!, p.id])), recalled.folder)?.value ?? null
          }
          if (!pid) return refuse(`this session ran in ${recalled.folder ?? 'a folder Fabric does not know'}, which is no project here; nothing was started`, { next: 'start the task in a project by its name, or resume the session without a task to continue it as itself' })
          const next = await deps.openConsole(pid, recalled.runner === 'codex' ? 'codex' : 'claude-code', a.task)
          deps.record('ceo.session.resume', { from_session: a.session_id, session_id: next.sessionId, via: 'new-console', reason: a.reason })
          const names = await projectNames()
          deps.note('session.start', { sessionId: next.sessionId, projectId: pid, label: names.get(pid) ?? path.basename(next.cwd), runner: next.optionId, reason: a.reason })
          return { ok: true, session_id: next.sessionId, runner: next.optionId, folder: next.cwd, as_itself: false, why: 'a task was given, so a new conversation starts with it in the session\'s project' }
        }
      } catch (e) { /* said to the caller as the tool's refusal, never as success; the act's record says it failed */
        return refuse(`the session did not start again: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    if (!/^[0-9a-f-]{36}$/.test(a.session_id)) return refuse('no Fabric console, transcript or Switchboard session has this id')
    // Switchboard continues a session and takes no task: a task is refused, never dropped (UX-75).
    if (a.task) return refuse('Switchboard continues this session as it was and cannot pass it a task; nothing was started', { next: 'resume it without a task, then type the task into it, or start the task in a project by its name' })
    const r = await deps.switchboard(['sessions', 'continue', a.session_id]).catch((e: unknown) => ({ code: 1, stdout: '', stderr: e instanceof Error ? e.message : String(e) }))
    deps.record('ceo.session.resume', { session_id: a.session_id, via: 'switchboard', code: r?.code ?? null, reason: a.reason })
    if (!r) return refuse(`${recalled ? 'Fabric found this session but could not continue it in a project here' : 'Fabric knows no such session'}, and Switchboard is not installed on this computer`)
    if (r.code === 0) deps.note('session.start', { sessionId: a.session_id, projectId: null, label: 'Switchboard', runner: 'switchboard', reason: a.reason, machine: true })
    const why = recalled ? 'Fabric found this session but could not continue it in a project here' : 'Fabric knows no such session'
    return r.code === 0 ? { ok: true, via: 'switchboard', said: r.stdout.slice(0, 400) } : refuse(`${why}, and Switchboard did not continue it: ${(r.stderr || r.stdout).slice(0, 300)}`)
  }

  async function open(a: z.infer<typeof CEO_TOOLS.open.input>): Promise<Answer> {
    const s = deps.ptys.get(a.session_id)
    if (!s) return refuse('only a Fabric console opens in a Fabric window')
    deps.openWindow(s.sessionId)
    deps.record('ceo.session.open', { session_id: s.sessionId, reason: a.reason })
    return { ok: true, opened: s.sessionId }
  }

  async function projects(a: z.infer<typeof CEO_TOOLS.projects.input>): Promise<Answer> {
    // «SEO», «шеф» … are the CEO itself: never matched against names such as an SEO agent's (the owner, 2026-11-21).
    if (a.query && isCeoAddress(a.query)) return refuse(`«${a.query}» is the CEO itself, not a project`, { next: 'ask the owner which project he means' })
    // Matched over every project, so a copy in a temporary folder still gives way to its project and is counted;
    // temporary ones are then left out unless asked (the estate index's rule).
    const all = await rolesOf()
    let temporaryHidden = 0
    const live = deps.ptys.list().filter((s) => s.running)
    const words = (a.query ?? '').toLowerCase().split(/\s+/).filter(Boolean)
    // A folder is looked up, never matched as a substring (0.3.27 review, UX-21).
    const folderQuery = !!a.query && /^[/~]/.test(a.query.trim())
    let matched = folderQuery ? [] : all.filter((p) => words.every((w) => `${p.name} ${p.repo_path ?? ''} ${(p.aliases ?? []).join(' ')}`.toLowerCase().includes(w)))
    let heard: string | undefined
    let worktree: string | undefined
    let why: string | undefined
    // Nothing by words: by sound (finding 4), the one heard or the close ones; understood_as only for a match by sound.
    if (!matched.length && a.query) {
      const found = await lookup(all, a.query)
      if ('found' in found) {
        matched = [found.found]
        if (found.heard) heard = found.found.name
        // Found through an agent's worktree: said, as a start says it (0.3.27 review, UX-26).
        // A worktree match is said with worktree and next, never understood_as: a «yes» to it must not become an alias (UX-32).
        if (found.worktree) worktree = found.worktree
      }
      else if (folderQuery) {
        // A folder that is no one project's: every project in it, as 0.3.26 listed them (0.3.27 review, UX-25, PL-15).
        const folder = path.resolve(a.query.trim().replace(/^~(?=\/|$)/, homedir())).replace(/\/+$/, '')
        matched = all.filter((p) => p.repo_path && p.repo_path.replace(/\/+$/, '').startsWith(folder + '/'))
        if ('missing' in found && found.why) why = found.why
      }
      else if ('ambiguous' in found) { const names = new Set(found.ambiguous); matched = all.filter((p) => names.has(p.repo_path ? `${p.name} (${p.repo_path})` : p.name)) }
      else if (found.near.length) return { ok: true, projects: [], near: found.near, next: `nothing by that name; the nearest are ${found.near.join(', ')}` }
    }
    // A copy (an agent's worktree, a cache) gives way to the project of the same name (0.3.27 review, UX-4).
    // A copy gives way by its name, or by a name that starts with a listed project's (UX-16: «sound-engine-copy-a»).
    const mains = matched.filter((p) => !isCopyFolder(p.repo_path)).map((p) => p.name.toLowerCase())
    const isCopyOfListed = (p: NamedProject): boolean => isCopyFolder(p.repo_path) && mains.some((m) => p.name.toLowerCase() === m || p.name.toLowerCase().startsWith(`${m}-`))
    let copies = matched.filter(isCopyOfListed).length
    matched = matched.filter((p) => !isCopyOfListed(p))
    if (!a.include_temporary) {
      const temp = matched.filter((p) => p.role === 'temporary')
      matched = matched.filter((p) => p.role !== 'temporary')
      if (a.query) copies += temp.length; else temporaryHidden = temp.length
    }
    // A project named exactly comes first and says so (0.3.27 review, UX-30): the voice goes on with it.
    const key = (a.query ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '-')
    const exactName = (p: NamedProject): boolean => !!key && (p.name.toLowerCase().replace(/[\s_-]+/g, '-') === key || (p.aliases ?? []).some((x) => x.toLowerCase().replace(/[\s_-]+/g, '-') === key))
    matched = [...matched.filter(exactName), ...matched.filter((p) => !exactName(p))]
    if (!a.query) { const rank = { canonical: 0, worktree: 1, duplicate: 2, temporary: 3 } as const; matched = [...matched].sort((x, y) => rank[x.role] - rank[y.role] || x.name.localeCompare(y.name)) }
    return {
      ok: true,
      ...(heard ? { understood_as: heard } : {}),
      ...(worktree ? { worktree, next: `that is a worktree of ${matched[0]?.name}: a start would open in the project's own folder; ask the owner which is meant, and keep no alias for it` } : {}),
      ...(why ? { why } : {}),
      ...(copies ? { copies_hidden: copies } : {}),
      ...(temporaryHidden && !a.include_temporary ? { note: 'Projects in temporary folders are left out; include_temporary lists them.' } : {}),
      ...(matched.length && exactName(matched[0]!) ? { exact: matched[0]!.name } : {}),
      projects: matched
        .slice(0, 200)
        .map((p) => ({ id: p.id, name: p.name, folder: p.repo_path, role: p.role, ...(p.of ? { of: p.of } : {}), default_runner: p.default_agent ?? null, consoles_running: live.filter((s) => s.projectId === p.id).length, ...(p.aliases?.length ? { aliases: p.aliases } : {}) }))
    }
  }

  async function launches(a: z.infer<typeof CEO_TOOLS.launches.input>): Promise<Answer> {
    if (!deps.launches) return refuse('this Fabric keeps no launch journal')
    let projectId: string | undefined
    if (a.project) {
      const found = await lookup(await deps.projects(), a.project)
      if (!('found' in found)) return notOne(a.project, found)
      projectId = found.found.id
    }
    const [names, all] = await Promise.all([projectNames(), deps.launches({})])
    const byId = new Map(all.map((l) => [l.sessionId, l]))
    let rows = all
    if (a.session_id) rows = rows.filter((l) => l.sessionId === a.session_id || l.runnerSessionId === a.session_id)
    if (projectId) rows = rows.filter((l) => l.projectId === projectId)
    if (a.open_only) rows = rows.filter((l) => l.end === null)
    if (a.via) rows = rows.filter((l) => l.via === a.via)
    const live = new Set(deps.ptys.list().filter((s) => s.running).map((s) => s.sessionId))
    return {
      ok: true,
      launches: rows.slice(0, a.limit ?? 30).map((l) => ({
        session_id: l.sessionId, project: names.get(l.projectId) ?? null, project_id: l.projectId, folder: l.cwd, branch: l.branch,
        runner: l.optionId, launched_by: l.by, via: l.via, reason: l.reason, parent_session_id: l.parentSessionId, task_id: l.taskId,
        request_id: l.requestId, started_at: l.startedAt, runner_session_id: l.runnerSessionId,
        resume: l.runnerSessionId && l.runner === 'claude-code' ? `claude --resume ${l.runnerSessionId}` : null,
        running_now: live.has(l.sessionId), ended_at: l.endedAt, end: l.end, exit_code: l.exitCode, stop_asked_by: l.stopAskedBy,
        chain: chainOf(l, byId).map((p) => ({ session_id: p.sessionId, launched_by: p.by, project: names.get(p.projectId) ?? null }))
      })),
      total: rows.length,
      note: 'end null with running_now false: the console was cut by a restart of Fabric or the computer (no end was written).'
    }
  }

  async function task(a: z.infer<typeof CEO_TOOLS.task.input>): Promise<Answer> {
    const s = deps.ptys.get(a.session_id)
    if (!s) return refuse(`only a console Fabric started has a first task to check; read another session with ${T.read}`)
    const pending = deps.firstTask?.(s.sessionId)
    // A short look, never the start's long wait: the voice is on the line.
    const o = pending ? await Promise.race([pending.catch(() => null), sleep(1500).then(() => 'pending' as const)]) : null
    // The same next steps as the start's answer (0.3.27 review, UX-18).
    const nextFor: Record<string, string> = {
      pending: `the session is still taking its task: check again in a minute; if its prompt is empty, type the task with ${T.input}`,
      written_unconfirmed: `the task was typed but no turn started: read the screen; if the prompt is empty or holds the task, press enter or type it again with ${T.input}`,
      not_delivered: `the task did not reach the session: type it with ${T.input}`,
      unknown: `read the screen before you rely on it`
    }
    const st = o === 'pending' ? 'pending' : o ? o.state : 'unknown'
    const first = { state: st, ...(o && o !== 'pending' ? { attempts: o.attempts, ...(o.reason ? { reason: o.reason } : {}) } : {}), ...(nextFor[st] ? { next: nextFor[st] } : {}) }
    return { ok: true, session_id: s.sessionId, running: s.running, first_task: first, screen: screen(s.sessionId, 15) }
  }

  async function alias(a: z.infer<typeof CEO_TOOLS.alias.input>): Promise<Answer> {
    if (!deps.saveAlias) return refuse('this Fabric keeps no project names of its own')
    const all = await deps.projects()
    const found = await lookup(all, a.project)
    if (!('found' in found)) return notOne(a.project, found)
    // A name heard by sound is asked back first, as for a start (0.3.27 review, UX-1, UX-9).
    if (('heard' in found && found.heard) || ('worktree' in found && found.worktree)) return refuse(`«${a.project}» ${'worktree' in found && found.worktree ? 'is a worktree of' : 'sounds like'} the project ${found.found.name}; nothing was kept`, { understood_as: found.found.name, choices: [found.found.name], next: `ask the owner, then call again with the name ${found.found.name}` })
    if (a.remove) {
      if (!deps.removeAlias) return refuse('this Fabric cannot forget a name yet')
      const before = (all.find((p) => p.id === found.found.id)?.aliases ?? []).map((x) => x.toLowerCase())
      if (!before.includes(a.alias.trim().replace(/\s+/g, ' ').toLowerCase())) return refuse(`«${a.alias}» is not a name kept for ${found.found.name}`, { aliases: [...(all.find((p) => p.id === found.found.id)?.aliases ?? [])] })
      const names = await deps.removeAlias(found.found.id, a.alias)
      deps.record('ceo.project.alias', { project_id: found.found.id, chars: a.alias.length, removed: true, reason: a.reason })
      return { ok: true, project: found.found.name, aliases: names }
    }
    // A worktree's folder name, or its last words, is never an alias of the project (UX-32): it would lose the worktree guard.
    const wkey = a.alias.trim().toLowerCase().replace(/[\s_-]+/g, '-')
    const wtName = (await workFolders()).find((f) => { const t = f.path.replace(/\/+$/, '').split('/').pop()?.toLowerCase().replace(/[\s_-]+/g, '-') ?? ''; return t === wkey || (wkey.length >= 4 && t.endsWith(`-${wkey}`)) })
    if (wtName) return refuse(`«${a.alias}» names the worktree ${wtName.path}; it is not kept as a name of ${found.found.name}`)
    // Another project's own name is never an alias (0.3.27 review, UX-9): it would make that project ambiguous.
    const key = a.alias.trim().toLowerCase().replace(/[\s_-]+/g, '-')
    const owner = all.find((p) => p.id !== found.found.id && p.name.trim().toLowerCase().replace(/[\s_-]+/g, '-') === key)
    if (owner) return refuse(`«${a.alias}» is the name of the project ${owner.name}; it cannot also name ${found.found.name}`)
    const names = await deps.saveAlias(found.found.id, a.alias)
    deps.record('ceo.project.alias', { project_id: found.found.id, chars: a.alias.length, reason: a.reason })
    return { ok: true, project: found.found.name, aliases: names }
  }

  const table: { [K in CeoToolName]: (a: z.infer<(typeof CEO_TOOLS)[K]['input']>, via?: LaunchVia) => Promise<Answer> } = {
    sessions, read, input, start, stop, resume, open, launches, projects, task, alias
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
      deps.record(`ceo.tool.${name}`, { outcome: answer.ok === false ? 'refused' : 'ok', ...(via ? { via } : {}) })
      // A tie that asks the owner to choose is a question, not a failed guess (0.3.27 review, PL-5): it does not count.
      if (via === 'voice' && answer.ok === false && !Array.isArray(answer.choices)) {
        // Finding 8: seven refused lookups in seven seconds. The third refusal in a row says stop and ask.
        const recent = [...(voiceRefusals.get(name) ?? []).filter((t) => now() - t < VOICE_REPEAT_WINDOW_MS), now()]
        voiceRefusals.set(name, recent)
        if (recent.length >= VOICE_REPEATS) return { ...answer, stop: `${recent.length} refusals of this tool in ${VOICE_REPEAT_WINDOW_MS / 1000} s: stop trying and ask the owner what they meant` }
      } else if (via === 'voice') voiceRefusals.delete(name)
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
  // The voice knows its tools by their function names (0.3.27 review, UX-7): each MCP name in a description is said so.
  const byVoice = new Map(Object.entries(CEO_TOOLS).map(([name, tool]) => [tool.mcp as string, `session_${name}`]))
  // The voice's own names for the CEO's tools and the knowledge tools (0.3.27 review UX-70).
  const voiced = (text: string): string => text.replace(/fabric_ceo_[a-z_]+/g, (m) => byVoice.get(m) ?? m).replace(/fabric_knowledge_(search|execute)/g, 'knowledge_$1')
  return Object.entries(CEO_TOOLS).map(([name, tool]) => ({
    type: 'function' as const,
    name: `session_${name}`,
    description: voiced(tool.description),
    parameters: z.toJSONSchema(tool.input)
  }))
}
// #endregion ceo-tools
