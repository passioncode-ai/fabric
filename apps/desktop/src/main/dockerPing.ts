// #region docker-ping — docs: docs/ux/scenarios.md#scn-161-fabric-opens-while-its-stack-is-still-starting
/**
 * Whether Docker answers (0.3.7 review ER-4): `GET /_ping` on the socket the stack's refusal named, else the one
 * DOCKER_HOST names, else the platform's default. Docker's own engine API, so no `docker` CLI on PATH is needed (an
 * OrbStack-only Mac has its CLI in ~/.orbstack/bin). Bounded: a socket that accepts and never answers is "no".
 */
import http from 'node:http'

export const DOCKER_PING_MS = 2000

type Target = { socketPath: string } | { host: string; port: number }

/** Where to ask: the socket named, DOCKER_HOST (`unix://`, `npipe://`, `tcp://`), or the platform's default. */
export function dockerTarget(socket: string | null, env: NodeJS.ProcessEnv = process.env, platform: NodeJS.Platform = process.platform): Target {
  if (socket) return { socketPath: socket }
  const host = env.DOCKER_HOST ?? ''
  const unix = /^unix:\/\/(\/.+)$/.exec(host)
  if (unix) return { socketPath: unix[1] }
  const pipe = /^npipe:\/\/\/*\.\/pipe\/(.+)$/.exec(host)
  if (pipe) return { socketPath: `\\\\.\\pipe\\${pipe[1]}` }
  const tcp = /^tcp:\/\/([^:/]+):(\d+)/.exec(host)
  if (tcp) return { host: tcp[1], port: Number(tcp[2]) }
  return { socketPath: platform === 'win32' ? '\\\\.\\pipe\\docker_engine' : '/var/run/docker.sock' }
}

export function pingDocker(socket: string | null, opts: { deadlineMs?: number; env?: NodeJS.ProcessEnv; platform?: NodeJS.Platform } = {}): Promise<boolean> {
  const target = dockerTarget(socket, opts.env, opts.platform)
  return new Promise((resolve) => {
    let done = false
    const finish = (ok: boolean): void => { if (!done) { done = true; resolve(ok) } }
    const req = http.request({ ...target, path: '/_ping', method: 'GET', timeout: opts.deadlineMs ?? DOCKER_PING_MS }, (res) => {
      res.resume()
      finish(res.statusCode === 200)
    })
    req.on('timeout', () => { req.destroy(); finish(false) })
    req.on('error', () => finish(false))
    req.end()
  })
}
// #endregion docker-ping
