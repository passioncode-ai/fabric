// #region docker-ping — docs: docs/ux/scenarios.md#scn-161-fabric-opens-while-its-stack-is-still-starting
/**
 * Whether Docker answers (0.3.7 review ER-4): `GET /_ping` on the socket the stack's refusal named, else the one
 * DOCKER_HOST names, else the current docker context's (0.3.13: Colima publishes no /var/run/docker.sock), else the
 * platform's default. Docker's own engine API, so no `docker` CLI on PATH is needed (an OrbStack-only Mac has its CLI
 * in ~/.orbstack/bin). Bounded: a socket that accepts and never answers is "no".
 */
import http from 'node:http'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

export const DOCKER_PING_MS = 2000

type Target = { socketPath: string } | { host: string; port: number }

const readJson = (file: string): Record<string, unknown> | null => {
  try {
    const v: unknown = JSON.parse(readFileSync(file, 'utf8'))
    return v && typeof v === 'object' ? v as Record<string, unknown> : null
  } catch {
    // A missing or unreadable docker config is the ordinary case (no context set): the platform default is asked instead.
    return null
  }
}

/**
 * The engine address of the docker context the CLI would use: DOCKER_CONTEXT, else `currentContext` in the config
 * folder (DOCKER_CONFIG, else HOME/.docker), read from `contexts/meta/<sha256 of the name>/meta.json`, the CLI's own
 * layout. Null for the default context or anything unreadable. Only the environment handed in is read, never the
 * process's own home, so a caller with no HOME reads no context.
 */
export function dockerContextHost(env: NodeJS.ProcessEnv): string | null {
  const dir = env.DOCKER_CONFIG || (env.HOME ? path.join(env.HOME, '.docker') : '')
  if (!dir) return null
  const name = env.DOCKER_CONTEXT || readJson(path.join(dir, 'config.json'))?.currentContext
  if (typeof name !== 'string' || !name || name === 'default') return null
  const meta = readJson(path.join(dir, 'contexts', 'meta', createHash('sha256').update(name).digest('hex'), 'meta.json'))
  const host = (meta?.Endpoints as { docker?: { Host?: unknown } } | undefined)?.docker?.Host
  return typeof host === 'string' && host ? host : null
}

/** Where to ask: the socket named, DOCKER_HOST (`unix://`, `npipe://`, `tcp://`), the current docker context's
 *  endpoint, or the platform's default: the docker CLI's own order. */
export function dockerTarget(socket: string | null, env: NodeJS.ProcessEnv = process.env, platform: NodeJS.Platform = process.platform): Target {
  if (socket) return { socketPath: socket }
  const host = env.DOCKER_HOST || dockerContextHost(env) || ''
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
