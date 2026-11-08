// #region docker-ping — docs: docs/ux/scenarios.md#scn-161-fabric-opens-while-its-stack-is-still-starting
/**
 * Whether Docker answers (0.3.7 review ER-4): `GET /_ping` on the socket the stack's refusal named, else the one
 * DOCKER_HOST names, else the current docker context's (0.3.13: Colima publishes no /var/run/docker.sock), else the
 * platform's default. Docker's own engine API, so no `docker` CLI on PATH is needed (an OrbStack-only Mac has its CLI
 * in ~/.orbstack/bin). Bounded: a socket that accepts and never answers is "no".
 */
import { spawn } from 'node:child_process'
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

/**
 * The probe itself runs in a child process, never on the main thread (CO-536): on 2026-11-08 Fabric's main thread sat in
 * a kernel `connect()` on a Docker socket for hours while Colima replaced a stopped engine, and no timer can end a call
 * that has not returned. The child does the `GET /_ping` and says `up` or `down`; it is killed at the hard deadline, and
 * whatever it was stuck in, the main thread only waits for a child's exit.
 */
const PROBE = `const http=require('node:http');const t=JSON.parse(process.argv[1]);const ms=Number(process.argv[2]);
const done=(ok)=>{process.stdout.write(ok?'up':'down');process.exit(0)};
const req=http.request({...t,path:'/_ping',method:'GET',timeout:ms},(res)=>{res.resume();done(res.statusCode===200)});
req.on('timeout',()=>{req.destroy();done(false)});req.on('error',()=>done(false));req.end()`

/** How long past its own deadline the child may take to start and answer before it is killed. */
export const PING_START_MS = 3000

export function pingDocker(socket: string | null, opts: {
  deadlineMs?: number; env?: NodeJS.ProcessEnv; platform?: NodeJS.Platform
  /** Tests: the program the probe runs as, in place of this process's own binary run as Node. */
  probe?: { command: string; args: string[] }
} = {}): Promise<boolean> {
  const target = dockerTarget(socket, opts.env, opts.platform)
  const deadline = opts.deadlineMs ?? DOCKER_PING_MS
  return new Promise((resolve) => {
    let done = false, said = ''
    const finish = (ok: boolean): void => { if (!done) { done = true; clearTimeout(hard); resolve(ok) } }
    let child: ReturnType<typeof spawn>
    try {
      child = spawn(opts.probe?.command ?? process.execPath, opts.probe?.args ?? ['-e', PROBE, JSON.stringify(target), String(deadline)], {
        stdio: ['ignore', 'pipe', 'ignore'],
        env: { ...(process.versions.electron ? { ELECTRON_RUN_AS_NODE: '1' } : {}), PATH: process.env.PATH ?? '' },
        windowsHide: true
      })
    } catch {
      // Not silence: a probe that cannot start is "no answer", and the stack watch tries again on its next read.
      resolve(false); return
    }
    const hard = setTimeout(() => { try { child.kill('SIGKILL') } catch { /* already gone */ } finish(false) }, deadline + PING_START_MS)
    child.stdout?.setEncoding('utf8')
    child.stdout?.on('data', (d: string) => { said += d })
    child.on('error', () => finish(false))
    child.on('close', () => finish(said.trim() === 'up'))
  })
}
// #endregion docker-ping
