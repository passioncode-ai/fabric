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
writeFileSync(file, 'original\n')

const script = `
import { FileRoots, readFile, writeFile } from ${JSON.stringify(SRC)}
import { writeFileSync } from 'node:fs'
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
const forced = writeFile(file, 'my edit\\n', opened.hash, roots, true)
if (!forced.ok) { console.log('FAIL: the operator decision was refused'); process.exit(1) }

const reread = readFile(file, roots)
if (reread.content !== 'my edit\\n' || reread.hash !== forced.hash) {
  console.log('FAIL: forced write did not land'); process.exit(1)
}
console.log('ok   editor save refuses a stale write and returns the disk version')
console.log('ok   the operator decision overrides it and lands')
`

try {
  const out = execFileSync(process.execPath, ['--experimental-strip-types', '-e', script], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  })
  process.stdout.write(out.split('\n').filter((l) => l.startsWith('ok') || l.startsWith('FAIL')).join('\n') + '\n')
  if (out.includes('FAIL')) process.exit(1)
} catch (e) {
  console.error('files probe failed:', e.stdout?.toString() ?? e.message)
  process.exit(1)
}
