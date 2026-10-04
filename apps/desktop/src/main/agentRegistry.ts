// #region agent-registry — docs: docs/adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md#1-one-door-a-second-way-in
// The registry READER (ADR-0115 S1, AR-2.2): the agents registered on this machine, read from
// the two directories the Fabric Agent Contract names — `services/` (fabric-service/0.1
// descriptors) and `providers/` (fabric-provider/0.1 entries) — into one in-memory registry keyed
// `id[.instance]`.
//
// WHY FABRIC READS THESE ITSELF rather than importing `@passioncode-ai/fabric-service-host`: that
// package is private to the Fabric Dashboards workspace and unpublished, so this repository cannot
// pin it with a frozen lockfile. This reader follows the CONTRACT's schemas
// (`service-descriptor.schema.json`, `provider.schema.json`, FAC-SEM-010/013), which stay
// normative for both readers; the Dashboards reader is the reference for the descriptor rules.
//
// WHAT THE REGISTRY IS FOR HERE. A consent prompt names an agent by what the registry says about
// it — its name, who installed it, where it came from — and an `agentId` the registry does not
// resolve is refused before any prompt. So the reader is strict where identity is concerned
// (unknown fields, a file whose name disagrees with its id, an id claimed twice all make an entry
// unresolvable) and tolerant everywhere else: a malformed file is a problem with its reason,
// never a throw, and never hides the files beside it.
//
// WHAT IT DOES NOT DO. It probes nothing: a service's MCP path lives in its well-known document,
// which needs the service running; the reader records `mcp: null` for a service rather than
// guessing `/mcp`. It does not open a provider's manifest (FAC-SEM-014 is the installer's and the
// conformance probe's check). Same-user files prove what was INSTALLED, not which process speaks
// — the prompt says so (ADR-0115 §2, the same-user floor).

import { closeSync, constants as fsc, fstatSync, lstatSync, openSync, readSync, readdirSync, statSync, watch, type FSWatcher } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { oneLine } from '../shared/access.ts'
import { ops } from './opsSink.ts'

export const SERVICE_PROTOCOL = 'fabric-service/0.1'
export const PROVIDER_PROTOCOL = 'fabric-provider/0.1'

const ID = /^[a-z][a-z0-9-]{1,62}$/
const INSTANCE = /^[a-z][a-z0-9-]{0,31}$/
/** `agentId` in `agent.call` and `fabric.access.request`: a provider id, or a service id with an optional instance. */
export const AGENT_ID = /^[a-z][a-z0-9-]{1,62}(\.[a-z][a-z0-9-]{0,31})?$/
const LOCAL_ORIGIN = /^http:\/\/127\.0\.0\.1:([1-9][0-9]{2,3}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5])$/
const REMOTE_ORIGIN = /^https:\/\/([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}(:([1-9][0-9]{0,3}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5]))?$/
const PROVIDER_URL = /^http:\/\/127\.0\.0\.1:([1-9][0-9]{2,3}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5])\/mcp$/
const LABEL = /^[A-Za-z0-9][A-Za-z0-9._-]{2,254}$/
const HEADER = /^[A-Za-z][A-Za-z0-9-]{0,63}$/
const LOCAL_PATH = /^(~\/|\/)[^\0]*$/
const SECRET_REF = /^secret-ref:[A-Za-z0-9][A-Za-z0-9._/:@-]{0,255}$/
const ENV_NAME = /^[A-Z_][A-Z0-9_]*$/
/** A descriptor is a few hundred bytes; anything this large is not one, and is not read. */
const MAX_FILE_BYTES = 64 * 1024

const SERVICE_FIELDS = new Set(['protocol', 'id', 'instance', 'name', 'summary', 'placement', 'origin', 'auth', 'lifecycle', 'paths', 'commands', 'source', 'fabricManifest', 'installedAt', 'installedBy', 'extensions'])
const PROVIDER_FIELDS = new Set(['protocol', 'id', 'providerId', 'name', 'summary', 'manifest', 'run', 'source', 'installedAt', 'installedBy', 'extensions'])

export type RegistryMcp =
  | { transport: 'streamable-http'; url: string; path: string }
  | { transport: 'stdio' }

export interface RegistryEntry {
  /** `id` for a provider, `id.instance` for a service. */
  key: string
  kind: 'service' | 'provider'
  id: string
  instance: string | null
  name: string
  summary: string | null
  placement: 'local' | 'remote'
  /** A service's origin; null for a provider (it names its MCP endpoint instead). */
  origin: string | null
  /** A provider's MCP endpoint as its entry declares it; null for a service (well-known, not read here). */
  mcp: RegistryMcp | null
  installedBy: string
  installedAt: string
  repository: string | null
  file: string
}

/** The contract's own problem codes (agent-registry contracts §C5), plus `unreadable` for a file that is not JSON. */
export type RegistryProblemCode = 'unreadable' | 'manifest-invalid' | 'foreign' | 'id-collision' | 'port-claimed'

export interface RegistryProblem {
  file: string
  key: string | null
  code: RegistryProblemCode
  reason: string
}

export interface RegistrySnapshot {
  entries: RegistryEntry[]
  problems: RegistryProblem[]
  readAt: string
}

export type Resolution = { ok: true; entry: RegistryEntry } | { ok: false; reason: string }

const isStr = (v: unknown): v is string => typeof v === 'string'
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isTimestamp = (v: unknown): boolean => isStr(v) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(v) && !Number.isNaN(Date.parse(v))
const isUri = (v: unknown): boolean => {
  if (!isStr(v) || !v) return false
  try {
    return Boolean(new URL(v).protocol)
  } catch {
    // Not a URL is the answer, not a failure to report: the caller turns it into a problem sentence.
    return false
  }
}

function expand(p: string, home: string): string {
  return p.startsWith('~/') ? path.join(home, p.slice(2)) : p
}

/** Where the contract says the two directories are: the env overrides, else the platform's root. */
export function registryDirs(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  home: string = os.homedir()
): { root: string; services: string; providers: string } {
  const root =
    platform === 'darwin'
      ? path.join(home, 'Library/Application Support/ai.passioncode.fabric')
      : path.join(env.XDG_DATA_HOME || path.join(home, '.local/share'), 'passioncode-fabric')
  return {
    root,
    services: env.FABRIC_SERVICES_DIR ? expand(env.FABRIC_SERVICES_DIR, home) : path.join(root, 'services'),
    providers: env.FABRIC_PROVIDERS_DIR ? expand(env.FABRIC_PROVIDERS_DIR, home) : path.join(root, 'providers')
  }
}

/**
 * A descriptor's words as an entry carries them: one line, no control, line-break or bidirectional
 * character. These fields reach the operator's consent prompt (ADR-0115 §2), where a line break or an
 * override could pass for Fabric's own words (security review of PR #7, finding 3). The file is left as
 * it is; only what Fabric shows is cleaned. An entry whose name cleans to nothing keeps its id instead.
 */
function shown(text: string, max: number): string {
  return oneLine(text, max)
}

function unknownFields(d: Record<string, unknown>, allowed: Set<string>): string[] {
  return Object.keys(d).filter((k) => !allowed.has(k)).map((k) => `unknown field ${k}`)
}

function commonProblems(d: Record<string, unknown>): string[] {
  const problems: string[] = []
  if (!isStr(d.name) || !d.name || d.name.length > 80) problems.push('name must be 1 to 80 characters')
  if (d.summary !== undefined && (!isStr(d.summary) || d.summary.length > 200)) problems.push('summary must be at most 200 characters')
  if (!isTimestamp(d.installedAt)) problems.push('installedAt must be an RFC 3339 timestamp')
  if (!isStr(d.installedBy) || !d.installedBy || d.installedBy.length > 200) problems.push('installedBy must be 1 to 200 characters')
  if (d.source !== undefined) {
    if (!isObj(d.source) || Object.keys(d.source).some((k) => k !== 'repository')) problems.push('source may carry only repository')
    else if (d.source.repository !== undefined && !isUri(d.source.repository)) problems.push('source.repository must be a URI')
  }
  if (d.extensions !== undefined && (!isObj(d.extensions) || !Object.keys(d.extensions).every(isUri)))
    problems.push('extensions must be an object keyed by absolute URIs')
  return problems
}

/** Every problem as one sentence; an empty list means the descriptor is usable (service-descriptor.schema.json). */
export function validateServiceDescriptor(raw: unknown): string[] {
  if (!isObj(raw)) return ['the file is not a JSON object']
  const d = raw
  const remote = d.placement === 'remote'
  const required = ['protocol', 'id', 'instance', 'name', 'origin', 'auth', 'lifecycle', 'installedAt', 'installedBy', ...(remote ? [] : ['paths'])]
  const missing = required.filter((k) => !(k in d)).map((k) => `missing ${k}`)
  if (missing.length) return missing
  const problems = unknownFields(d, SERVICE_FIELDS)
  if (d.protocol !== SERVICE_PROTOCOL) problems.push(`protocol must be ${SERVICE_PROTOCOL}, not ${JSON.stringify(d.protocol)}`)
  if (!isStr(d.id) || !ID.test(d.id)) problems.push('id must be lowercase letters, digits and dashes')
  if (!isStr(d.instance) || !INSTANCE.test(d.instance)) problems.push('instance must be lowercase letters, digits and dashes')
  if (d.placement !== undefined && d.placement !== 'local' && d.placement !== 'remote') problems.push('placement must be local or remote')
  if (!isStr(d.origin) || !(remote ? REMOTE_ORIGIN : LOCAL_ORIGIN).test(d.origin))
    problems.push(remote ? 'a remote origin must be https://<dns-name>[:<port>]' : 'origin must be http://127.0.0.1:<port>')
  const auth = d.auth
  if (!isObj(auth) || !isStr(auth.tokenFile) || !LOCAL_PATH.test(auth.tokenFile)) problems.push('auth.tokenFile must be an absolute or ~/ path')
  else {
    const header = auth.header ?? 'Authorization'
    const scheme = auth.scheme ?? 'Bearer'
    if (!isStr(header) || !HEADER.test(header)) problems.push('auth.header is not a valid header name')
    if (scheme !== 'Bearer' && scheme !== 'none') problems.push('auth.scheme must be Bearer or none')
    if (header !== 'Authorization' && scheme !== 'none') problems.push('a custom auth header carries the raw token: auth.scheme must be none')
  }
  const life = d.lifecycle
  if (!isObj(life) || (life.manager !== 'launchd' && life.manager !== 'none')) problems.push('lifecycle.manager must be launchd or none')
  else if (remote && life.manager !== 'none') problems.push('a remote service is supervised by its platform: lifecycle.manager must be none')
  else if (life.manager === 'launchd') {
    if (!isStr(life.label) || !LABEL.test(life.label)) problems.push('a launchd service declares lifecycle.label')
    if (!isStr(life.plist) || !LOCAL_PATH.test(life.plist) || !life.plist.endsWith('.plist')) problems.push('a launchd service declares lifecycle.plist')
  }
  if (d.paths !== undefined) {
    const paths = d.paths
    if (!isObj(paths) || !isStr(paths.data) || !LOCAL_PATH.test(paths.data)) problems.push('paths.data must be an absolute or ~/ path')
    else if (!Array.isArray(paths.logs) || !paths.logs.every((p) => isStr(p) && LOCAL_PATH.test(p))) problems.push('paths.logs must list absolute or ~/ paths')
  }
  if (d.commands !== undefined) {
    if (!isObj(d.commands)) problems.push('commands must be an object')
    else
      for (const [name, argv] of Object.entries(d.commands)) {
        if (name !== 'doctor' && name !== 'update') problems.push(`unknown command ${name}`)
        else if (remote && name === 'update') problems.push('a remote service is updated by its platform: no update command')
        else if (!Array.isArray(argv) || !argv.length || !argv.every(isStr)) problems.push(`command ${name} must be an argument array, not a shell string`)
      }
  }
  if (d.fabricManifest !== undefined && (!isStr(d.fabricManifest) || !LOCAL_PATH.test(d.fabricManifest))) problems.push('fabricManifest must be an absolute or ~/ path')
  problems.push(...commonProblems(d))
  return problems
}

/** Every problem as one sentence; an empty list means the entry is usable (provider.schema.json, FAC-SEM-015). */
export function validateProviderEntry(raw: unknown): string[] {
  if (!isObj(raw)) return ['the file is not a JSON object']
  const d = raw
  const missing = ['protocol', 'id', 'providerId', 'name', 'manifest', 'run', 'installedAt', 'installedBy'].filter((k) => !(k in d)).map((k) => `missing ${k}`)
  if (missing.length) return missing
  const problems = unknownFields(d, PROVIDER_FIELDS)
  if (d.protocol !== PROVIDER_PROTOCOL) problems.push(`protocol must be ${PROVIDER_PROTOCOL}, not ${JSON.stringify(d.protocol)}`)
  if (!isStr(d.id) || !ID.test(d.id)) problems.push('id must be lowercase letters, digits and dashes')
  if (!isUri(d.providerId)) problems.push('providerId must be a URI')
  if (!isStr(d.manifest) || !LOCAL_PATH.test(d.manifest) || !/(^|\/)fabric-agent\.json$/.test(d.manifest)) problems.push('manifest must be an absolute or ~/ path to fabric-agent.json')
  const mcp = isObj(d.run) ? d.run.mcp : undefined
  if (!isObj(d.run) || Object.keys(d.run).some((k) => k !== 'mcp') || !isObj(mcp)) problems.push('run must be {mcp: {stdio} or {url}}')
  else if ('url' in mcp) {
    if (Object.keys(mcp).length !== 1 || !isStr(mcp.url) || !PROVIDER_URL.test(mcp.url)) problems.push('run.mcp.url must be http://127.0.0.1:<port>/mcp')
  } else if ('stdio' in mcp && Object.keys(mcp).length === 1 && isObj(mcp.stdio)) {
    const stdio = mcp.stdio
    if (Object.keys(stdio).some((k) => k !== 'command' && k !== 'env')) problems.push('run.mcp.stdio may carry only command and env')
    if (!Array.isArray(stdio.command) || !stdio.command.length || stdio.command.length > 32 || !stdio.command.every((a) => isStr(a) && a.length > 0 && a.length <= 1024))
      problems.push('run.mcp.stdio.command must be an argument array, not a shell string')
    if (stdio.env !== undefined) {
      if (!isObj(stdio.env)) problems.push('run.mcp.stdio.env must be an object')
      else
        for (const [name, value] of Object.entries(stdio.env)) {
          if (!ENV_NAME.test(name)) problems.push(`run.mcp.stdio.env name ${name} is not an environment variable name`)
          // FAC-SEM-015 checks the value by its FORM, never by its content, and the content is
          // never repeated into the problem: a literal here may be the very secret it must not be.
          if (!isStr(value) || !SECRET_REF.test(value)) problems.push(`run.mcp.stdio.env ${name} must be a secret reference (secret-ref:NAME), not a value`)
        }
    }
  } else problems.push('run.mcp must be {stdio: {command}} or {url}')
  problems.push(...commonProblems(d))
  return problems
}

/**
 * Read a registry file only when it is a REGULAR file of at most MAX_FILE_BYTES (ER-1, verification
 * iteration 1 for 0.3.1). `statSync` + `readFileSync` let a FIFO or a link to `/dev/zero` through
 * (size 0) and then blocked the main process for ever. A link is followed only to a regular file; the
 * file is opened non-blocking (a FIFO swapped in after the check opens without waiting for a writer),
 * the OPEN descriptor is checked again, and at most MAX_FILE_BYTES + 1 bytes are read from it.
 */
function readRegularFile(file: string): { ok: true; value: string } | { ok: false; reason: string } {
  const link = lstatSync(file)
  if (link.isSymbolicLink() ? !statSync(file).isFile() : !link.isFile()) return { ok: false, reason: 'not a regular file' }
  const fd = openSync(file, fsc.O_RDONLY | fsc.O_NONBLOCK | (fsc.O_NOCTTY ?? 0))
  try {
    const st = fstatSync(fd)
    if (!st.isFile()) return { ok: false, reason: 'not a regular file' }
    if (st.size > MAX_FILE_BYTES) return { ok: false, reason: 'too-large' }
    const buf = Buffer.alloc(MAX_FILE_BYTES + 1)
    let got = 0
    for (;;) {
      const n = readSync(fd, buf, got, buf.length - got, null)
      if (n === 0) break
      got += n
      if (got > MAX_FILE_BYTES) return { ok: false, reason: 'too-large' }
    }
    return { ok: true, value: buf.subarray(0, got).toString('utf8') }
  } finally {
    closeSync(fd)
  }
}

interface Candidate {
  entry: RegistryEntry
  port: number | null
}

function readDir(
  dir: string,
  kind: 'service' | 'provider',
  problems: RegistryProblem[]
): Candidate[] {
  let names: string[]
  try {
    names = readdirSync(dir).filter((n) => n.endsWith('.json') && !n.startsWith('.')).sort()
  } catch (e) {
    // An absent directory is an empty registry — nothing is installed. Anything else the
    // directory refuses is a problem with its reason, because "nothing is registered" and
    // "the registry could not be read" must never look alike.
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []
    problems.push({ file: dir, key: null, code: 'unreadable', reason: `the ${kind === 'service' ? 'services' : 'providers'} directory cannot be read: ${(e as Error).message}` })
    return []
  }
  const out: Candidate[] = []
  for (const name of names) {
    const file = path.join(dir, name)
    const stem = name.slice(0, -'.json'.length)
    let raw: unknown
    try {
      const text = readRegularFile(file)
      if (!text.ok) {
        problems.push({ file, key: stem, code: 'unreadable', reason: text.reason === 'too-large' ? `the file is larger than ${MAX_FILE_BYTES} bytes and is not a ${kind} entry` : `${text.reason}; it is not a ${kind} entry` })
        continue
      }
      raw = JSON.parse(text.value)
    } catch (e) {
      // Not silence: the problem list IS the report, logged by `refresh` when it changes.
      problems.push({ file, key: stem, code: 'unreadable', reason: `the file cannot be read as JSON: ${(e as Error).message}` })
      continue
    }
    const reasons = kind === 'service' ? validateServiceDescriptor(raw) : validateProviderEntry(raw)
    const d = raw as Record<string, unknown>
    const key = kind === 'service'
      ? isStr(d?.id) && isStr(d?.instance) ? `${d.id}.${d.instance}` : stem
      : isStr(d?.id) ? d.id : stem
    if (!reasons.length && key !== stem) reasons.push(`the file is named ${name} but describes ${key}`)
    if (reasons.length) {
      const foreign = isObj(raw) && raw.protocol !== (kind === 'service' ? SERVICE_PROTOCOL : PROVIDER_PROTOCOL)
      problems.push({ file, key, code: foreign ? 'foreign' : 'manifest-invalid', reason: reasons.join('; ') })
      continue
    }
    const source = isObj(d.source) && isStr(d.source.repository) ? shown(d.source.repository, 300) || null : null
    if (kind === 'service') {
      const placement = d.placement === 'remote' ? 'remote' : 'local'
      const m = LOCAL_ORIGIN.exec(d.origin as string)
      out.push({
        entry: {
          key, kind, id: d.id as string, instance: d.instance as string, name: shown(d.name as string, 80) || (d.id as string),
          summary: d.summary === undefined ? null : shown(d.summary as string, 200), placement, origin: d.origin as string, mcp: null,
          installedBy: shown(d.installedBy as string, 200), installedAt: d.installedAt as string, repository: source, file
        },
        port: placement === 'local' && m ? Number(m[1]) : null
      })
    } else {
      const run = (d.run as { mcp: { url?: string } }).mcp
      const url = run.url ?? null
      out.push({
        entry: {
          key, kind, id: d.id as string, instance: null, name: shown(d.name as string, 80) || (d.id as string),
          summary: d.summary === undefined ? null : shown(d.summary as string, 200), placement: 'local', origin: null,
          mcp: url ? { transport: 'streamable-http', url, path: '/mcp' } : { transport: 'stdio' },
          installedBy: shown(d.installedBy as string, 200), installedAt: d.installedAt as string, repository: source, file
        },
        port: url ? Number(PROVIDER_URL.exec(url)?.[1]) : null
      })
    }
  }
  return out
}

/**
 * Read both directories once. Never throws: every file that cannot be an entry becomes a
 * problem with its reason, and the rest are entries. FAC-SEM-013 (an id in both directories)
 * makes BOTH unresolvable — guessing which one a prompt should name is the one thing this
 * must not do. FAC-SEM-010 (two entries on one port) keeps both listed and reports the port.
 */
export function readRegistry(dirs: { servicesDir: string; providersDir: string }, now: () => Date = () => new Date()): RegistrySnapshot {
  const problems: RegistryProblem[] = []
  const services = readDir(dirs.servicesDir, 'service', problems)
  const providers = readDir(dirs.providersDir, 'provider', problems)

  const serviceIds = new Set(services.map((c) => c.entry.id))
  const providerIds = new Set(providers.map((c) => c.entry.id))
  const collided = new Set([...serviceIds].filter((id) => providerIds.has(id)))
  const kept: Candidate[] = []
  for (const c of [...services, ...providers]) {
    if (collided.has(c.entry.id)) {
      problems.push({ file: c.entry.file, key: c.entry.key, code: 'id-collision', reason: `the id ${c.entry.id} is claimed by both services/ and providers/ (FAC-SEM-013); neither is resolvable until one is removed` })
      continue
    }
    kept.push(c)
  }

  const byPort = new Map<number, Candidate[]>()
  for (const c of kept) if (c.port !== null) byPort.set(c.port, [...(byPort.get(c.port) ?? []), c])
  for (const [port, claimants] of byPort)
    if (claimants.length > 1)
      for (const c of claimants)
        problems.push({ file: c.entry.file, key: c.entry.key, code: 'port-claimed', reason: `port ${port} is also claimed by ${claimants.filter((o) => o !== c).map((o) => o.entry.key).join(', ')} (FAC-SEM-010)` })

  return {
    entries: kept.map((c) => c.entry).sort((a, b) => a.key.localeCompare(b.key)),
    problems,
    readAt: now().toISOString()
  }
}

/** The live registry: read on demand, optionally watched, resolved by `agentId`. */
export class AgentRegistry {
  private dirs: { servicesDir: string; providersDir: string }
  private debounceMs: number
  private pollMs: number
  private current: RegistrySnapshot = { entries: [], problems: [], readAt: new Date(0).toISOString() }
  private lastProblemDigest = ''

  // Assigned in the body: Node's type-stripping loader rejects parameter properties.
  constructor(opts: { servicesDir: string; providersDir: string; debounceMs?: number; pollMs?: number }) {
    this.dirs = { servicesDir: opts.servicesDir, providersDir: opts.providersDir }
    this.debounceMs = opts.debounceMs ?? 250
    this.pollMs = opts.pollMs ?? 30_000
  }

  /** Read the disk now. Cheap (a few small files), so the consent path calls it before resolving. */
  refresh(): RegistrySnapshot {
    const snap = readRegistry(this.dirs)
    this.current = snap
    // Problems are logged when they CHANGE, not on every read: a malformed file read on every
    // request would bury the log in one line, and the line that matters is the first one.
    const digest = JSON.stringify(snap.problems.map((p) => [p.file, p.code, p.reason]))
    if (digest !== this.lastProblemDigest) {
      this.lastProblemDigest = digest
      ops.record({
        op: 'registry.read',
        outcome: 'ok',
        level: snap.problems.length ? 'warn' : 'info',
        detail: {
          entries: snap.entries.length,
          problems: snap.problems.map((p) => ({ file: path.basename(p.file), key: p.key, code: p.code, reason: p.reason }))
        },
        ctx: { correlationId: ops.correlate() }
      })
    }
    return snap
  }

  snapshot(): RegistrySnapshot {
    return this.current
  }

  /**
   * Which entry an `agentId` names, or why none does. A bare service id means its `default`
   * instance and nothing else — "whichever instance there happens to be" would let a second
   * install change who a standing grant speaks for.
   */
  resolve(agentId: string): Resolution {
    if (!AGENT_ID.test(agentId)) return { ok: false, reason: `${JSON.stringify(agentId)} is not a registry id (a provider id, or a service id with an optional .instance)` }
    const collision = this.current.problems.find((p) => p.code === 'id-collision' && p.key !== null && (p.key === agentId || p.key.split('.')[0] === agentId.split('.')[0]))
    if (collision) return { ok: false, reason: `${agentId} is claimed by both services/ and providers/ on this machine, so it names no single agent` }
    const exact = this.current.entries.find((e) => e.key === agentId)
    if (exact) return { ok: true, entry: exact }
    if (!agentId.includes('.')) {
      const dflt = this.current.entries.find((e) => e.kind === 'service' && e.key === `${agentId}.default`)
      if (dflt) return { ok: true, entry: dflt }
    }
    return { ok: false, reason: `${agentId} is not registered on this machine (no services/ descriptor or providers/ entry names it)` }
  }

  /** Every loopback port a registered entry claims — the hub refuses to listen on one of them. */
  claimedPorts(): Map<number, string> {
    const out = new Map<number, string>()
    for (const e of this.current.entries) {
      const url = e.origin ?? (e.mcp?.transport === 'streamable-http' ? e.mcp.url : null)
      const m = url ? /^http:\/\/127\.0\.0\.1:(\d+)/.exec(url) : null
      if (m) out.set(Number(m[1]), e.key)
    }
    return out
  }

  /**
   * Re-read on change. A directory that does not exist yet is not watched (fs.watch needs it);
   * the on-demand refresh before every resolve covers it. fs.watch on macOS is FSEvents, which can
   * deliver late or drop an event under load (measured: no event within 15 s on a loaded Mac), so a
   * slow poll (`pollMs`, 30 s) backs it up. Returns the function that stops both.
   */
  watch(onChange?: (snap: RegistrySnapshot) => void): () => void {
    const watchers: FSWatcher[] = []
    let timer: ReturnType<typeof setTimeout> | null = null
    const fire = (): void => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        // Refreshed whether or not anyone listens: `onChange?.(this.refresh())` would skip the
        // refresh itself when there is no listener, and the app watches without one.
        const snap = this.refresh()
        onChange?.(snap)
      }, this.debounceMs)
    }
    for (const dir of [this.dirs.servicesDir, this.dirs.providersDir]) {
      try {
        const w = watch(dir, { persistent: false }, fire)
        w.on('error', (e) => ops.failed('registry.watch', e, { dir }))
        watchers.push(w)
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') ops.failed('registry.watch', e, { dir })
        // ENOENT: nothing is installed there yet; the on-demand refresh reads it when it appears.
      }
    }
    const poll = setInterval(() => {
      const snap = this.refresh()
      onChange?.(snap)
    }, this.pollMs)
    poll.unref()
    return () => {
      if (timer) clearTimeout(timer)
      clearInterval(poll)
      for (const w of watchers) w.close()
    }
  }
}
// #endregion agent-registry
