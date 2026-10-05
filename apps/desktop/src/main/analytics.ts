// #region usage-analytics — docs: docs/ANALYTICS.md#what-is-sent
/**
 * Anonymous usage counts, the PassionCode way (passioncode-ai/fabric#12; the reference is Fabric Switchboard's
 * docs/ANALYTICS.md): installs, days of use and what is connected — counts and kinds, never names, e-mails,
 * paths, ids or content — sent to the self-hosted Aptabase only by a release build that carries an App Key.
 *
 * - **One installation id for every PassionCode app** on the machine, in a shared file created once by
 *   whichever app starts first: a temporary file hard-linked into place, which fails if another app made it
 *   at the same moment, and that file is then read. A file that does not parse, or whose id is not a UUID
 *   v4, is never repaired: analytics stays off (fail closed). Unknown fields are kept on rewrite.
 * - **One switch:** `"analytics": false` in that file turns analytics off for every PassionCode app; turning
 *   it off here also drops whatever is waiting.
 * - **Delivery never blocks Fabric:** batches of at most 25 to `POST /api/v0/events` (ingestion contract,
 *   ssheleg/sshlg-analytics docs/client-contract.md); transport errors, 429 and 5xx keep the batch and retry
 *   after 60 s, then 10 min; 400 and 404 drop it. At most 200 events wait, in memory only; an event older
 *   than 23 h is dropped (the server refuses a day-old one). Each send is one `analytics.flush` line in the
 *   operations log with its outcome and count.
 */
import { linkSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { randomInt, randomUUID } from 'node:crypto'
import path from 'node:path'

export const ANALYTICS_HOST = 'https://analytics.sshlg.me'
export const SDK_VERSION = 'fabric-analytics@1'
export const BATCH_MAX = 25
export const QUEUE_MAX = 200
export const EVENT_MAX_AGE_MS = 23 * 3600_000
export const RETRY_DELAYS_MS = [60_000, 600_000] as const

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

/** Where every PassionCode app keeps the shared installation file. */
export function installationPath(platform: NodeJS.Platform, env: NodeJS.ProcessEnv, home: string): string {
  if (platform === 'darwin') return path.join(home, 'Library', 'Application Support', 'PassionCode', 'installation.json')
  if (platform === 'win32') return path.join(env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'PassionCode', 'installation.json')
  return path.join(env.XDG_CONFIG_HOME || path.join(home, '.config'), 'PassionCode', 'installation.json')
}

export interface Installation { version: 1; id: string; analytics: boolean; created_at: number; [field: string]: unknown }
export type InstallationRead =
  | { ok: true; installation: Installation; createdNow: boolean }
  | { ok: false; reason: 'unreadable' | 'invalid' }

const parseInstallation = (text: string): Installation | null => {
  let v: unknown
  try { v = JSON.parse(text) } catch { /* not JSON: the caller reads null as invalid and keeps analytics off */ return null }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const o = v as Record<string, unknown>
  if (o.version !== 1 || typeof o.id !== 'string' || !UUID_V4.test(o.id) || typeof o.analytics !== 'boolean') return null
  return o as Installation
}

/** Read the shared file, or create it once. Never overwrites a file another app made; never repairs one. */
export function readOrCreateInstallation(file: string, now: () => Date = () => new Date()): InstallationRead {
  for (let attempt = 0; attempt < 2; attempt++) {
    let text: string | null = null
    try { text = readFileSync(file, 'utf8') } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') return { ok: false, reason: 'unreadable' }
    }
    if (text !== null) {
      const parsed = parseInstallation(text)
      return parsed ? { ok: true, installation: parsed, createdNow: false } : { ok: false, reason: 'invalid' }
    }
    const fresh: Installation = { version: 1, id: randomUUID(), analytics: true, created_at: Math.floor(now().getTime() / 1000) }
    try {
      mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 })
      const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
      writeFileSync(tmp, JSON.stringify(fresh) + '\n', { mode: 0o600 })
      try {
        linkSync(tmp, file)
        return { ok: true, installation: fresh, createdNow: true }
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'EEXIST') return { ok: false, reason: 'unreadable' }
        // Another app created it in the same instant: read theirs on the next pass.
      } finally { rmSync(tmp, { force: true }) }
    } catch { return { ok: false, reason: 'unreadable' } }
  }
  return { ok: false, reason: 'unreadable' }
}

/** Turn the shared switch on or off, keeping every field another app added. Refuses a file it cannot read. */
export function writeAnalyticsSwitch(file: string, enabled: boolean): boolean {
  let current: Installation | null = null
  try { current = parseInstallation(readFileSync(file, 'utf8')) } catch { /* unreadable: the switch is refused below, never written blind */ current = null }
  if (!current) return false
  const tmp = `${file}.${process.pid}.${Date.now()}.switch.tmp`
  try {
    writeFileSync(tmp, JSON.stringify({ ...current, analytics: enabled }) + '\n', { mode: 0o600 })
    renameSync(tmp, file)
    return true
  } catch { /* the caller keeps the availability it had and Settings shows it; nothing half-written stays */ rmSync(tmp, { force: true }); return false }
}

/**
 * Counts and kinds only. A string is sent only when it is one of these known kinds: a free string could carry a
 * project's or a person's name however short it looks, so anything else is dropped.
 */
export type Props = Record<string, number | boolean | string>
export const KNOWN_KINDS: ReadonlySet<string> = new Set([
  'ordinary', 'background',                                  // launch
  'folder', 'scan', 'clone', 'new',                          // how a project came in
  'claude-code', 'codex-cli',                                // coding agents Fabric runs
  'fabric-inbox',                                            // connectable products
  'allowed', 'denied', 'revoked'                             // access decisions
])
export function cleanProps(props: Record<string, unknown>): Props {
  const out: Props = {}
  for (const [k, v] of Object.entries(props)) {
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(k)) continue
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
    else if (typeof v === 'boolean') out[k] = v
    else if (typeof v === 'string' && KNOWN_KINDS.has(v)) out[k] = v
  }
  return out
}

interface QueuedEvent { timestamp: string; sessionId: string; eventName: string; systemProps: Record<string, unknown>; props: Props; at: number }
/**
 * sshlg-growth's contract (its report 2026-10-05-analytics-platform-review, decision 3): it counts
 * installs by `props.iid` and keeps only events whose `props.environment` is `production` or
 * `sandbox`. A release build of a release version is `production`; a development build, or a
 * version with a pre-release suffix (`0.3.2-rc.1`), is `sandbox`. Same rule as Switchboard
 * (fabric-switchboard#75, `has_prerelease`).
 */
export function environmentFor(version: string, packaged: boolean): 'production' | 'sandbox' {
  return packaged && !/^\d+\.\d+\.\d+-/.test(version) ? 'production' : 'sandbox'
}

export interface AnalyticsState { installed_at?: string; last_active_day?: string }
export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{ status: number }>

export interface AnalyticsDeps {
  /** Only a release build has one (injected at build time); without it nothing is ever sent. */
  appKey: string | null
  appVersion: string
  /** Whether this is an installed app rather than a development run (`app.isPackaged`). */
  packaged?: boolean
  osName: string
  osVersion?: string
  installationFile: string
  stateFile: string
  fetch: FetchLike
  host?: string
  now?: () => Date
  setTimer?: (fn: () => void, ms: number) => { unref?: () => void } | unknown
  clearTimer?: (t: unknown) => void
  log?: (line: Record<string, unknown>) => void
}

export type AnalyticsAvailability = 'on' | 'off' | 'unavailable-no-key' | 'unavailable-file'

export function createAnalytics(deps: AnalyticsDeps) {
  const now = deps.now ?? (() => new Date())
  const host = deps.host ?? ANALYTICS_HOST
  const setTimer = deps.setTimer ?? ((fn: () => void, ms: number) => { const t = setTimeout(fn, ms); t.unref(); return t })
  const clearTimer = deps.clearTimer ?? ((t: unknown) => clearTimeout(t as NodeJS.Timeout))
  const log = deps.log ?? (() => {})
  const read = readOrCreateInstallation(deps.installationFile, now)
  let installation = read.ok ? read.installation : null
  const firstPassionCodeApp = read.ok && read.createdNow
  // Numeric session id as the SDKs make it: unix seconds × 10^8 + 8 random digits.
  const sessionId = `${Math.floor(now().getTime() / 1000)}${String(randomInt(0, 100_000_000)).padStart(8, '0')}`
  let queue: QueuedEvent[] = []
  let retry = 0
  let timer: unknown = null
  let flushing = false

  const availability = (): AnalyticsAvailability =>
    !deps.appKey ? 'unavailable-no-key' : !installation ? 'unavailable-file' : installation.analytics ? 'on' : 'off'

  const readState = (): AnalyticsState => {
    try { const v = JSON.parse(readFileSync(deps.stateFile, 'utf8')); return v && typeof v === 'object' ? v : {} } catch { /* no state yet, or unreadable: start fresh; the worst case is a repeated once-only event */ return {} }
  }
  const writeState = (s: AnalyticsState): void => {
    try {
      mkdirSync(path.dirname(deps.stateFile), { recursive: true })
      const tmp = `${deps.stateFile}.${process.pid}.tmp`
      writeFileSync(tmp, JSON.stringify(s) + '\n', { mode: 0o600 })
      renameSync(tmp, deps.stateFile)
    } catch { /* the next start will try again; nothing is lost but a repeat of a once-only event */ }
  }

  const schedule = (ms: number): void => {
    if (timer) return
    timer = setTimer(() => { timer = null; void flush() }, ms)
  }

  const track = (eventName: string, props: Record<string, unknown> = {}): void => {
    if (availability() !== 'on' || !installation) return
    const at = now()
    queue.push({
      timestamp: at.toISOString(), sessionId, eventName, at: at.getTime(),
      systemProps: { isDebug: false, osName: deps.osName, ...(deps.osVersion ? { osVersion: deps.osVersion } : {}), appVersion: deps.appVersion, sdkVersion: SDK_VERSION },
      props: { ...cleanProps(props), install_id: installation.id, iid: installation.id, environment: environmentFor(deps.appVersion, deps.packaged ?? true) }
    })
    if (queue.length > QUEUE_MAX) queue = queue.slice(queue.length - QUEUE_MAX)
    schedule(0)
  }

  async function flush(): Promise<void> {
    if (flushing || !deps.appKey) return
    if (availability() !== 'on') { queue = []; return }
    flushing = true
    try {
      const cutoff = now().getTime() - EVENT_MAX_AGE_MS
      queue = queue.filter((e) => e.at >= cutoff)
      while (queue.length) {
        const batch = queue.slice(0, BATCH_MAX)
        let status = 0
        try {
          const res = await deps.fetch(`${host}/api/v0/events`, {
            method: 'POST',
            headers: { 'App-Key': deps.appKey, 'Content-Type': 'application/json' },
            body: JSON.stringify(batch.map(({ at: _at, ...e }) => e)),
            signal: AbortSignal.timeout(15_000)
          })
          status = res.status
        } catch { /* a transport error: status 0 keeps the batch, and the flush below logs it as kept */ status = 0 }
        if (status >= 200 && status < 300) {
          queue = queue.slice(batch.length); retry = 0
          log({ event: 'analytics.flush', outcome: 'sent', count: batch.length })
          continue
        }
        if (status === 0 || status === 429 || status >= 500) {
          const delay = RETRY_DELAYS_MS[Math.min(retry, RETRY_DELAYS_MS.length - 1)]
          retry++
          log({ event: 'analytics.flush', outcome: 'kept', status, count: batch.length, retry_in_ms: delay })
          schedule(delay)
          return
        }
        queue = queue.slice(batch.length)
        log({ event: 'analytics.flush', outcome: 'dropped', status, count: batch.length })
      }
    } finally { flushing = false }
  }

  return {
    availability,
    installId: (): string | null => installation?.id ?? null,
    track,
    flush,
    /** First start and every start; `counts` are the app's own numbers for the `app_installed` event. */
    started(launch: 'ordinary' | 'background', counts: Record<string, number>): void {
      if (availability() !== 'on') return
      const state = readState()
      if (!state.installed_at) {
        track('app_installed', { ...counts, first_passioncode_app: firstPassionCodeApp })
        writeState({ ...state, installed_at: now().toISOString() })
      }
      track('app_started', { launch })
    },
    /** Called on a timer: one `app_active` per UTC day while Fabric runs, window open or not. */
    activeTick(counts: Record<string, number>): void {
      if (availability() !== 'on') return
      const day = now().toISOString().slice(0, 10)
      const state = readState()
      if (state.last_active_day === day) return
      track('app_active', counts)
      writeState({ ...state, last_active_day: day })
    },
    /** The shared switch. Off drops whatever is waiting; on takes effect for the next event. */
    setEnabled(enabled: boolean): AnalyticsAvailability {
      if (!installation) return availability()
      if (!writeAnalyticsSwitch(deps.installationFile, enabled)) return availability()
      installation = { ...installation, analytics: enabled }
      if (!enabled) queue = []
      return availability()
    },
    /** Re-read the shared file: another PassionCode app may have turned the switch. */
    refresh(): AnalyticsAvailability {
      // Read only: a file someone removed is not recreated (and so switched back on) behind their back.
      let text: string | null = null
      try { text = readFileSync(deps.installationFile, 'utf8') } catch { /* gone or unreadable: analytics turns off, which Settings shows */ text = null }
      installation = text === null ? null : parseInstallation(text)
      if (availability() !== 'on') queue = []
      return availability()
    },
    stop(): void { if (timer) { clearTimer(timer); timer = null } },
    pending: (): number => queue.length
  }
}
export type Analytics = ReturnType<typeof createAnalytics>
// #endregion usage-analytics
