import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pnpmProblems, isLiving, PLANNED } from '../check-pnpm-commands.mjs'

const packages = new Map([['', new Set(['dev', 'gates:docs'])], ['@fabric/desktop', new Set(['test', 'test:contract-consumer'])]])
const check = (text, open = new Set(['M4'])) => pnpmProblems([{ rel: 'docs/x.md', text }], packages, open)

test('a backticked pnpm command must name an existing script of the package it filters', () => {
  assert.deepEqual(check('Run `pnpm --filter @fabric/desktop test:contract-consumer`.'), [])
  assert.deepEqual(check('`pnpm gates:docs && pnpm dev`, then `pnpm install` and `pnpm --filter @fabric/desktop exec electron .`'), [])
  // The 2026-10-05 defect: a README naming a script a conflict resolution had dropped.
  assert.match(check('Run `pnpm --filter @fabric/desktop test:contract-gone`.')[0], /docs\/x\.md:1: .*has no script "test:contract-gone"/)
  assert.match(check('`pnpm gates:doc`')[0], /the root package has no script "gates:doc"/)
  assert.match(check('`pnpm -F @fabric/nope test`')[0], /names no package/)
  assert.match(check('`cd apps && pnpm run missing`')[0], /no script "missing"/)
})

test('prose is not a command, and dated records are not living documents', () => {
  assert.deepEqual(check('The pnpm workspace keeps pnpm missing-script out of backticks.'), [])
  assert.equal(isLiving('docs/handoffs/2026-10-04-contract-consumer-regression.md'), false)
  assert.equal(isLiving('docs/reports/2026-10-05-hub-i3-ux-130b5510/README.md'), false)
  assert.equal(isLiving('docs/audit/final/README.md'), false)
  assert.equal(isLiving('workspace/knowledge/rules.md'), false)
  assert.equal(isLiving('apps/desktop/test/fixtures/fabric-agent-contract/README.md'), true)
})

test('a planned command passes only while its milestone is open', () => {
  const [script, milestone] = [...PLANNED][0]
  assert.deepEqual(check('`pnpm ' + script + '`', new Set([milestone])), [])
  const closed = check('`pnpm ' + script + '`', new Set())
  assert.ok(closed.some(p => /no longer open/.test(p)), closed.join('\n'))
  assert.ok(closed.some(p => new RegExp('no script "' + script + '"').test(p)), closed.join('\n'))
})
