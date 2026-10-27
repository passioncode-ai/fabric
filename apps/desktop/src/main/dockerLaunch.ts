// #region docker-launch — docs: docs/ux/scenarios.md#scn-161-fabric-opens-while-its-stack-is-still-starting
/**
 * CO-294 (the start half): Docker that does not answer at start is started by Fabric when its own app is installed.
 * The app is the one the docker CLI would connect to: an OrbStack socket is OrbStack's, a Docker Desktop socket or pipe
 * is Docker Desktop's, the shared /var/run/docker.sock is whichever of the two is installed (OrbStack first). A network
 * engine (`tcp://`), Colima or any other socket, Linux (Docker Engine is a system service) and an app that is not
 * installed start nothing: the wait and the failure are said as before. Started in the background (`open -g`), detached.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { dockerTarget } from './dockerPing.ts'

export interface DockerApp {
  /** As the person knows it, said on the splash. */
  name: 'OrbStack' | 'Docker Desktop'
  command: string
  args: string[]
}

type Opts = { env?: NodeJS.ProcessEnv; platform?: NodeJS.Platform; exists?: (p: string) => boolean }

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
  const bundle = (file: string): string | null => {
    for (const dir of ['/Applications', env.HOME ? path.join(env.HOME, 'Applications') : '']) {
      const p = dir ? path.join(dir, file) : ''
      if (p && exists(p)) return p
    }
    return null
  }
  const app = (name: DockerApp['name'], file: string): DockerApp | null => {
    const p = bundle(file)
    return p ? { name, command: 'open', args: ['-g', '-a', p] } : null
  }
  if (where.includes('/.orbstack/')) return app('OrbStack', 'OrbStack.app')
  if (where.includes('/.docker/run/') || where.includes('/.docker/desktop/')) return app('Docker Desktop', 'Docker.app')
  if (where === '/var/run/docker.sock') return app('OrbStack', 'OrbStack.app') ?? app('Docker Desktop', 'Docker.app')
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
