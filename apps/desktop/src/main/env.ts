// Supabase connection material for the v1 control plane (ADR-0031 §2: the
// service key exists ONLY in the main process). Explicit env wins; in dev the
// local stack's own `supabase status -o env` is the source, never a hardcoded key.

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)
import { existsSync } from 'node:fs'
import path from 'node:path'
import { chooseRepoRoot } from './repoRoot'
import { materializeStack } from './bundledStack'
import { app } from 'electron'

export interface SupabaseEnv {
  url: string
  serviceKey: string
}

// A .app launched from the Dock inherits a minimal PATH without Homebrew —
// `supabase` and `claude` both live there. Appended once at startup.
export function fixPath(): void {
  const extra = ['/opt/homebrew/bin', '/usr/local/bin', `${process.env.HOME}/.local/bin`]
  const parts = (process.env.PATH ?? '').split(':')
  for (const p of extra) if (!parts.includes(p)) parts.push(p)
  process.env.PATH = parts.join(':')
}

let bundledRoot: string | null | undefined
/** The shipped stack project, materialized once per launch into the app's data folder. */
function bundledStackRoot(): string | null {
  if (bundledRoot !== undefined) return bundledRoot
  bundledRoot = app.isPackaged
    ? materializeStack({ source: path.join(process.resourcesPath, 'stack'), target: path.join(app.getPath('userData'), 'stack') })?.root ?? null
    : null
  return bundledRoot
}

export function repoRoot(): string {
  return chooseRepoRoot({
    bundled: bundledStackRoot(),
    fromEnv: process.env.FABRIC_REPO,
    packaged: app.isPackaged,
    appPath: app.getAppPath(),
    home: app.getPath('home'),
    exists: existsSync
  })
}

/**
 * ASYNCHRONOUS, and that is the point (M101). Every one of these ran on the
 * main thread, which is Electron's browser-process message loop: for as long as
 * one blocked, nothing was pumped — no window painted, no menu responded, no
 * event was delivered. Thirty seconds of that is bad; the four minutes
 * `startStack` allowed itself is a person watching a rectangle.
 */
export async function stackStatusEnv(): Promise<Record<string, string>> {
  const { stdout: out } = await run('supabase', ['status', '-o', 'env'], {
    cwd: repoRoot(),
    encoding: 'utf8',
    timeout: 30_000
  })
  const vars: Record<string, string> = {}
  for (const line of out.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)="?([^"]*)"?\s*$/)
    if (m) vars[m[1]] = m[2]
  }
  return vars
}

/**
 * Starts the stack without stopping the app.
 *
 * `onLine` receives the stack's own output as it arrives, so the splash can say
 * what is happening instead of holding one sentence for four minutes. It is
 * optional: nothing here depends on being watched.
 */
export async function startStack(onLine?: (line: string) => void): Promise<void> {
  const child = run('supabase', ['start'], {
    cwd: repoRoot(),
    encoding: 'utf8',
    timeout: 240_000,
    // A first-ever start pulls container images and prints a great deal.
    // `execFile` KILLS the child when its buffer overflows, so the default
    // 1 MB would have turned a slow-but-working start into a failure — and
    // reported it as a timeout, because a killed child looks like one. Not a
    // regression this change introduces; it was there before and is fixed
    // here because the streaming above is what made it legible.
    maxBuffer: 16_000_000
  })
  if (onLine) {
    const feed = (chunk: string): void => {
      for (const line of chunk.split('\n')) if (line.trim()) onLine(line.trim())
    }
    // Both streams: `supabase start` reports progress on stderr, and a reader
    // that watched only stdout would show nothing for the whole download.
    child.child.stdout?.on('data', (c: Buffer | string) => feed(String(c)))
    child.child.stderr?.on('data', (c: Buffer | string) => feed(String(c)))
  }
  await child
}

export async function resolveSupabaseEnv(): Promise<SupabaseEnv> {
  const envUrl = process.env.SUPABASE_URL
  const envKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (envUrl && envKey) return { url: envUrl, serviceKey: envKey }

  const vars = await stackStatusEnv()
  const url = vars.API_URL ?? vars.SUPABASE_URL
  const serviceKey = vars.SERVICE_ROLE_KEY ?? vars.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error(
      `supabase status did not yield API_URL/SERVICE_ROLE_KEY (got: ${Object.keys(vars).join(', ')})`
    )
  }
  return { url, serviceKey }
}
