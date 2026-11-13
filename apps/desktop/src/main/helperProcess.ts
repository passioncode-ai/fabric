// #region helper-process — docs: docs/adr/0119-acp-is-the-generic-runner-drive-and-runners-are-catalogue-rows.md#amendment-2--2026-10-05-the-acp-shell-is-the-launch-path-and-sign-in-is-the-persons
/**
 * How Fabric starts its own helper programs (P-10): the ACP terminal shell and the stdio MCP bridge.
 *
 * In the built app they are entries of the main bundle (`out/main/acp-shell.js`, `mcp-bridge.js`,
 * electron.vite.config.ts) run by Electron's own binary as Node (`ELECTRON_RUN_AS_NODE=1`), so a
 * packaged Fabric needs no Node on the machine. From the sources (tests, a probe) the TypeScript
 * entry runs under Node's type stripping. Absolute program paths only: ACP requires an absolute
 * `command` for a stdio server.
 *
 * In a macOS bundle the program is the bundle's `<Name> Helper` binary, not `MacOS/<Name>` (CO-575): the same
 * Electron, but a process named "Fabric Helper", so a stop of Fabric by its name (`killall Fabric`, `pkill -x
 * Fabric`) ends Fabric and leaves the helpers serving the agents' sessions running.
 */
import { existsSync } from 'node:fs'
import path from 'node:path'

export type Helper = 'acp-shell' | 'mcp-bridge'
const SOURCES: Record<Helper, string> = { 'acp-shell': 'acpShellMain.ts', 'mcp-bridge': 'mcpStdioBridgeMain.ts' }

export interface HelperCommand {
  program: string
  args: string[]
  /** Environment the program needs to run as Node. */
  env: Record<string, string>
}

export function helperCommand(
  name: Helper,
  here: string = import.meta.dirname,
  execPath: string = process.execPath,
  electron: boolean = Boolean(process.versions.electron),
  exists: (file: string) => boolean = existsSync
): HelperCommand {
  const built = path.join(here, `${name}.js`)
  if (exists(built)) return { program: electron ? nodeHost(execPath, exists) : execPath, args: [built], env: electron ? { ELECTRON_RUN_AS_NODE: '1' } : {} }
  const source = path.join(here, SOURCES[name])
  if (!exists(source)) throw new Error(`Fabric's ${name} helper is missing from this build`)
  return { program: execPath, args: ['--experimental-strip-types', source], env: {} }
}
/** The binary that runs a helper as Node: a macOS bundle's `<Name> Helper` when the bundle has one, else `execPath`. */
export function nodeHost(execPath: string, exists: (file: string) => boolean = existsSync): string {
  const m = /^(.*\.app)\/Contents\/MacOS\/([^/]+)$/.exec(execPath)
  if (!m) return execPath
  const helper = path.join(m[1], 'Contents', 'Frameworks', `${m[2]} Helper.app`, 'Contents', 'MacOS', `${m[2]} Helper`)
  return exists(helper) ? helper : execPath
}
// #endregion helper-process
