/**
 * Native views on the owned backend (first-slice plan B4, ADR-0081 §1).
 *
 * `createBackendViewAuthority` is the `currentOwner` a native view host asks before every effect.
 * It maps three live facts into one `NativeViewOwner`:
 *
 * - the registry's snapshot of the backend — its owner, host, boot and process reference; it must
 *   still be `owned`;
 * - the controller connection's epoch — its `connectionId`, and that it is still open;
 * - the held authority and Stop's input fence (`inputAllowed`).
 *
 * When any of them is gone or has changed, the answer is `null` and the view lifecycle fences every
 * view of that owner at once: backend loss, a reconnect, lost authority and Stop all disable input
 * from every view. A ticket for another backend never matches a newer one's owner. Detaching a view
 * closes only that view's process; nothing here signals the backend, writes a journal event or
 * settles a Run.
 *
 * `codexViewRecipe` is the native Codex TUI attached to that backend: `codex resume <thread>
 * --remote ws://127.0.0.1:<port>` with the bearer token in the environment variable the flag names,
 * the binary's SHA-256 pinned, and its own private profile.
 */
import { createHash } from 'node:crypto'
import { readFileSync, realpathSync, statSync } from 'node:fs'
import path from 'node:path'
import type { NativeViewOwner } from './nativeViewLifecycle.ts'
import type { NativeViewLaunchRecipe } from './nativeViewHost.ts'
import type { OwnedBackendHandle, createOwnedBackendProcessRegistry } from './ownedBackendProcessRegistry.ts'

type Registry = Pick<ReturnType<typeof createOwnedBackendProcessRegistry>, 'snapshot'>
export interface BackendViewAuthorityInput {
  registry: Registry
  handle: OwnedBackendHandle
  sessionId: string
  fabric: Omit<NativeViewOwner['fabric'], 'sessionId'>
  authority(): { personId: string; revision: number } | null
  /** The controller connection this backend's views belong to, read live. */
  connection(): { connectionId: string; closed: string | null }
  /** Stop's first fence level (`backendStopPort.ts#createBackendStopPort`). */
  inputAllowed(sessionId: string): boolean
}

export function createBackendViewAuthority(input: BackendViewAuthorityInput) {
  function currentOwner(): NativeViewOwner | null {
    try {
      const s = input.registry.snapshot(input.handle)
      if (s.physicalState !== 'owned' || !s.processIdentityRef) return null
      const c = input.connection(), a = input.authority()
      if (!c || c.closed !== null || typeof c.connectionId !== 'string' || !a || !input.inputAllowed(input.sessionId)) return null
      return {
        fabric: { ...input.fabric, sessionId: input.sessionId },
        authority: { personId: a.personId, revision: a.revision },
        backend: { ownerId: input.handle.ownerId, hostInstanceId: s.host.hostInstanceId, bootId: s.host.bootId, processIdentityRef: s.processIdentityRef, connectionId: c.connectionId },
      }
    } catch { /* An unreadable backend, connection or authority owns no view. */ return null }
  }
  return {
    currentOwner,
    /** The owner a view host is built for; refused when there is none to build for. */
    initialOwner(): NativeViewOwner { const o = currentOwner(); if (!o) throw Error('backend_view_owner_unavailable'); return o },
  }
}

export function codexViewRecipe(input: { binary: string; binarySha256: string; threadId: string; port: number; token: string; cwd: string; profile: string; path: string; cols?: number; rows?: number }): NativeViewLaunchRecipe {
  if (!path.isAbsolute(input.binary) || !/^[a-f0-9]{64}$/.test(input.binarySha256) || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(input.threadId) ||
      !Number.isSafeInteger(input.port) || input.port < 1 || input.port > 65535 || !/^[A-Za-z0-9._~-]{16,512}$/.test(input.token) ||
      !path.isAbsolute(input.cwd) || !path.isAbsolute(input.profile) || typeof input.path !== 'string' || /[\x00-\x1f]/.test(input.path)) throw Error('invalid_codex_view_recipe')
  const binary = realpathSync(input.binary), s = statSync(binary)
  if (!s.isFile() || (s.mode & 0o022) !== 0 || createHash('sha256').update(readFileSync(binary)).digest('hex') !== input.binarySha256) throw Error('codex_binary_not_pinned')
  return {
    executable: binary, executableSha256: input.binarySha256,
    argv: ['resume', input.threadId, '--remote', `ws://127.0.0.1:${input.port}`, '--remote-auth-token-env', 'FABRIC_VIEW_TOKEN'],
    cwd: input.cwd,
    // The token travels only in the variable the flag names; the view's profile is its own.
    env: { PATH: input.path, LANG: 'en_US.UTF-8', TERM: 'xterm-256color', CODEX_HOME: input.profile, FABRIC_VIEW_TOKEN: input.token },
    cols: input.cols ?? 120, rows: input.rows ?? 36,
  }
}
