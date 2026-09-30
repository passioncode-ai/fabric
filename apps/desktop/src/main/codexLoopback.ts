/**
 * Codex over the owned loopback backend (first-slice plan B2b-3, ADR-0081).
 *
 * Four pieces, each small and separately tested:
 *
 * - `codexLoopbackRecipe` — the privileged registry recipe: `codex app-server` under a macOS sandbox
 *   that may bind and accept on localhost only and may write only inside its own private root, with
 *   the Codex binary's SHA-256 pinned and its shell snapshot off, so its process group can quiesce.
 *   Its listener pattern is the one line the registry reads.
 * - `mintLoopbackToken` — a per-backend bearer token. Only its SHA-256 reaches the process (as a
 *   per-launch argument); the token itself stays in trusted main.
 * - `startCodexThread` — `initialize` (the owned profile must answer), `initialized`, then
 *   `thread/start`, each under the caller's fence. No turn and no model call.
 * - `bindCodexLoopbackTurn` — the `owned-loopback` binding for one turn of that thread, validated by
 *   `validateProviderBinding`; a foreign thread or a missing turn refuses. The turn's evidence is the
 *   `{ threadId, turn: { id } }` scope the event normalizer already reads; a real turn is N1.
 *
 * A thread id is a provider reference, not proof that anything ran.
 */
import { createHash, randomBytes } from 'node:crypto'
import { chmodSync, lstatSync, mkdirSync, readFileSync, realpathSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { validateProviderBinding, type ProviderExecutionBinding, type Validation } from '../shared/providerExecution.ts'
import type { LoopbackClient } from './loopbackWsClient.ts'
import type { BackendLaunchArgs, BackendProcessRecipe } from './ownedBackendProcessRegistry.ts'

export const CODEX_LOOPBACK_LISTENER = /^\s*listening on:\s*ws:\/\/127\.0\.0\.1:(\d+)\s*$/
const SANDBOX_EXEC = '/usr/bin/sandbox-exec'
export const CODEX_PROFILE_CONFIG = '[features]\nshell_snapshot = false\n'
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const sha256 = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex')
const fail = (reasonCode: string): { ok: false; reasonCode: string } => ({ ok: false, reasonCode })

function privateDir(dir: string) {
  try { mkdirSync(dir, { mode: 0o700 }) } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e }
  const s = lstatSync(dir)
  if (!s.isDirectory() || s.isSymbolicLink() || (s.mode & 0o077) !== 0 || (process.getuid && s.uid !== process.getuid())) throw Error('codex_loopback_root_not_private')
}

export interface CodexLoopbackRecipeInput {
  binary: string
  binarySha256: string
  /** A private directory owned by this user; the backend may write nowhere else. */
  root: string
  /** PATH for the backend's own tool lookups. */
  path: string
  /** Operator configuration the backend must never read; defaults to the provider homes under $HOME. */
  denyRead?: string[]
  /** A model turn (N1): the provider's existing login file, shared by a link in the owned profile —
   * never copied, since refresh-token rotation would log out one copy — plus outbound TCP to 443.
   * Without it the backend can bind and accept on localhost and reach nothing. */
  modelAccess?: { authFile: string }
}
export function codexLoopbackRecipe(input: CodexLoopbackRecipeInput): { recipe: BackendProcessRecipe; listener: { pattern: RegExp }; codexHome: string } {
  if (!path.isAbsolute(input.binary) || !/^[a-f0-9]{64}$/.test(input.binarySha256) || !path.isAbsolute(input.root) || typeof input.path !== 'string' || /[\x00-\x1f]/.test(input.path))
    throw Error('invalid_codex_loopback_recipe')
  const binary = realpathSync(input.binary), s = statSync(binary)
  if (!s.isFile() || (s.mode & 0o022) !== 0 || sha256(binary) !== input.binarySha256) throw Error('codex_binary_not_pinned')
  privateDir(input.root)
  const root = realpathSync(input.root), codexHome = path.join(root, 'profile'), tmp = path.join(root, 'tmp'), sandbox = path.join(root, 'backend.sb')
  privateDir(codexHome); privateDir(tmp)
  // Codex snapshots the login shell by starting it in its own session, outside the backend's
  // process group, so a group-wide Stop could never prove quiescence (measured on 0.157.1, B3-2).
  // The profile is ours; the snapshot is off in it and nothing else is configured.
  writeFileSync(path.join(codexHome, 'config.toml'), CODEX_PROFILE_CONFIG, { mode: 0o600 })
  chmodSync(path.join(codexHome, 'config.toml'), 0o600)
  const denied = input.denyRead ?? ['.codex', '.claude', '.agents', '.config', 'Library/Keychains'].map(p => path.join(homedir(), p))
  let access: string[] = []
  if (input.modelAccess) {
    const a = input.modelAccess.authFile
    if (typeof a !== 'string' || !path.isAbsolute(a)) throw Error('invalid_codex_loopback_recipe')
    const target = realpathSync(a), st = statSync(target)
    if (!st.isFile() || (st.mode & 0o077) !== 0 || (process.getuid && st.uid !== process.getuid())) throw Error('codex_login_not_private')
    const link = path.join(codexHome, 'auth.json')
    let existing: string | null = null
    try { existing = lstatSync(link).isSymbolicLink() ? realpathSync(link) : 'not-a-link' } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e }
    if (existing === null) symlinkSync(target, link)
    else if (existing !== target) throw Error('codex_profile_login_conflict')
    // The one file, read and written in place; the rest of the operator's home stays unreadable.
    // DNS on macOS is the mDNSResponder socket; `deny network*` closes it too.
    access = [`(allow file-read* file-write* (literal ${JSON.stringify(target)}))`, '(allow network-outbound (remote tcp "*:443"))',
      '(allow network-outbound (remote unix-socket (path-literal "/private/var/run/mDNSResponder")))']
  }
  writeFileSync(sandbox, [
    '(version 1)', '(allow default)', '(deny network*)',
    // The backend may listen on localhost and accept; it may open no outbound connection at all.
    '(allow network-bind (local ip "localhost:*"))', '(allow network-inbound (local ip "localhost:*"))',
    '(deny file-write*)', `(allow file-write* (subpath ${JSON.stringify(root)}))`,
    `(deny file-read* ${denied.map(p => `(subpath ${JSON.stringify(p)})`).join(' ')})`,
    '(deny mach-lookup (global-name "com.apple.securityd"))',
    ...access,
  ].join('\n') + '\n', { mode: 0o600 })
  chmodSync(sandbox, 0o600)
  const recipe: BackendProcessRecipe = {
    executable: SANDBOX_EXEC, executableSha256: sha256(realpathSync(SANDBOX_EXEC)),
    argv: ['-f', sandbox, binary, 'app-server', '--listen', 'ws://127.0.0.1:0', '--ws-auth', 'capability-token'],
    cwd: root, env: { PATH: input.path, LANG: 'en_US.UTF-8', CODEX_HOME: codexHome, TMPDIR: tmp, NO_COLOR: '1' },
  }
  return { recipe, listener: { pattern: CODEX_LOOPBACK_LISTENER }, codexHome }
}

/** The token stays in trusted main; the backend receives only its digest, as a launch argument. */
export function mintLoopbackToken(): { token: string; launch: BackendLaunchArgs } {
  const token = randomBytes(32).toString('hex')
  return { token, launch: { argv: ['--ws-token-sha256', createHash('sha256').update(token).digest('hex')] } }
}

export type CodexThread = { ok: true; threadId: string; sessionId: string | null; cliVersion: string } | { ok: false; reasonCode: string }
export async function startCodexThread(client: Pick<LoopbackClient, 'request' | 'notify'>, input: { codexHome: string; cwd: string; stillAllowed: () => boolean }): Promise<CodexThread> {
  const init = await client.request('initialize', { clientInfo: { name: 'fabric_controller', version: '1', title: 'Fabric' }, capabilities: { experimentalApi: true } }, input.stillAllowed)
  if (init.status !== 'reply') return fail(`initialize_${init.status}`)
  const r = init.result
  // The owned profile answers, not the operator's: a backend reading another CODEX_HOME is not ours.
  if (!record(r) || r.codexHome !== input.codexHome) return fail('foreign_profile')
  if (r.platformOs !== 'macos') return fail('unexpected_platform')
  const ready = await client.notify('initialized', undefined, input.stillAllowed)
  if (ready.status !== 'written') return fail('initialized_not_sent')
  const started = await client.request('thread/start', { cwd: input.cwd }, input.stillAllowed)
  if (started.status !== 'reply') return fail(`thread_start_${started.status}`)
  const t = record(started.result) ? started.result.thread : null
  if (!record(t) || typeof t.id !== 'string' || !ID.test(t.id) || !Array.isArray(t.turns) || t.turns.length !== 0 ||
      !(t.sessionId === null || t.sessionId === undefined || typeof t.sessionId === 'string' && ID.test(t.sessionId)) || typeof t.cliVersion !== 'string' || !ID.test(t.cliVersion))
    return fail('invalid_thread')
  return { ok: true, threadId: t.id, sessionId: typeof t.sessionId === 'string' ? t.sessionId : null, cliVersion: t.cliVersion }
}

export interface CodexTurnBindingInput {
  fabric: { estateId: string; taskId: string; runId: string; sessionId: string }
  build: string
  backend: { epoch: string; processRef: string }
  connectionId: string
  threadId: string
  /** `{ threadId, turn: { id } }` — the scope of `turn/started`, or null when no turn exists. */
  turn: unknown
  manifestDigest: string
  policyDigest: string
}
export function bindCodexLoopbackTurn(input: CodexTurnBindingInput): Validation<ProviderExecutionBinding> {
  let turnId: string | null = null
  if (input.turn !== null) {
    const p = input.turn
    if (!record(p) || !record(p.turn) || typeof p.threadId !== 'string' || typeof p.turn.id !== 'string') return fail('invalid_turn_scope')
    if (p.threadId !== input.threadId) return fail('foreign_thread')
    turnId = p.turn.id
  }
  return validateProviderBinding({
    schema: 'ProviderExecution@1', fabric: { ...input.fabric },
    provider: { id: 'codex-cli', build: input.build, runtimeProfile: 'owned-loopback', backend: { listener: 'loopback-ws', epoch: input.backend.epoch, processRef: input.backend.processRef } },
    native: { status: 'observed', connectionId: input.connectionId, sessionId: null, threadId: input.threadId, turnId },
    execution: turnId === null ? { kind: 'native-turn', id: 'missing-turn' } : { kind: 'native-turn', id: turnId },
    manifestDigest: input.manifestDigest, policyDigest: input.policyDigest,
  })
}

/** Only the connection a binding names may write for it; a reconnect is a different writer. */
export function writerAllowed(binding: ProviderExecutionBinding, client: Pick<LoopbackClient, 'connectionId' | 'closed'>): boolean {
  return binding.native.status === 'observed' && binding.native.connectionId === client.connectionId && client.closed === null
}
