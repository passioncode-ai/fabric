// The three receipt states across the public re-creation of the history, against a real
// repository: a pre-publication commit that is NOT an ancestor of HEAD, and a public one that is.
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { history, locateClaim, claimOf, repinProblem, staleProblem, historicalBaseline, isDatedRecord, sha256, STALE } from '../lib/public-history.mjs'
import { repinLineReceipt, repinFilePin } from '../repin-public-history.mjs'

const dir = mkdtempSync(path.join(tmpdir(), 'fabric-public-history-'))
const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.invalid', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.invalid' } }).trim()
const commitFiles = (files, message) => {
  for (const [name, text] of Object.entries(files)) writeFileSync(path.join(dir, name), text)
  git('add', '-A')
  git('commit', '-q', '-m', message)
  return git('rev-parse', 'HEAD')
}
git('init', '-q', '-b', 'old')
const OLD_TEXT = 'alpha\nbeta\ngamma\n'
const old = commitFiles({ 'a.txt': OLD_TEXT, 'same.txt': 'unchanged\n', 'gone.txt': 'soon gone\n', 'dup.txt': 'x\n', 'c.txt': 'one\ntwo\n' }, 'pre-publication')
git('checkout', '-q', '--orphan', 'main')
git('rm', '-q', '-rf', '.')
const NEW_A = 'intro\nalpha\nbeta\ngamma\n'
const pub = commitFiles({ 'a.txt': NEW_A, 'same.txt': 'unchanged\n', 'dup.txt': 'y\nx\nx\n', 'c.txt': 'one\nTWO\n' }, 'public root')
const h = history(dir)
test.after(() => rmSync(dir, { recursive: true, force: true }))

test('in this history means an ancestor of HEAD, not an object the clone holds', () => {
  assert.equal(h.inHistory(pub), true)
  assert.equal(h.inHistory(old), false, 'the old commit is present as an object and still outside the history')
  assert.equal(h.inHistory('f'.repeat(40)), false)
  assert.throws(() => h.readBlob(old, 'a.txt'), /not in this history/)
  assert.equal(h.readBlob(pub, 'gone.txt'), null)
})

test('a claim is found at its line, moved exactly once, or not at all — never guessed', () => {
  const lines = ['a', 'b', 'c', 'b']
  assert.deepEqual(locateClaim(lines, ['a', 'b'], 1), { line: 1 })
  assert.deepEqual(locateClaim(lines, ['c'], 1), { line: 3, moved: true })
  assert.deepEqual(locateClaim(lines, ['b'], 3), { hits: 2 })
  assert.deepEqual(locateClaim(lines, ['z'], 1), { hits: 0 })
  assert.deepEqual(locateClaim(lines, [], 1), { hits: 0 })
  assert.deepEqual(claimOf({ line: 2, end_line: 3 }, 'a\nb\nc'), ['b', 'c'])
  assert.deepEqual(claimOf({ line: 2, excerpt: 'q' }, 'a\nb\nc'), ['q'])
})

const oldBlob = (commit, file) => (commit === old ? execFileSync('git', ['show', commit + ':' + file], { cwd: dir, encoding: 'utf8' }) : null)
const receipt = (file, line, extra = {}) => ({ path: file, commit: old, line, file_sha256: sha256(oldBlob(old, file)), url: `https://github.com/o/r/blob/${old}/${file}#L${line}`, verification: 'git-blob', ...extra })

test('rule 1: identical bytes repin with the same line and hash', () => {
  const r = receipt('same.txt', 1, { excerpt: 'unchanged' })
  assert.equal(repinLineReceipt(r, { oldBlob, now: h, target: pub }), 'repinned:identical-bytes')
  assert.equal(r.commit, pub)
  assert.equal(r.url, `https://github.com/o/r/blob/${pub}/same.txt#L1`)
  assert.equal(repinProblem(r, { sha: r.file_sha256, inHistory: h.inHistory }), null)
})

test('rule 2: a claim that moved exactly once repins to its new line, span and hash', () => {
  const r = receipt('a.txt', 2, { excerpt: 'beta', end_line: 3 })
  assert.equal(repinLineReceipt(r, { oldBlob, now: h, target: pub }), 'repinned:cited-lines-moved')
  assert.deepEqual([r.line, r.end_line, r.file_sha256], [3, 4, sha256(NEW_A)])
  assert.equal(r.repinned_from.line, 2)
  assert.equal(r.url.endsWith('#L3'), true)
  assert.equal(repinProblem(r, { sha: r.file_sha256, inHistory: h.inHistory }), null)
})

test('stale: a file that is gone, a claim that is gone and a claim that is ambiguous', () => {
  const gone = receipt('gone.txt', 1, { excerpt: 'soon gone' })
  assert.equal(repinLineReceipt(gone, { oldBlob, now: h, target: pub }), 'stale:file-gone')
  assert.equal(gone.commit, old, 'a stale receipt keeps its original address')
  assert.equal(gone.verification, STALE)
  const changed = receipt('c.txt', 2, { excerpt: 'two' })
  assert.equal(repinLineReceipt(changed, { oldBlob, now: h, target: pub }), 'stale:claim-changed')
  const unexcerpted = receipt('c.txt', 2)
  assert.equal(repinLineReceipt(unexcerpted, { oldBlob, now: h, target: pub }), 'stale:claim-changed', 'without an excerpt the cited span is the claim')
  const dup = receipt('dup.txt', 1, { excerpt: 'x' })
  assert.equal(repinLineReceipt(dup, { oldBlob, now: h, target: pub }), 'stale:claim-ambiguous')
  for (const r of [gone, changed, unexcerpted, dup]) assert.equal(staleProblem({ commit: r.commit, file: r.path, sha: r.file_sha256, line: r.line, excerpt: r.excerpt, stale: r.stale }, h), null)
})

test('a receipt that did not hold at its own commit is refused, never moved', () => {
  const r = receipt('a.txt', 1, { excerpt: 'beta' })
  assert.throws(() => repinLineReceipt(r, { oldBlob, now: h, target: pub }), /not at its cited line/)
  const bad = receipt('a.txt', 1, { excerpt: 'alpha', file_sha256: '0'.repeat(64) })
  assert.throws(() => repinLineReceipt(bad, { oldBlob, now: h, target: pub }), /broken before the cutover/)
})

test('whole-file pins repin only with identical bytes', () => {
  const same = { commit: old, path: 'same.txt', sha256: sha256('unchanged\n') }
  assert.equal(repinFilePin(same, { oldBlob, now: h, target: pub }), 'repinned:identical-bytes')
  const changed = { commit: old, path: 'a.txt', sha256: sha256(OLD_TEXT) }
  assert.equal(repinFilePin(changed, { oldBlob, now: h, target: pub }), 'stale:bytes-changed')
  assert.equal(staleProblem({ commit: changed.commit, file: changed.path, sha: changed.sha256, stale: changed.stale }, h), null)
})

test('a stale marking is re-proved: evidence that still holds cannot be parked as stale', () => {
  const base = { commit: old, file: 'a.txt', sha: sha256(OLD_TEXT), line: 2, excerpt: 'beta' }
  assert.match(staleProblem({ ...base, stale: { since: pub, reason: 'claim-changed' } }, h), /repin it instead/)
  assert.match(staleProblem({ ...base, commit: pub, stale: { since: pub, reason: 'claim-changed' } }, h), /is in this history/)
  assert.match(staleProblem({ ...base, file: 'same.txt', sha: sha256('unchanged\n'), excerpt: 'nothing', stale: { since: pub, reason: 'claim-changed' } }, h), /byte-identical/)
  assert.match(staleProblem({ ...base, stale: { since: pub, reason: 'file-gone' } }, h), /not gone/)
  assert.match(staleProblem({ ...base, stale: { since: old, reason: 'claim-changed' } }, h), /since must be a commit of this history/)
  assert.match(staleProblem({ ...base, stale: { since: pub, reason: 'forgotten' } }, h), /unknown stale reason/)
  assert.match(staleProblem({ ...base, excerpt: 'x-none', stale: { since: pub, reason: 'bytes-changed' } }, h), /whole-file pins/)
  assert.match(staleProblem({ ...base, excerpt: 'x-none', stale: { since: pub, reason: 'claim-ambiguous' } }, h), /occurs 0 times/)
  assert.equal(staleProblem({ ...base, excerpt: 'x-none', stale: { since: pub, reason: 'claim-changed' } }, h), null)
})

test('a repin record must be consistent with the receipt it moved', () => {
  const r = { line: 3, repinned_from: { commit: old, line: 2, file_sha256: 'a'.repeat(64), rule: 'cited-lines-moved' } }
  const ok = { sha: 'b'.repeat(64), inHistory: h.inHistory }
  assert.equal(repinProblem(r, ok), null)
  assert.match(repinProblem({ ...r, repinned_from: { ...r.repinned_from, commit: pub } }, ok), /is in this history/)
  assert.match(repinProblem({ ...r, repinned_from: { ...r.repinned_from, rule: 'close-enough' } }, ok), /unknown repin rule/)
  assert.match(repinProblem({ ...r, repinned_from: { ...r.repinned_from, rule: 'identical-bytes' } }, ok), /different content hash/)
  assert.match(repinProblem({ ...r, repinned_from: { ...r.repinned_from, rule: 'cited-lines-unchanged' } }, ok), /inconsistent line/)
  assert.match(repinProblem({ ...r, line: 2 }, ok), /inconsistent line/)
  assert.match(repinProblem(r, { ...ok, sha: 'a'.repeat(64) }), /did not change/)
})

test('rule 3: a pre-publication baseline is accepted only when recorded, and only for a dated record', () => {
  const pre = { state: 'pre-publication', reason: 'dated audit' }
  assert.equal(historicalBaseline({ baseline: pub, audit: 'docs/ux/audits/2026-09-15-r0.md' }, h.inHistory), 'verify')
  assert.equal(historicalBaseline({ baseline: old, baseline_history: pre, audit: 'docs/ux/audits/2026-09-15-r0.md' }, h.inHistory), 'pre-publication')
  assert.throws(() => historicalBaseline({ baseline: old, audit: 'docs/ux/audits/2026-09-15-r0.md' }, h.inHistory), /does not record it as pre-publication/)
  assert.throws(() => historicalBaseline({ baseline: old, baseline_history: pre, audit: 'docs/ux/audit.md' }, h.inHistory), /living document/)
  assert.throws(() => historicalBaseline({ baseline: pub, baseline_history: pre, audit: 'docs/ux/audits/2026-09-15-r0.md' }, h.inHistory), /resolve it instead/)
  assert.throws(() => historicalBaseline({ baseline: 'abc', audit: 'x' }, h.inHistory), /immutable source baseline/)
  assert.equal(isDatedRecord('docs/evidence/plans/2026-09-07-engineering-contracts/source-receipts.json'), true)
  assert.equal(isDatedRecord('docs/launch/operator-plan.json'), false)
})
