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
// Reads only; a file that cannot be read is "not found", never an error that blocks the screen.

import { readFile } from 'node:fs/promises'
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


export interface SkillsFs {
  readFile(p: string): Promise<string>
}
const REAL_FS: SkillsFs = { readFile: (p) => readFile(p, 'utf8') }

const read = async (fs: SkillsFs, p: string): Promise<string | null> => {
  try { return await fs.readFile(p) } catch { return null /* not silence: unreadable is "not found here", which the screen says */ }
}
const json = (text: string | null): unknown => {
  if (text === null) return null
  try { return JSON.parse(text) } catch { return null /* not silence: settings that do not parse enable no plugin, so it reads as not found */ }
}
/** `version: "0.8.0"` from a skill's front matter metadata. */
export function skillVersion(skillMd: string): string | null {
  const head = /^---\r?\n([\s\S]*?)\r?\n---/.exec(skillMd)?.[1] ?? ''
  const m = /^\s+version:\s*["']?([0-9][^"'\s]*)["']?\s*$/m.exec(head)
  return m ? m[1] : null
}

async function inFolder(fs: SkillsFs, dir: string): Promise<{ found: Record<AdapterSkill, boolean>; version: string | null }> {
  const found = {} as Record<AdapterSkill, boolean>
  let version: string | null = null
  for (const s of ADAPTER_SKILLS) {
    const md = await read(fs, path.join(dir, s, 'SKILL.md'))
    found[s] = md !== null
    if (md !== null) version ??= skillVersion(md)
  }
  return { found, version }
}

const all = (f: Record<AdapterSkill, boolean>): boolean => ADAPTER_SKILLS.every((s) => f[s])

/** Claude Code's enabled plugin: enabled in settings.json, recorded in installed_plugins.json, both skills in its install path. */
async function claudePlugin(fs: SkillsFs, home: string): Promise<{ found: Record<AdapterSkill, boolean>; version: string | null } | null> {
  const settings = json(await read(fs, path.join(home, '.claude', 'settings.json'))) as { enabledPlugins?: Record<string, unknown> } | null
  if (settings?.enabledPlugins?.[ADAPTER_PLUGIN] !== true) return null
  const installed = json(await read(fs, path.join(home, '.claude', 'plugins', 'installed_plugins.json'))) as
    { plugins?: Record<string, { installPath?: unknown; version?: unknown }[]> } | null
  const entry = installed?.plugins?.[ADAPTER_PLUGIN]?.[0]
  if (!entry || typeof entry.installPath !== 'string') return null
  const got = await inFolder(fs, path.join(entry.installPath, 'skills'))
  return { found: got.found, version: typeof entry.version === 'string' ? entry.version : got.version }
}

export async function adapterSkills(agentId: string, opts: { home?: string; fs?: SkillsFs } = {}): Promise<AdapterSkillsView> {
  const home = opts.home ?? os.homedir()
  const fs = opts.fs ?? REAL_FS
  const view = (where: AdapterSkillsView['where'], found: Record<AdapterSkill, boolean>, version: string | null, ready: boolean): AdapterSkillsView =>
    ({ ready, where, version, found, command: INSTALL_COMMAND, launcherCovers: LAUNCHER_COVERS.has(agentId) })
  if (agentId === 'claude-code') {
    const plugin = await claudePlugin(fs, home)
    if (plugin && all(plugin.found)) return view('plugin', plugin.found, plugin.version, true)
  }
  const own = OWN_SKILLS[agentId]
  if (own) {
    const got = await inFolder(fs, path.join(home, own))
    if (all(got.found)) return view('agent-folder', got.found, got.version, true)
  }
  const shared = await inFolder(fs, path.join(home, SHARED_SKILLS))
  if (all(shared.found)) return view('shared', shared.found, shared.version, false)
  const none = Object.fromEntries(ADAPTER_SKILLS.map((s) => [s, false])) as Record<AdapterSkill, boolean>
  return view('none', none, null, false)
}
// #endregion adapter-skills
