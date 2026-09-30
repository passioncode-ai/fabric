// Taking a backup, and refusing to restore from one that cannot be trusted (FA-06).
//
// THE ARCHIVE IS THE JOURNAL AND ITS MANIFEST, because ADR-0014 says the journal
// is the spine and every projection derives from it. An archive of thirty tables
// would be an archive of one table and twenty-nine copies of conclusions drawn
// from it — twenty-nine more things that can disagree with the record on the way
// back. `archive.ts` holds the inventory that says so per category, including
// the ones deliberately left out.
//
// EVERY REFUSAL HAPPENS BEFORE ANYTHING IS WRITTEN. A corrupt archive must leave
// the working estate exactly as it was, and the only way to guarantee that is
// never to begin: the manifest is read, the body is counted and digested, and
// only then does a restore call the command — which itself refuses a non-empty
// target under the estate lock.
//
// NOTHING MACHINE-LOCAL TRAVELS. No session bundle, no operations log, no
// settings file, and no transcript unless somebody asks for one by name. A
// backup that carried a bundle would carry a credential.

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  ARCHIVE_SCHEMA,
  archiveInventory,
  digestInput,
  notRestored,
  readArchive,
  type ArchiveManifest,
  type ArchiveRead
} from '../shared/archive.ts'

const MANIFEST = 'manifest.json'
const BODY = 'journal.ndjson'

export interface BackupResult {
  ok: boolean
  says?: string
  manifest?: ArchiveManifest
  dir?: string
}

/** One event, as the archive stores it. Ordered keys so the bytes are stable. */
const lineOf = (row: Record<string, unknown>): string =>
  JSON.stringify({
    seq: row.seq,
    type: row.type,
    schema_rev: row.schema_rev,
    actor: row.actor,
    project_id: row.project_id,
    run_id: row.run_id,
    node_id: row.node_id,
    payload: row.payload,
    occurred_at: row.occurred_at
  })

export function createBackups(db: SupabaseClient) {
  return {
    /** What a restore will NOT bring back, for the screen beside the button. */
    excluded: notRestored,
    inventory: archiveInventory,

    /**
     * Take an archive of one estate into a directory.
     *
     * The WATERMARK is the highest seq read, taken from the rows themselves
     * rather than from a separate query: a second query could see a seq that
     * arrived after the read, and a manifest claiming consistency as of an event
     * it does not contain is worse than one claiming less.
     */
    async take(estateId: string, dir: string): Promise<BackupResult> {
      const { data, error } = await db
        .from('journal')
        .select('seq,type,schema_rev,actor,project_id,run_id,node_id,payload,occurred_at')
        .eq('estate_id', estateId)
        .order('seq')
      if (error) return { ok: false, says: `the journal could not be read: ${error.message}` }
      const rows = data ?? []
      const lines = rows.map((r) => lineOf(r as Record<string, unknown>))
      const watermarkSeq = rows.length ? Number((rows[rows.length - 1] as Record<string, unknown>).seq) : 0

      const digest = createHash('sha256')
        .update(digestInput({ sourceEstateId: estateId, watermarkSeq, eventCount: rows.length }))
        .update(lines.join('\n'))
        .digest('hex')

      const manifest: ArchiveManifest = {
        schema: ARCHIVE_SCHEMA,
        sourceEstateId: estateId,
        takenAtUtc: new Date().toISOString(),
        watermarkSeq,
        eventCount: rows.length,
        digest
      }
      mkdirSync(dir, { recursive: true })
      // The BODY first. A manifest on disk beside a body that is still being
      // written is an archive that verifies against nothing; written this way, an
      // interrupted backup has no manifest and is refused as unreadable rather
      // than restored as short.
      writeFileSync(path.join(dir, BODY), lines.length ? lines.join('\n') + '\n' : '', { mode: 0o600 })
      writeFileSync(path.join(dir, MANIFEST), JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 })
      return { ok: true, manifest, dir }
    },

    /** Read and check an archive without touching anything. */
    verify(dir: string): ArchiveRead {
      let raw: unknown
      try {
        raw = JSON.parse(readFileSync(path.join(dir, MANIFEST), 'utf8'))
      } catch (e) {
        return { ok: false, why: 'unreadable', says: `the archive has no readable manifest: ${String(e)}` }
      }
      let bodyText = ''
      try {
        bodyText = readFileSync(path.join(dir, BODY), 'utf8')
      } catch (e) {
        return { ok: false, why: 'unreadable', says: `the archive has no body: ${String(e)}` }
      }
      const lines = bodyText.length ? bodyText.replace(/\n$/, '').split('\n') : []
      const m = raw as Partial<ArchiveManifest>
      const digest = createHash('sha256')
        .update(
          digestInput({
            sourceEstateId: String(m.sourceEstateId ?? ''),
            watermarkSeq: Number(m.watermarkSeq ?? -1),
            eventCount: Number(m.eventCount ?? -1)
          })
        )
        .update(lines.join('\n'))
        .digest('hex')
      return readArchive(raw, { lines: lines.length, digest })
    },

    /**
     * Restore an archive into a NEW estate.
     *
     * Verified first, every time, and the verification is not optional: the
     * command refuses a non-empty target, and this refuses an archive that
     * cannot be trusted before the command is ever called. Two fences, because
     * the failure they prevent — a half-restored estate — cannot be undone.
     */
    async restore(input: {
      dir: string
      intoEstateId: string
      name?: string
    }): Promise<{ ok: boolean; reasonCode?: string; says?: string; events?: number }> {
      const read = this.verify(input.dir)
      if (!read.ok) return { ok: false, reasonCode: read.why, says: read.says }

      const bodyText = readFileSync(path.join(input.dir, BODY), 'utf8')
      const events = bodyText.length
        ? bodyText.replace(/\n$/, '').split('\n').map((l) => JSON.parse(l))
        : []

      const { data, error } = await db.rpc('restore_estate', {
        p_target_estate: input.intoEstateId,
        p_source_estate: read.manifest.sourceEstateId,
        p_name: input.name ?? `restored from ${read.manifest.sourceEstateId.slice(0, 8)}`,
        p_events: events
      })
      // A raise inside the command rolls the whole restore back, so this arrives
      // as an error rather than as a verdict — and the target is as empty as it
      // was found. The collision case is the one that matters: it used to
      // succeed and produce nothing.
      if (error)
        return {
          ok: false,
          reasonCode: /collided/.test(error.message) ? 'collides' : 'unavailable',
          says: error.message
        }
      const receipt = data as Record<string, unknown> | null
      if (!receipt || typeof receipt.restored !== 'boolean')
        return { ok: false, reasonCode: 'unavailable', says: 'the restore command returned no verdict' }
      if (!receipt.restored)
        return {
          ok: false,
          reasonCode: receipt.reason_code as string,
          says: receipt.says as string
        }
      return { ok: true, events: Number(receipt.events ?? 0) }
    }
  }
}
