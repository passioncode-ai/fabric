// The execution packet (PF-05.02) — content-addressed materialization of what a
// session ran from.
//
// The context pack and the brief used to exist only as files under
// `{root}/sessions/{id}/` — a LOCAL path, destroyed with the session. A path is
// not an identity: move the store, and every reference breaks; delete the
// directory, and "what did this session run from" has no answer. Here the
// identity is the CONTENT — each blob lives at `blobs/<sha256>` and the packet
// names its parts by digest, so a store moved to another root verifies
// unchanged, and a blob that is missing or altered BLOCKS the start instead of
// silently starting a session on partial context.

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export const PACKET_SCHEMA = 'execution-packet/1'

export interface PacketRef {
  /** What the blob IS to the session — 'context', 'brief', … */
  name: string
  /** The identity. Never a path. */
  sha256: string
}

export interface ExecutionPacket {
  schemaVersion: typeof PACKET_SCHEMA
  sessionId: string
  projectId: string
  taskId: string | null
  refs: PacketRef[]
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; missing: string[]; corrupt: string[] }

const digest = (bytes: string): string => createHash('sha256').update(bytes, 'utf8').digest('hex')

const blobPath = (root: string, sha256: string): string => path.join(root, 'blobs', sha256)

/** Store one blob under its own digest. Idempotent: same bytes, same address. */
export function writeBlob(root: string, bytes: string): string {
  const sha256 = digest(bytes)
  mkdirSync(path.join(root, 'blobs'), { recursive: true, mode: 0o700 })
  writeFileSync(blobPath(root, sha256), bytes, { encoding: 'utf8', mode: 0o600 })
  return sha256
}

/**
 * Materialize a packet: every named part becomes a blob, the packet records the
 * digests, and `packet.json` is itself only a rendezvous — the refs inside it
 * are the identity, so the same packet materialized into two roots is the SAME
 * packet.
 */
export function materialize(
  root: string,
  session: { sessionId: string; projectId: string; taskId: string | null },
  parts: ReadonlyArray<{ name: string; bytes: string }>
): ExecutionPacket {
  const refs = parts.map((p) => ({ name: p.name, sha256: writeBlob(root, p.bytes) }))
  const packet: ExecutionPacket = { schemaVersion: PACKET_SCHEMA, ...session, refs }
  mkdirSync(root, { recursive: true, mode: 0o700 })
  writeFileSync(path.join(root, `packet-${session.sessionId}.json`), JSON.stringify(packet, null, 2), {
    encoding: 'utf8',
    mode: 0o600
  })
  return packet
}

/**
 * Whether every ref resolves in THIS root, by re-hashing the bytes — never by
 * trusting a filename. A missing or corrupt blob blocks the start: a session
 * on partial context reports conclusions about material it never saw.
 */
export function verify(root: string, packet: ExecutionPacket): VerifyResult {
  const missing: string[] = []
  const corrupt: string[] = []
  for (const ref of packet.refs) {
    let bytes: string
    try {
      bytes = readFileSync(blobPath(root, ref.sha256), 'utf8')
    } catch {
      // Not silence: the failure leaves here as `missing`, which the caller must
      // handle — `sessionBundle` refuses the launch on it. This function answers
      // "does every ref resolve in THIS root", not "why did one not", and an
      // unreadable blob and an absent one block the start identically, so the
      // conservative classification loses nothing a caller could act on.
      missing.push(ref.name)
      continue
    }
    if (digest(bytes) !== ref.sha256) corrupt.push(ref.name)
  }
  return missing.length || corrupt.length ? { ok: false, missing, corrupt } : { ok: true }
}

/** Read one named part, verified — the only read path, so nothing reads a blob unchecked. */
export function readPart(root: string, packet: ExecutionPacket, name: string): string {
  const ref = packet.refs.find((r) => r.name === name)
  if (!ref) throw new Error(`packet has no part named ${name}`)
  const bytes = readFileSync(blobPath(root, ref.sha256), 'utf8')
  if (digest(bytes) !== ref.sha256)
    throw new Error(`part ${name} does not match its digest — the store was altered`)
  return bytes
}
