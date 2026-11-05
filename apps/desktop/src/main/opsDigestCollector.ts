// #region ops-digest-collector — docs: docs/evidence/specs/2026-11-04-agents-logs-and-the-improvement-loop.md#23-logs-read-every-hour-and-every-day-and-the-improvement-loop-co-500-co-502-co-503
/**
 * Fabric collects the daily digests (CO-503, the contract's DEC-0153 OD-9): its own folder under the service `fabric`,
 * and every folder a local service descriptor declares with the ops-digest extension, read inside that service's
 * `paths.data`. Each closed day's first daily line is sent once, with its service and source; what was sent is kept in
 * `digests/sent.json` (the key Observatory keeps: service, source, day). A send that fails is tried again on the next
 * pass; a folder that cannot be read is skipped and named in the pass's answer. Nothing but the digests' own lines
 * leaves the machine (OD-7).
 */
import { readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { declaredFolders, pendingLines, type ServiceRef } from '../shared/opsDigestCollect.ts'

export interface DigestRecord {
  service: ServiceRef
  source: string
  day: string
  /** The daily line as written, one JSON object. */
  line: string
}

export interface CollectPass {
  sent: number
  failed: number
  /** Folders or declarations skipped, by service and reason (never a path). */
  skipped: Array<{ service: string; reason: string }>
}

const KEEP_DAYS = 400
export const FABRIC_SERVICE: ServiceRef = { id: 'fabric', instance: 'default' }

export function createOpsDigestCollector(deps: {
  /** Fabric's own digests folder; `sent.json` lives here too. */
  ownDir: string
  servicesDir: string
  send: (r: DigestRecord) => Promise<void>
  now?: () => number
  read?: (file: string) => string
  list?: (dir: string) => string[]
  writeWhole?: (file: string, text: string) => void
}): { pass(): Promise<CollectPass> } {
  const now = deps.now ?? Date.now
  const read = deps.read ?? ((f: string) => readFileSync(f, 'utf8'))
  const list = deps.list ?? ((d: string) => readdirSync(d))
  const writeWhole = deps.writeWhole ?? ((f: string, t: string) => { writeFileSync(`${f}.tmp`, t, { mode: 0o600 }); renameSync(`${f}.tmp`, f) })
  const sentFile = path.join(deps.ownDir, 'sent.json')
  let running = false

  const folders = (skipped: CollectPass['skipped']): Array<{ service: ServiceRef; source: string; dir: string }> => {
    const out = [{ service: FABRIC_SERVICE, source: 'app', dir: deps.ownDir }]
    let names: string[] = []
    try { names = list(deps.servicesDir).filter((n) => n.endsWith('.json')) } catch {
      // No services folder: only Fabric's own digests.
      return out
    }
    for (const name of names.sort()) {
      let d: Record<string, unknown>
      try { d = JSON.parse(read(path.join(deps.servicesDir, name))) as Record<string, unknown> } catch {
        // A descriptor that does not parse declares nothing; the registry says why elsewhere.
        continue
      }
      const declared = declaredFolders(d)
      if (!declared) continue
      const service = { id: String(d.id ?? ''), instance: String(d.instance ?? '') }
      const label = `${service.id}.${service.instance}`
      if (!service.id || !service.instance || service.id === FABRIC_SERVICE.id) { skipped.push({ service: label, reason: 'no id, or Fabric\'s own id' }); continue }
      if ('refused' in declared) { skipped.push({ service: label, reason: declared.refused }); continue }
      const data = String((d.paths as { data: string }).data).replace(/^~(?=\/)/, os.homedir())
      if (!path.isAbsolute(data)) { skipped.push({ service: label, reason: 'paths.data is not absolute' }); continue }
      for (const f of declared.folders) out.push({ service, source: f.source, dir: path.join(data, f.dir) })
    }
    return out
  }

  return {
    async pass() {
      const result: CollectPass = { sent: 0, failed: 0, skipped: [] }
      if (running) return result
      running = true
      try {
        let sent: string[] = []
        try { sent = (JSON.parse(read(sentFile)) as { sent?: string[] }).sent ?? [] } catch {
          // Nothing sent yet, or an unreadable ledger: every closed day is offered again and Observatory keeps the first.
          sent = []
        }
        const done = new Set(sent)
        const t = new Date(now())
        const today = t.toISOString().slice(0, 10)
        const months = [today.slice(0, 7), new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 1, 1)).toISOString().slice(0, 7)]
        for (const f of folders(result.skipped)) {
          for (const m of months) {
            let text: string
            try { text = read(path.join(f.dir, `daily-${m}.jsonl`)) } catch {
              // No daily file for that month: nothing to send from it.
              continue
            }
            for (const p of pendingLines(text, f.service, f.source, today, done)) {
              try {
                await deps.send({ service: f.service, source: f.source, day: p.day, line: p.line })
                done.add(p.key)
                result.sent++
              } catch {
                // Tried again on the next pass; the count says so.
                result.failed++
              }
            }
          }
        }
        if (result.sent) {
          const oldest = new Date(now() - KEEP_DAYS * 86_400_000).toISOString().slice(0, 10)
          const kept = [...done].filter((k) => (k.split('|')[2] ?? '') >= oldest).sort()
          writeWhole(sentFile, JSON.stringify({ schema: 'ops.digest.sent@1', sent: kept }))
        }
        return result
      } finally {
        running = false
      }
    }
  }
}
// #endregion ops-digest-collector
