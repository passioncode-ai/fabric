// PL-8 (0.3.23 review, iteration 2): a script CI runs directly keeps its executable bit in git.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { directlyRun, modeProblems, modesOf } from '../lib/script-modes.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

test('a workflow\'s ./ runs are read, an interpreter\'s argument is not', () => {
  const yml = ['      - run: ./scripts/ci.sh fast', '      - run: |', '          ./scripts/release.sh --tag x', '      - run: bash scripts/other.sh', '      - run: node ./scripts/x.mjs'].join('\n')
  assert.deepEqual(directlyRun(yml), ['scripts/ci.sh', 'scripts/release.sh'])
})

test('a shell script under scripts/ or a directly run path that lost its exec bit is a problem', () => {
  const modes = modesOf([
    '100755 aaaa 0\tscripts/ci.sh',
    '100644 bbbb 0\tscripts/check-docs.sh',
    '100644 cccc 0\tscripts/check-ops.mjs',
    '100644 dddd 0\ttools/run.py'
  ].join('\n'))
  assert.deepEqual(modeProblems(modes, ['scripts/ci.sh', 'tools/run.py']), [
    'scripts/check-docs.sh is tracked as 100644, not 100755',
    'tools/run.py is tracked as 100644, not 100755'
  ])
  assert.deepEqual(modeProblems(modes, ['scripts/missing.sh']).at(-1), 'scripts/missing.sh is run directly by a workflow and is not tracked')
})

test('this tree: every script CI runs directly is executable', () => {
  const out = execFileSync('node', [path.join(ROOT, 'scripts/check-script-modes.mjs')], { encoding: 'utf8' })
  assert.match(out, /^PASS script modes: /)
})
