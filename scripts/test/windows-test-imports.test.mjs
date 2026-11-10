// CO-557: the nightly Windows job of platforms.yml (runs 42435382210 and 42547666053) failed in
// listener-owner.test.mjs and peer-account.test.mjs before a single test ran: both loaded the module under test
// with `await import(path.resolve(...))`, and on Windows that string is `C:\...`, which Node's ESM loader reads as
// a URL with the scheme `c:` and refuses (ERR_UNSUPPORTED_ESM_URL_SCHEME). macOS and Linux never see it, so the
// local gate stayed green. This gate holds every test file the Windows job runs to an import Windows can load.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..', '..')
const workflow = readFileSync(path.join(root, '.github/workflows/platforms.yml'), 'utf8')

/** The test files a step of the Windows job runs, read from the workflow itself. */
export function windowsTestFiles(text) {
  const start = text.search(/^  windows:\s*$/m)
  assert.notEqual(start, -1, 'platforms.yml has a windows job')
  const rest = text.slice(start + 1)
  const next = rest.search(/^  [a-z][\w-]*:\s*$/m)
  const job = next === -1 ? rest : rest.slice(0, next)
  return [...new Set(job.match(/(?:apps\/desktop|scripts)\/test\/[\w.-]+\.test\.mjs/g) ?? [])]
}

/** A dynamic import of a filesystem path: a drive-letter string on Windows, never a file URL. */
export const PATH_IMPORT = /import\(\s*path\.(?:resolve|join)\(/

test('a drive-letter path is a URL scheme to the ESM loader, on every platform', async () => {
  await assert.rejects(import('C:/fabric/never.mjs'), { code: 'ERR_UNSUPPORTED_ESM_URL_SCHEME' })
})

test('the gate reads the Windows job and catches the import that failed there', () => {
  const files = windowsTestFiles(workflow)
  assert.ok(files.includes('apps/desktop/test/listener-owner.test.mjs'), files.join(', '))
  assert.ok(files.includes('apps/desktop/test/peer-account.test.mjs'), files.join(', '))
  assert.match("await import(path.resolve(import.meta.dirname, '../src/main/hub.ts'))", PATH_IMPORT)
  assert.doesNotMatch("import { locateHub } from '../src/main/hub.ts'", PATH_IMPORT)
  assert.doesNotMatch("await import(pathToFileURL(path.resolve(dir, 'x.ts')).href)", PATH_IMPORT)
})

test('every test file the Windows job runs imports in a way Windows can load', () => {
  const bad = windowsTestFiles(workflow).filter((f) => PATH_IMPORT.test(readFileSync(path.join(root, f), 'utf8')))
  assert.deepEqual(bad, [], `a dynamic import of a path fails on Windows (ERR_UNSUPPORTED_ESM_URL_SCHEME): ${bad.join(', ')}`)
})
