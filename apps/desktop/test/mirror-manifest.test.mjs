// A generation marker that says which schema it is, and a reader that checks
// (AX-04, found by the fence built two iterations ago).
//
// `MirrorManifest.schemaVersion` was written on every generation and read by
// NOTHING. `readManifest` compared `format` and stopped there, so a manifest
// written by a build that changed what the mirrored files MEAN was accepted as
// a generation marker of this one — and `checkGeneration` would then compare
// today's expectations against yesterday's semantics and answer `current`.
//
// It is the same defect as the one this card is about, in a second place: a
// record declares what it is, and the reader takes it on trust. `pastContext`
// refuses a packet whose `schemaVersion` this build does not read; this makes
// the mirror do the same.
//
// FOUND BY THE RATCHET, and by its paid-off direction rather than its new-debt
// one: adding a `.schemaVersion` read in `pastContext.ts` made the gate report
// that the baseline entry now had a reader. It did not — the gate matches
// readers by field NAME, not by type, so `ExecutionPacket.schemaVersion` and
// `MirrorManifest.schemaVersion` are one key to it. Striking the entry on that
// basis would have shrunk the baseline on a collision. Giving the field a real
// reader makes the strike TRUE, which is why this change exists.
//
// Real files in a real temporary directory: the subject is a reader of disk.

import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { readManifest } from '../src/main/workspace.ts'
import { MIRROR_SCHEMA_VERSION } from '../src/shared/storageContract.ts'

let failures = 0
const ok = (m) => console.log('  ok   ' + m)
const fail = (m) => { failures++; console.log('  FAIL ' + m) }
const eq = (got, want, m) =>
  got === want ? ok(m) : fail(m + ' — got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want))

const root = mkdtempSync(path.join(tmpdir(), 'fabric-mirror-'))

const manifestOf = (over = {}) => ({
  format: 'fabric-declared-mirror',
  schemaVersion: MIRROR_SCHEMA_VERSION,
  estateId: 'e-1',
  generatedAt: '2026-09-10T00:00:00.000Z',
  coverage: [],
  files: [],
  counts: {},
  contentDigest: 'abc',
  ...over
})

// The path the module actually uses. The first version of this helper guessed
// `.fabric/manifest.json` and every REFUSAL case passed — by the file never
// being found at all. That is why the first assertion proves the fixture is
// readable before any refusal is claimed.
const MANIFEST = path.join(root, 'workspace', 'manifest.json')
const write = (m) => {
  mkdirSync(path.dirname(MANIFEST), { recursive: true })
  writeFileSync(MANIFEST, JSON.stringify(m))
}

try {
  // ── the fixture is a manifest THIS build accepts, or nothing below holds ────
  {
    write(manifestOf())
    const got = readManifest(root)
    got && got.estateId === 'e-1'
      ? ok('a manifest of the current schema is read, so the refusals below are about the version rather than the path')
      : fail('the fixture is not readable at all: ' + JSON.stringify(got))
  }

  // ── a version this build does not read is REFUSED ──────────────────────────
  {
    // The case that could not fail before: `format` matched, so the manifest was
    // returned and its generation compared against semantics it was never
    // written under.
    write(manifestOf({ schemaVersion: MIRROR_SCHEMA_VERSION + 1 }))
    eq(readManifest(root), null, 'a manifest from a newer schema is not a generation marker of this build')
  }

  // ── and neither is one with no version at all ──────────────────────────────
  {
    const m = manifestOf()
    delete m.schemaVersion
    write(m)
    eq(readManifest(root), null, 'a manifest that declares no schema is refused rather than assumed current')
  }

  // ── the format check it already had still holds ────────────────────────────
  {
    write(manifestOf({ format: 'something-else' }))
    eq(readManifest(root), null, 'and a file that is not a Fabric mirror manifest is still refused')
  }

  // ── an absent manifest is null, which is not the same as a refused one ─────
  {
    rmSync(MANIFEST)
    eq(readManifest(root), null, 'a workspace that predates the manifest reads as no marker, as it always did')
  }
} finally {
  rmSync(root, { recursive: true, force: true })
}

if (failures) {
  console.log('\n' + failures + ' failure(s)')
  process.exit(1)
}
console.log('\nall green: a generation marker is only accepted from a schema this build actually reads')
