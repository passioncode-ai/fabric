// #region adapter-skills — docs: docs/ux/scenarios.md#scn-136-create-an-ecosystem-agent
// Are the Fabric Agent Adapter skills where this coding agent reads skills? (0.3.3 onboarding, REQ-04.)
//
// Creating an ecosystem agent (SCN-136) and turning an existing one into one (SCN-131) run in a coding
// agent's own console with the `creating-fabric-agents` and `adapting-projects-to-fabric` skills. A session
// started without them builds something that is not held to the Fabric contract, so the start screens say,
// before the launch, whether they are there — and, when they are not, the command that installs them.
// Fabric installs nothing (operator decision D2, 2026-10-08).
//
// Where each agent reads skills is a fact about that agent, so it is written down here rather than guessed:
// Claude Code reads its enabled plugins and `~/.claude/skills`; the others read their own folder. The shared
// `~/.agents/skills` folder is where the PassionCode launcher puts plain copies; a skill found ONLY there is
// reported as "in the shared folder", because whether a given agent reads that folder is not checked here.
// Reads only; a file that is there but cannot be read (permissions, not a regular file, too large, timed out) is
// named in `unreadable` so the screen says so — never an error that blocks the screen.

import { readFile, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { AdapterSkill, AdapterSkillsView } from '../shared/startPaths.ts'
import { ADAPTER_SKILLS } from '../shared/startPaths.ts'

export type { AdapterSkillsView }

export const ADAPTER_PLUGIN = 'fabric-agent-adapter@passioncode'
export { ADAPTER_SKILLS }
/** The one command that installs or updates the skill set for every agent on the machine. */
export const INSTALL_COMMAND = 'npx @passioncode-ai/passioncode@latest update'

// Source for the folders below: the PassionCode launcher that INSTALL_COMMAND runs, `@passioncode-ai/passioncode`
// 0.1.31 `lib/launcher.js` (read 2026-10-08): "Claude Code reads plugins, so nothing is written to ~/.claude/skills"
// (lines 8-10), and its CHANNELS list (lines 21-25) — `.codex/skills`, `.hermes/skills`, `.kilocode/skills` among
// them, and no folder for Cline or Kimi Code. A plain copy in `~/.claude/skills` is still read by Claude Code.
/** Each agent's own skills folder, relative to the home folder. Absent: the agent has no folder of its own we know of. */
const OWN_SKILLS: Readonly<Record<string, string>> = {
  'claude-code': '.claude/skills',
  codex: '.codex/skills',
  kilo: '.kilocode/skills',
  hermes: '.hermes/skills'
}
/** The agents INSTALL_COMMAND puts the skills where they read them: the launcher's plugin and channels above. */
const LAUNCHER_COVERS = new Set(['claude-code', 'codex', 'kilo', 'hermes'])
const SHARED_SKILLS = '.agents/skills'
/** A skill file or a settings file larger than this is not one: it is not read (0.3.3 verification ER-7). */
const MAX_READ = 1024 * 1024
/** Each read may take this long; a FIFO or a stalled mount must not leave the screen on "Checking…" for ever. */
const READ_TIMEOUT_MS = 3000

export interface SkillsFs {
  readFile(p: string): Promise<string>
  /** Absent in a fake: every path is taken to be a small regular file. */
  stat?(p: string): Promise<{ isFile(): boolean; size: number }>
}
const REAL_FS: SkillsFs = { readFile: (p) => readFile(p, 'utf8'), stat: (p) => stat(p) }

/** Present but not readable: a permission error, a FIFO, a folder, a file too large, or a read that timed out. */
const UNREADABLE = Symbol('unreadable')
type Read = string | null | typeof UNREADABLE

const within = <T>(work: Promise<T>): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out')), READ_TIMEOUT_MS)
    timer.unref?.()
    work.then((v) => { clearTimeout(timer); resolve(v) }, (e: unknown) => { clearTimeout(timer); reject(e) })
  })
const absent = (e: unknown): boolean => ['ENOENT', 'ENOTDIR'].includes((e as NodeJS.ErrnoException)?.code ?? '')

const read = async (fs: SkillsFs, p: string): Promise<Read> => {
  // `stat`, not `lstat`: skill folders are often links into a shared hub, and a link to a regular file is fine.
  // Only a regular file of a sane size is opened, so a FIFO is never read and cannot hang the check.
  if (fs.stat) {
    try {
      const st = await within(fs.stat(p))
      if (!st.isFile() || st.size > MAX_READ) return UNREADABLE
    } catch (e) { return absent(e) ? null : UNREADABLE /* not silence: the screen says it could not be read */ }
  }
  try { return await within(fs.readFile(p)) } catch (e) { return absent(e) ? null : UNREADABLE /* said on the screen */ }
}
const json = (text: Read): unknown => {
  if (text === null || text === UNREADABLE) return null
  try { return JSON.parse(text) } catch { return null /* not silence: settings that do not parse enable no plugin, so it reads as not found */ }
}
/** `version: "0.8.0"` from a skill's front matter metadata. */
export function skillVersion(skillMd: string): string | null {
  const head = /^---\r?\n([\s\S]*?)\r?\n---/.exec(skillMd)?.[1] ?? ''
  const m = /^\s+version:\s*["']?([0-9][^"'\s]*)["']?\s*$/m.exec(head)
  return m ? m[1] : null
}

interface FolderRead { found: Record<AdapterSkill, boolean>; version: string | null; unreadable: string[] }
async function inFolder(fs: SkillsFs, dir: string): Promise<FolderRead> {
  const found = {} as Record<AdapterSkill, boolean>
  const unreadable: string[] = []
  let version: string | null = null
  for (const s of ADAPTER_SKILLS) {
    const file = path.join(dir, s, 'SKILL.md')
    const md = await read(fs, file)
    found[s] = typeof md === 'string'
    if (md === UNREADABLE) unreadable.push(file)
    if (typeof md === 'string') version ??= skillVersion(md)
  }
  return { found, version, unreadable }
}

const all = (f: Record<AdapterSkill, boolean>): boolean => ADAPTER_SKILLS.every((s) => f[s])

/** Claude Code's enabled plugin: enabled in settings.json, recorded in installed_plugins.json, both skills in its install path. */
async function claudePlugin(fs: SkillsFs, claudeHome: string, unreadable: string[]): Promise<FolderRead | null> {
  // A settings file that is there but cannot be read is named, not taken for "no plugin" (iteration 2, ER-7).
  const readNamed = async (file: string): Promise<Read> => {
    const got = await read(fs, file)
    if (got === UNREADABLE) unreadable.push(file)
    // A file that reads but does not parse is named too (recheck of iteration 3, ER-8): reinstalling cannot fix it.
    else if (typeof got === 'string' && json(got) === null) unreadable.push(file)
    return got
  }
  const settings = json(await readNamed(path.join(claudeHome, 'settings.json'))) as { enabledPlugins?: Record<string, unknown> } | null
  if (settings?.enabledPlugins?.[ADAPTER_PLUGIN] !== true) return null
  const installed = json(await readNamed(path.join(claudeHome, 'plugins', 'installed_plugins.json'))) as
    { plugins?: Record<string, { installPath?: unknown; version?: unknown }[]> } | null
  const entry = installed?.plugins?.[ADAPTER_PLUGIN]?.[0]
  if (!entry || typeof entry.installPath !== 'string') return null
  const got = await inFolder(fs, path.join(entry.installPath, 'skills'))
  return { ...got, version: typeof entry.version === 'string' ? entry.version : got.version }
}

export async function adapterSkills(agentId: string, opts: { home?: string; fs?: SkillsFs; env?: Record<string, string | undefined> } = {}): Promise<AdapterSkillsView> {
  const home = opts.home ?? os.homedir()
  const fs = opts.fs ?? REAL_FS
  const env = opts.env ?? process.env
  // Claude Code reads its configuration from CLAUDE_CONFIG_DIR when it is set, as Fabric's quota reader does
  // (`quota.ts`); the sessions Fabric starts inherit the same environment (0.3.3 verification DA-9).
  const claudeHome = env.CLAUDE_CONFIG_DIR?.trim() || path.join(home, '.claude')
  const unreadable: string[] = []
  const view = (where: AdapterSkillsView['where'], found: Record<AdapterSkill, boolean>, version: string | null, ready: boolean): AdapterSkillsView =>
    ({ ready, where, version, found, command: INSTALL_COMMAND, launcherCovers: LAUNCHER_COVERS.has(agentId), unreadable })
  if (agentId === 'claude-code') {
    const plugin = await claudePlugin(fs, claudeHome, unreadable)
    if (plugin) unreadable.push(...plugin.unreadable)
    if (plugin && all(plugin.found)) return view('plugin', plugin.found, plugin.version, true)
  }
  // Own property only: an id such as `constructor` is an unknown agent, not Object's prototype (ER-7).
  const own = Object.hasOwn(OWN_SKILLS, agentId) ? (agentId === 'claude-code' ? claudeHome : path.join(home, OWN_SKILLS[agentId])) : null
  if (own) {
    const got = await inFolder(fs, agentId === 'claude-code' ? path.join(own, 'skills') : own)
    unreadable.push(...got.unreadable)
    if (all(got.found)) return view('agent-folder', got.found, got.version, true)
  }
  const shared = await inFolder(fs, path.join(home, SHARED_SKILLS))
  unreadable.push(...shared.unreadable)
  if (all(shared.found)) return view('shared', shared.found, shared.version, false)
  const none = Object.fromEntries(ADAPTER_SKILLS.map((s) => [s, false])) as Record<AdapterSkill, boolean>
  return view('none', none, null, false)
}
// #endregion adapter-skills
