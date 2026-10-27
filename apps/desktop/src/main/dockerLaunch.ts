// #region docker-launch — docs: docs/ux/scenarios.md#scn-161-fabric-opens-while-its-stack-is-still-starting
/**
 * CO-294 (the start half): Docker that does not answer at start is started by Fabric, without ever changing the docker
 * context of the machine (fabric-workspace, 2026-10-27: OrbStack started again switched the whole machine's context to
 * itself and sent other projects' scripts to an empty engine).
 * - Colima installed: Fabric starts Colima (`colima start`, for the profile the socket or the Colima context names) and
 *   nothing else; with no Colima socket or context it starts nothing.
 * - Otherwise OrbStack or Docker Desktop is started only when it is the one runtime installed and the socket the CLI
 *   would use is its own or the shared /var/run/docker.sock.
 * A network engine (`tcp://`), any other socket and Linux (Docker Engine is a system service) start nothing: the wait
 * and the failure are said as before. Started detached, in the background (`open -g`).
 */
import { spawn } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { dockerTarget } from './dockerPing.ts'

export interface DockerApp {
  /** As the person knows it, said on the splash. */
  name: 'OrbStack' | 'Docker Desktop' | 'Colima'
  command: string
  args: string[]
}

/** Colima as found on this machine: its program, and the engine address of a docker context that is Colima's. */
export interface ColimaFound { bin: string | null; host: string | null }

type Opts = { env?: NodeJS.ProcessEnv; platform?: NodeJS.Platform; exists?: (p: string) => boolean; colima?: ColimaFound }

/** The Colima profile a socket path or `unix://` address belongs to (`~/.colima/<profile>/docker.sock`), else null. */
export function colimaProfileOf(where: string | null): string | null {
  const m = where ? /\/\.colima\/([A-Za-z0-9][A-Za-z0-9_.-]*)\/docker\.sock$/.exec(where) : null
  return m ? m[1] : null
}

/** The `colima` program on PATH or in Homebrew's folders, and the first docker context whose engine is Colima's. */
export function findColima(env: NodeJS.ProcessEnv = process.env, exists: (p: string) => boolean = existsSync): ColimaFound {
  const dirs = [...(env.PATH ?? '').split(path.delimiter), '/opt/homebrew/bin', '/usr/local/bin'].filter(Boolean)
  const bin = dirs.map((d) => path.join(d, 'colima')).find((p) => exists(p)) ?? null
  let host: string | null = null
  const meta = path.join(env.DOCKER_CONFIG || (env.HOME ? path.join(env.HOME, '.docker') : ''), 'contexts', 'meta')
  try {
    for (const d of readdirSync(meta)) {
      const h = (JSON.parse(readFileSync(path.join(meta, d, 'meta.json'), 'utf8')) as { Endpoints?: { docker?: { Host?: unknown } } }).Endpoints?.docker?.Host
      if (typeof h === 'string' && colimaProfileOf(h)) { host = h; break }
    }
  } catch {
    // No docker contexts folder, or an unreadable one: no Colima context is known.
  }
  return { bin, host }
}

/** The app Fabric would start for the engine at `socket` (or the CLI's own choice when null); null to start none. */
export function dockerAppFor(socket: string | null, opts: Opts = {}): DockerApp | null {
  const env = opts.env ?? process.env
  const platform = opts.platform ?? process.platform
  const exists = opts.exists ?? existsSync
  const target = dockerTarget(socket, env, platform)
  if (!('socketPath' in target)) return null
  const where = target.socketPath
  if (platform === 'win32') {
    if (!/\\pipe\\docker_engine$/i.test(where)) return null
    const exe = path.win32.join(env.ProgramFiles || 'C:\\Program Files', 'Docker', 'Docker', 'Docker Desktop.exe')
    return exists(exe) ? { name: 'Docker Desktop', command: exe, args: [] } : null
  }
  if (platform !== 'darwin') return null
  const colima = opts.colima ?? findColima(env, exists)
  if (colima.bin) {
    const profile = colimaProfileOf(where) ?? colimaProfileOf(colima.host)
    if (!profile) return null
    return { name: 'Colima', command: colima.bin, args: profile === 'default' ? ['start'] : ['start', '--profile', profile] }
  }
  const bundle = (file: string): string | null => {
    for (const dir of ['/Applications', env.HOME ? path.join(env.HOME, 'Applications') : '']) {
      const p = dir ? path.join(dir, file) : ''
      if (p && exists(p)) return p
    }
    return null
  }
  const orb = bundle('OrbStack.app'), desk = bundle('Docker.app')
  // Two apps installed: starting either may take the machine's docker context from the other, so neither is started.
  if (orb && desk) return null
  const app = (name: DockerApp['name'], p: string | null): DockerApp | null => (p ? { name, command: 'open', args: ['-g', '-a', p] } : null)
  if (where.includes('/.orbstack/')) return app('OrbStack', orb)
  if (where.includes('/.docker/run/') || where.includes('/.docker/desktop/')) return app('Docker Desktop', desk)
  if (where === '/var/run/docker.sock') return app('OrbStack', orb) ?? app('Docker Desktop', desk)
  return null
}

/** Starts `app` detached and unreferenced; its name once the system took the start, null when it could not. */
export function launchDockerApp(app: DockerApp | null, opts: { spawnImpl?: typeof spawn } = {}): Promise<string | null> {
  if (!app) return Promise.resolve(null)
  const spawnImpl = opts.spawnImpl ?? spawn
  return new Promise((resolve) => {
    try {
      const child = spawnImpl(app.command, app.args, { detached: true, stdio: 'ignore', windowsHide: true })
      child.once('error', () => resolve(null))
      child.once('spawn', () => resolve(app.name))
      child.unref()
    } catch {
      // A command the system cannot start at all is "no app started": the wait goes on as before.
      resolve(null)
    }
  })
}
// #endregion docker-launch
