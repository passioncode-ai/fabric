// #region ops-digest-send — docs: docs/evidence/specs/2026-11-04-agents-logs-and-the-improvement-loop.md#23-logs-read-every-hour-and-every-day-and-the-improvement-loop-co-500-co-502-co-503
/**
 * How a collected daily digest reaches Observatory (CO-503, Observatory 0.34.0's `ops.digest.record`, OBS-330).
 *
 * Over stdio the project a line is recorded for is the one project of the access binding the server was started with
 * (`--binding-token-file`), never an argument. The binding is the operator's to issue, in a terminal; Fabric only
 * names where it reads the token file from. Without that file nothing is started and nothing is sent: the answer is
 * `binding-required`, said once per pass, and the lines stay unsent for the pass after it is issued.
 *
 * Only Fabric's own lines go this way. Another service's lines need a delegation token the hub mints for that service
 * (the memory-http door), which Fabric does not mint yet; the collector skips them with that reason instead of failing
 * them every pass. Nothing but the digest line itself is sent (OD-7).
 */
import { existsSync } from 'node:fs'
import path from 'node:path'
import { FABRIC_SERVICE, type CollectPass, type DigestRecord } from './opsDigestCollector.ts'
import type { ServiceRef } from '../shared/opsDigestCollect.ts'
import type { ToolCall } from './observatoryMemory.ts'

/** Where the operator's `access-binding issue ... --scope ops.digest.record --token-file PATH` writes, under Fabric's
 *  data folder. */
export const BINDING_TOKEN_FILE = path.join('observatory', 'ops-digest-binding.token')

/** Observatory's tool for the `ops.digest.record` capability. */
export const RECORD_TOOL = 'ops_digest_record'

/** A refusal Observatory or Fabric named; `code` is the contract's word, never free text. */
export class DigestNotSent extends Error {
  readonly code: string
  constructor(code: string, detail: string) {
    super(`${code}: ${detail}`)
    this.code = code
  }
}

export function createOpsDigestSender(deps: {
  /** Absolute path of the binding's token file. */
  tokenFile: string
  /** The stdio client started with `--binding-token-file tokenFile`. */
  call: ToolCall
  exists?: (file: string) => boolean
}): { send(r: DigestRecord): Promise<void>; accepts(s: ServiceRef): string | null; ready(): boolean } {
  const exists = deps.exists ?? existsSync
  return {
    accepts(s) {
      return s.id === FABRIC_SERVICE.id ? null : 'waits for the hub\'s delegation token (the memory-http door)'
    },
    ready() {
      return exists(deps.tokenFile)
    },
    async send(r) {
      if (r.service.id !== FABRIC_SERVICE.id) throw new DigestNotSent('delegation-required', 'only Fabric\'s own lines go over stdio')
      if (!exists(deps.tokenFile)) throw new DigestNotSent('binding-required', 'the operator has not issued the ops.digest.record binding')
      let digest: unknown
      try {
        digest = JSON.parse(r.line)
      } catch {
        throw new DigestNotSent('digest-refused', 'the daily line does not parse')
      }
      // `service` is left out: Fabric's own line is of the binding's project, and the registry need not name
      // `fabric.default` for it to be recorded.
      const answer = await deps.call(RECORD_TOOL, { source: r.source, digest })
      if (typeof answer.error === 'string') throw new DigestNotSent(String(answer.code ?? 'refused'), String(answer.detail ?? answer.error))
    }
  }
}
export const SEND_EVERY_MS = 3_600_000

/**
 * One collection at most per hour, from the cycle (CO-503). Without the binding it does nothing and says so once,
 * until the binding appears; the lines wait in their files, nothing is lost. A pass that throws is logged and tried
 * at the next hour.
 */
export function createOpsDigestPass(deps: {
  ready: () => boolean
  pass: () => Promise<CollectPass>
  /** `ok` with a `reason` when nothing was sent on purpose: a missing binding is the operator's step, not a failure. */
  log: (outcome: 'ok' | 'failed', detail: Record<string, unknown>) => void
  now?: () => number
  everyMs?: number
}): { onPass(): Promise<void> } {
  const now = deps.now ?? Date.now
  const every = deps.everyMs ?? SEND_EVERY_MS
  let last = Number.NEGATIVE_INFINITY
  let saidNoBinding = false
  return {
    async onPass() {
      if (now() - last < every) return
      last = now()
      if (!deps.ready()) {
        if (!saidNoBinding) deps.log('ok', { sent: 0, reason: 'binding-required' })
        saidNoBinding = true
        return
      }
      saidNoBinding = false
      try {
        const p = await deps.pass()
        deps.log(p.failed ? 'failed' : 'ok', { sent: p.sent, failed: p.failed, skipped: p.skipped.length })
      } catch (e) {
        // Recorded through `log`, the ops log's own door in the wiring; the next hour tries again.
        deps.log('failed', { note: e instanceof Error ? e.message.slice(0, 200) : 'the collection failed' })
      }
    }
  }
}
// #endregion ops-digest-send
