// The save-conflict contract, probed live. Agents edit the same repositories the
// editor opens, so this is the path that decides whether their work can be lost.
// The probe writes over the file between read and write, exactly as an agent
// would, and requires the refusal.

import { execFileSync } from 'node:child_process'
import { mkdtempSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const SRC = path.resolve(import.meta.dirname, '../src/main/files.ts')
// The native canonical path, as the app stores a repository (a stored path that is not its own canonical
// spelling grants nothing).
const dir = realpathSync.native(mkdtempSync(path.join(tmpdir(), 'fabric-files-')))
const file = path.join(dir, 'note.md')
writeFileSync(file, 'original\\n')

const script = `
import { FileRoots, readFile, writeFile } from ${JSON.stringify(SRC)}
import { readFileSync, writeFileSync } from 'node:fs'
const file = ${JSON.stringify(file)}
// The conflict contract is unchanged by SEC-REQ-016; the boundary is, so the
// probe now opens the folder it works in, exactly as the app does.
const roots = new FileRoots()
roots.reset([${JSON.stringify(dir)}])
const opened = readFile(file, roots)
if (opened.language !== 'markdown') { console.log('FAIL language:', opened.language); process.exit(1) }

writeFileSync(file, 'an agent changed this\\n')      // the agent moves it underneath
const refused = writeFile(file, 'my edit\\n', opened.hash, roots)
if (refused.ok !== false || refused.reason !== 'changed-on-disk') {
  console.log('FAIL: a stale write was accepted'); process.exit(1)
}
if (refused.current !== 'an agent changed this\\n') {
  console.log('FAIL: the refusal did not return the disk content'); process.exit(1)
}
// A2-003: the operator's decision overwrites the version they were SHOWN, never a newer one.
writeFileSync(file, 'the agent again, after the diff was shown\\n')
const stale = writeFile(file, 'my edit\\n', refused.currentHash, roots)
if (stale.ok !== false || stale.reason !== 'changed-on-disk' || stale.current !== 'the agent again, after the diff was shown\\n') {
  console.log('FAIL: a write against the version shown in the diff overwrote a newer one'); process.exit(1)
}
const forced = writeFile(file, 'my edit\\n', stale.currentHash, roots)
if (!forced.ok) { console.log('FAIL: the operator decision was refused'); process.exit(1) }

const reread = readFile(file, roots)
if (reread.content !== 'my edit\\n' || reread.hash !== forced.hash || reread.text !== true) {
  console.log('FAIL: forced write did not land'); process.exit(1)
}

// A4-001 (P0): a binary file opens read-only with no content and is never written.
const png = ${JSON.stringify(path.join(dir, 'pixel.png'))}
const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00])
writeFileSync(png, pngBytes)
const image = readFile(png, roots)
if (image.text !== false || image.content !== '') { console.log('FAIL: a binary file opened as text'); process.exit(1) }
const overImage = writeFile(png, 'anything', image.hash, roots)
if (overImage.ok !== false || overImage.reason !== 'not-text') { console.log('FAIL: a binary file was written'); process.exit(1) }
if (!readFileSync(png).equals(pngBytes)) { console.log('FAIL: the binary file changed'); process.exit(1) }
// Invalid UTF-8 without a NUL byte is not text either.
const latin = ${JSON.stringify(path.join(dir, 'latin1.txt'))}
writeFileSync(latin, Buffer.from([0x63, 0x61, 0x66, 0xe9, 0x0a]))
if (readFile(latin, roots).text !== false) { console.log('FAIL: invalid UTF-8 opened as text'); process.exit(1) }
// A text file with a byte-order mark round-trips byte for byte.
const bom = ${JSON.stringify(path.join(dir, 'bom.txt'))}
const bomBytes = Buffer.from([0xef, 0xbb, 0xbf, 0x68, 0x69, 0x0a])
writeFileSync(bom, bomBytes)
const withBom = readFile(bom, roots)
const same = writeFile(bom, withBom.content, withBom.hash, roots)
if (!same.ok || !readFileSync(bom).equals(bomBytes) || same.hash !== withBom.hash) {
  console.log('FAIL: a BOM text file did not round-trip'); process.exit(1)
}
// A file deleted while open: the save is a conflict with nothing on disk, and only the person's
// "keep mine" (presenting the absent version) creates it again.
const gone = ${JSON.stringify(path.join(dir, 'gone.md'))}
writeFileSync(gone, 'was here\\n')
const before = readFile(gone, roots)
const { rmSync } = await import('node:fs')
rmSync(gone)
const deleted = writeFile(gone, 'mine\\n', before.hash, roots)
if (deleted.ok !== false || deleted.reason !== 'changed-on-disk' || deleted.currentHash !== 'absent' || deleted.current !== '') { console.log('FAIL: a deleted file was not a conflict'); process.exit(1) }
const recreated = writeFile(gone, 'mine\\n', deleted.currentHash, roots)
if (!recreated.ok || readFileSync(gone, 'utf8') !== 'mine\\n') { console.log('FAIL: keep mine did not create the file again'); process.exit(1) }
const raced = writeFile(gone, 'again\\n', 'absent', roots)
if (raced.ok !== false || raced.reason !== 'changed-on-disk') { console.log('FAIL: an absent-version write overwrote a file that exists'); process.exit(1) }
console.log('ok   a file deleted while open is a conflict, and keep mine creates it again without overwriting a newer one')
console.log('ok   a binary or non-UTF-8 file opens read-only and is never written (A4-001)')
console.log('ok   a BOM text file round-trips byte for byte, with the same hash')
console.log('ok   editor save refuses a stale write and returns the disk version')
console.log('ok   the operator decision overwrites only the version shown in the diff, and lands (A2-003)')
`

try {
  const out = execFileSync(process.execPath, ['--experimental-strip-types', '-e', script], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  })
  process.stdout.write(out.split('\n').filter((l) => l.startsWith('ok') || l.startsWith('FAIL')).join('\n') + '\n')
  if (out.includes('FAIL')) process.exit(1)
} catch (e) {
  console.error("files probe failed:", e.stdout?.toString() ?? e.message, e.stderr?.toString() ?? "")
  process.exit(1)
}
