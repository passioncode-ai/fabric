// Code region markers (OS-22, REQ-20): a feature, module or special condition in code is
// fenced by `#region <slug> — docs: <path>#<anchor>` … `#endregion <slug>`, and the
// reference must resolve, so an agent searching the code lands on the documented truth.
import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync, mkdirSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {checkRegions, anchorsOf} from '../check-regions.mjs'

function repo(files) {
  const root = mkdtempSync(path.join(tmpdir(), 'regions-'))
  for (const [name, body] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, name)), {recursive: true})
    writeFileSync(path.join(root, name), body)
  }
  return root
}
const doc = '# Agent registry\n\n## Sources and scan\n\nText.\n\n<a id="custom-anchor"></a>\n'

test('a closed region whose documentation resolves passes', () => {
  const root = repo({
    'docs/registry.md': doc,
    'src/scan.ts': '// #region registry-scan — docs: docs/registry.md#sources-and-scan\nexport const x = 1\n// #endregion registry-scan\n',
    'tools/scan.py': '# #region registry-py — docs: docs/registry.md#custom-anchor\nx = 1\n# #endregion registry-py\n',
  })
  assert.deepEqual(checkRegions({root, files: ['src/scan.ts', 'tools/scan.py']}).findings, [])
})

test('every broken form is named with file and line', () => {
  const root = repo({
    'docs/registry.md': doc,
    'src/a.ts': '// #region open-forever — docs: docs/registry.md#sources-and-scan\nconst a = 1\n',
    'src/b.ts': '// #region missing-file — docs: docs/nowhere.md#x\n// #endregion missing-file\n',
    'src/c.ts': '// #region missing-anchor — docs: docs/registry.md#no-such-heading\n// #endregion missing-anchor\n',
    'src/d.ts': '// #endregion stray-end\n',
    'src/e.ts': '// #region one — docs: docs/registry.md#agent-registry\n// #endregion two\n',
    'src/f.ts': '// #region no-docs\n// #endregion no-docs\n',
  })
  const {findings} = checkRegions({root, files: ['src/a.ts', 'src/b.ts', 'src/c.ts', 'src/d.ts', 'src/e.ts', 'src/f.ts']})
  const codes = findings.map(f => `${f.file}:${f.line}:${f.code}`)
  assert.deepEqual(codes.sort(), [
    'src/a.ts:1:unclosed',
    'src/b.ts:1:doc-missing',
    'src/c.ts:1:anchor-missing',
    'src/d.ts:1:end-without-start',
    'src/e.ts:1:unclosed',
    'src/e.ts:2:end-without-start',
    'src/f.ts:1:no-docs-reference',
  ].sort())
})

test('headings become GitHub-style anchors; explicit ids count too', () => {
  const anchors = anchorsOf('# Agent registry\n## C3.2 Jobs (long work)\n<h3 id="html-id">x</h3>\n{#brace-id}\n')
  for (const a of ['agent-registry', 'c32-jobs-long-work', 'html-id', 'brace-id']) assert.ok(anchors.has(a), a)
})
