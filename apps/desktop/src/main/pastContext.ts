// #region past-context — docs: docs/ux/scenarios.md#scn-057-preview-the-next-context-and-inspect-the-exact-past-pack
// What a session actually ran from, months later (AX-04).
//
// MEASURED at `e68b3f7`, and it corrects the audit packet rather than repeating
// it. The packet says the pack "lives in a disposable credential bundle" — true
// at `d28c321`, and PF-05.02 has since fixed the WRITE half: `sessionBundle`
// materializes the pack into `{root}/packets`, outside the session directory
// that `discard` removes, with `packet-<sessionId>.json` naming its parts by
// digest. The bytes survive.
//
// NOTHING READS THEM. `readPart` — the module's own "only read path, so nothing
// reads a blob unchecked" — has ZERO consumers in the repository, tests
// included; `verify` is called once, at launch, against blobs written a line
// earlier. So the durable answer to "what did this session run from" exists on
// disk and no path in the product asks it, which from the operator's side is
// indistinguishable from the loss PF-05.02 was built to prevent. Seventh
// instance of this cycle's recurring shape, and the first where the unread
// thing is a whole retrieval capability rather than a field.
//
// AND IT NEVER REGENERATES. `storageContract.ts` describes
// `session_context_packs` as "derived from memory at a moment; regenerated
// rather than restored" — accurate about the TABLE, and the exact belief AX-04's
// acceptance forbids for the BYTES: "never reconstruct with closest current
// facts". Recompiling today reads today's memory, so a pack rebuilt now is a
// different pack wearing the same session id. Absent bytes are reported absent.

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { PACKET_SCHEMA, verify, type ExecutionPacket } from './executionPacket.ts'
import type { PastContext } from '../shared/pastContext.ts'

export interface PastContextDeps {
  /** The app data root. `packets` hangs off it, NOT off the session directory —
   *  that is the whole point of PF-05.02 and it is why this read survives. */
  root: string
  /** Injected so a probe drives the real files without an Electron app. */
  readFile?: (p: string) => string
  exists?: (p: string) => boolean
}

/**
 * What a session id may look like before it becomes part of a file name.
 *
 * Ids are minted by `randomUUID` and the probes use short names like `s-1`;
 * both are letters, digits, `-` and `_`. Nothing else is accepted — no `.`, no
 * separator — so the name cannot step out of the packet store. Release review
 * 2026-10-03: the renderer's id went straight into the path, `x/../../secret`
 * reached a file outside the store, and the JSON parse error quoted its first
 * bytes back to the window.
 */
const SESSION_ID = /^[A-Za-z0-9_-]{1,128}$/

export function createPastContext(deps: PastContextDeps) {
  const root = path.join(deps.root, 'packets')
  const readFile = deps.readFile ?? ((p: string): string => readFileSync(p, 'utf8'))
  const exists = deps.exists ?? ((p: string): boolean => existsSync(p))

  return {
    /**
     * The exact context one session was given.
     *
     * Verified on the way out rather than trusted: `verify` re-hashes the bytes,
     * so a blob edited on disk is refused instead of being handed over as the
     * record. A record that can be edited without saying so is not a record.
     */
    read(sessionId: string): PastContext {
      // `no_packet`, truthfully: no packet can exist under a name that is not a
      // session id, and nothing is looked up to find that out.
      if (typeof sessionId !== 'string' || !SESSION_ID.test(sessionId))
        return {
          held: false,
          why: 'no_packet',
          says: 'that is not a session id, so no execution packet was looked up for it.'
        }
      const packetPath = path.join(root, `packet-${sessionId}.json`)
      if (!exists(packetPath))
        return {
          held: false,
          why: 'no_packet',
          says:
            'no execution packet was recorded for this session. Sessions that ran before the packet ' +
            'store existed have none, and their context cannot be produced — recompiling now would ' +
            'read today’s memory and answer with a different pack wearing this session’s id.'
        }

      let packet: ExecutionPacket
      try {
        packet = JSON.parse(readFile(packetPath)) as ExecutionPacket
      } catch (e) {
        // NOT SILENCE, which is why there is no `ops.failed()` here: the failure
        // leaves as a named outcome carrying the reason, and the surface renders
        // that sentence to the operator. Logging it as well would report a
        // problem twice for one event — and this is a READ that answers, not a
        // side effect that failed.
        return { held: false, why: 'unreadable', says: `the packet could not be read: ${String(e)}` }
      }
      if (packet?.schemaVersion !== PACKET_SCHEMA)
        return {
          held: false,
          why: 'unreadable',
          says: `the packet declares schema ${String(packet?.schemaVersion)}, and this build reads ${PACKET_SCHEMA}`
        }

      const check = verify(root, packet)
      if (!check.ok)
        return {
          held: false,
          why: check.corrupt.length ? 'blob_corrupt' : 'blob_missing',
          says: check.corrupt.length
            ? `the stored context no longer hashes to what the packet records (${check.corrupt.join(', ')}). ` +
              'Something rewrote it, and an altered record is not the record.'
            : `the stored context is gone from this machine (${check.missing.join(', ')})`
        }

      const ref = packet.refs.find((r) => r.name === 'context')
      if (!ref)
        return { held: false, why: 'no_packet', says: 'the packet records no context part for this session' }

      // GUARDED, even though `verify` has just said the blob resolves. The two
      // reads are separate syscalls, so a file removed between them would throw
      // out of a function whose whole contract is four NAMED outcomes — found
      // by a plant that disabled `verify` and produced an unhandled ENOENT
      // instead of a failed assertion. A module that can throw where it
      // promised to answer is one its callers cannot rely on.
      let bytes: string
      try {
        bytes = readFile(path.join(root, 'blobs', ref.sha256))
      } catch (e) {
        // The same rule as the packet read above: the reason travels to the
        // caller in the answer rather than into a log the operator will not see.
        return {
          held: false,
          why: 'blob_missing',
          says: `the stored context could not be read from this machine: ${String(e)}`
        }
      }
      return {
        held: true,
        sessionId: packet.sessionId,
        projectId: packet.projectId,
        taskId: packet.taskId,
        sha256: ref.sha256,
        bytes,
        chars: bytes.length
      }
    }
  }
}
// #endregion past-context
