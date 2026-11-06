// CO-520: the privacy gate prints where a finding is, never what matched, and passes as NOT_RUN where
// the operator's checker or denylist is absent (unless --require).
import assert from 'node:assert/strict'
import test, { after } from 'node:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const GATE = path.resolve('scripts/check-private.mjs')
const PLANT = 'PLANTED-PRIVATE-TERM'
const made = []
after(() => { for (const d of made) rmSync(d, { recursive: true, force: true }) })

function fixture(stdout, status = 0) {
  const dir = mkdtempSync(path.join(tmpdir(), 'check-private-'))
  made.push(dir)
  const checker = path.join(dir, 'check_private.py')
  writeFileSync(checker, `import sys\nsys.stdout.write(${JSON.stringify(stdout)})\nsys.exit(${status})\n`)
  const terms = path.join(dir, 'terms.txt')
  writeFileSync(terms, `${PLANT}\n`)
  return { checker, terms, dir }
}

function gate(env, ...args) {
  const r = spawnSync(process.execPath, [GATE, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  })
  return { status: r.status, out: r.stdout + r.stderr }
}

const finding = { file: 'docs/x.md', line: 7, rule: 'P1', match: PLANT, fingerprint: 'P1:docs/x.md:0123456789abcdef' }

test('a finding fails the gate with its place and fingerprint, and the matched text is never printed', () => {
  const { checker, terms } = fixture(JSON.stringify({ findings: [finding], stale_allow_entries: [] }), 1)
  const r = gate({ PASSIONCODE_CHECK_PRIVATE: checker, PASSIONCODE_PRIVATE_TERMS: terms })
  assert.equal(r.status, 1)
  assert.match(r.out, /FINDING P1 docs\/x\.md:7 {2}\[P1:docs\/x\.md:0123456789abcdef\]/)
  assert.ok(!r.out.includes(PLANT), 'the matched term reached the output')
})

test('a checker that prints something other than JSON fails without echoing it', () => {
  const { checker, terms } = fixture(`FINDING P1 docs/x.md:7 ${PLANT}\n`, 1)
  const r = gate({ PASSIONCODE_CHECK_PRIVATE: checker, PASSIONCODE_PRIVATE_TERMS: terms })
  assert.equal(r.status, 1)
  assert.match(r.out, /without a JSON report/)
  assert.ok(!r.out.includes(PLANT))
})

test('a stale allow entry fails the gate', () => {
  const { checker, terms } = fixture(JSON.stringify({ findings: [], stale_allow_entries: ['P2:a.md:00'] }))
  const r = gate({ PASSIONCODE_CHECK_PRIVATE: checker, PASSIONCODE_PRIVATE_TERMS: terms })
  assert.equal(r.status, 1)
  assert.match(r.out, /STALE \.check-private-allow entry matches nothing: P2:a\.md:00/)
})

test('a clean report passes', () => {
  const { checker, terms } = fixture(JSON.stringify({ findings: [], stale_allow_entries: [] }))
  const r = gate({ PASSIONCODE_CHECK_PRIVATE: checker, PASSIONCODE_PRIVATE_TERMS: terms })
  assert.equal(r.status, 0)
  assert.match(r.out, /PASS/)
})

test('without the denylist the gate is NOT_RUN: it passes, and --require fails it', () => {
  const { checker, dir } = fixture(JSON.stringify({ findings: [finding], stale_allow_entries: [] }), 1)
  const env = { PASSIONCODE_CHECK_PRIVATE: checker, PASSIONCODE_PRIVATE_TERMS: path.join(dir, 'absent.txt') }
  const free = gate(env)
  assert.equal(free.status, 0)
  assert.match(free.out, /NOT_RUN: no local denylist/)
  assert.equal(gate(env, '--require').status, 2)
})

test('without the checker the gate is NOT_RUN', () => {
  const { dir, terms } = fixture('{}')
  const r = gate({ PASSIONCODE_CHECK_PRIVATE: path.join(dir, 'absent.py'), PASSIONCODE_PRIVATE_TERMS: terms })
  assert.equal(r.status, 0)
  assert.match(r.out, /NOT_RUN: no org-index checker/)
})
