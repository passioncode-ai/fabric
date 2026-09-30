// Writes the frozen CeoPrivateArchive@1 vectors beside this file. Run ONCE, by hand, when
// the contract changes on purpose — never from a test:
//   node --experimental-strip-types apps/desktop/test/fixtures/ceo-private-archive/generate.mjs
// The first freeze (2026-09-28) took its expectations from the codec itself; what makes
// them evidence is that the codec test and the SQL test (A1-2) must reproduce them from the
// bytes, and the empty vector's canonical is also framed by hand in the codec test.
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { decodePrivateArchive, preflightOrdinaryArchive } from '../../../src/main/ceoPrivateArchive.ts'
import { goldenVectors, ordinaryVectors, bytes } from './vectors.mjs'

const dir = import.meta.dirname
const json = v => JSON.stringify(v, null, 2) + '\n'
for (const [name, archive] of Object.entries(goldenVectors())) {
  const raw = bytes(archive), got = decodePrivateArchive(raw)
  writeFileSync(path.join(dir, name + '.archive.json'), raw)
  writeFileSync(path.join(dir, name + '.expected.json'), json({ canonical: got.canonical, sha256: got.digest }))
}
for (const [name, { manifest, journal }] of Object.entries(ordinaryVectors())) {
  const m = new TextEncoder().encode(json(manifest)), j = new TextEncoder().encode(journal)
  preflightOrdinaryArchive(m, j)
  writeFileSync(path.join(dir, name + '.manifest.json'), m)
  writeFileSync(path.join(dir, name + '.journal.ndjson'), j)
  writeFileSync(path.join(dir, name + '.expected.json'), json({ sha256: manifest.digest }))
}
console.log('wrote', Object.keys(goldenVectors()).length, 'archives and', Object.keys(ordinaryVectors()).length, 'ordinary archives')
