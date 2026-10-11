// #region window-registry — docs: docs/adr/0020-provider-views-are-sandboxed-extensions-and-layout-is-host-owned.md#provider-views-are-sandboxed-extensions-workspace-layout-is-host-owned
/**
 * The main process's record of which window is which (CO-091, REQ-31).
 *
 * Keyed by `webContents.id`, written when `index.ts` creates a window and removed when it closes —
 * the same lifetime as the window's file roots (`index.ts#revokeWindowRoots`). The kind is what the
 * main process decided when it built the window, never what the renderer says it is: a renderer that
 * could name its own kind could name itself `main`.
 *
 * Pure (no Electron): `index.ts` wires it into `handle`, `listen` and `broadcast`.
 */
import {
  REFUSAL_CODE,
  authorise,
  mayReceive,
  refusalMessage,
  type RefusalReason,
  type WindowEntry,
  type WindowKind
} from '../shared/ipcWindowPolicy.ts'

/** A call refused for the window it came from. Typed, and secret-free: no argument, no subject. */
export class IpcWindowRefused extends Error {
  readonly code = REFUSAL_CODE
  readonly channel: string
  readonly kind: WindowKind | 'unregistered'
  readonly reason: RefusalReason
  // Plain fields, not parameter properties: Node's type stripping runs this file in the tests.
  constructor(channel: string, kind: WindowKind | 'unregistered', reason: RefusalReason) {
    super(refusalMessage(channel, kind, reason))
    this.name = 'IpcWindowRefused'
    this.channel = channel
    this.kind = kind
    this.reason = reason
  }

  /** The ops record's detail: constants only. */
  detail(): { channel: string; kind: WindowKind | 'unregistered'; reason: RefusalReason } {
    return { channel: this.channel, kind: this.kind, reason: this.reason }
  }
}

export interface WindowRegistry {
  /** A window Fabric built, with the kind it built it as. Replaces any earlier entry for the id. */
  register(webContentsId: number, entry: WindowEntry): void
  /** The window closed: its id grants nothing from now on. */
  forget(webContentsId: number): void
  entry(webContentsId: number): WindowEntry | undefined
  /** Null when the call may proceed; the refusal otherwise. */
  check(webContentsId: number, channel: string, args: readonly unknown[]): IpcWindowRefused | null
  /** Whether a broadcast on `channel` may be delivered to this window. */
  receives(webContentsId: number, channel: string, args: readonly unknown[]): boolean
}

export function createWindowRegistry(): WindowRegistry {
  const byId = new Map<number, WindowEntry>()
  return {
    register: (id, entry) => void byId.set(id, Object.freeze({ ...entry })),
    forget: (id) => void byId.delete(id),
    entry: (id) => byId.get(id),
    check(id, channel, args) {
      const entry = byId.get(id)
      const verdict = authorise(entry, channel, args)
      return verdict.ok ? null : new IpcWindowRefused(channel, entry?.kind ?? 'unregistered', verdict.reason)
    },
    receives: (id, channel, args) => mayReceive(byId.get(id), channel, args)
  }
}

/** The part of a BrowserWindow a send needs. */
export interface SendTarget {
  isDestroyed(): boolean
  webContents: { id: number; send(channel: string, ...args: unknown[]): void }
}

/** A message to ONE window (the menu's Cmd+W to the focused one), sent only when the registry says that window may
 *  receive the channel — the rule `index.ts#broadcast` applies to every window. Returns whether it was sent. */
export function sendIfReceives(registry: Pick<WindowRegistry, 'receives'>, win: SendTarget | null | undefined, channel: string, ...args: unknown[]): boolean {
  if (!win || win.isDestroyed() || !registry.receives(win.webContents.id, channel, args)) return false
  win.webContents.send(channel, ...args)
  return true
}
// #endregion window-registry
