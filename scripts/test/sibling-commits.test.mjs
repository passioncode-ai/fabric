// Commit references into SIBLING repositories across their public re-creation
// (scripts/lib/public-history.mjs, "Sibling repositories"). Everything here runs against
// fixture repositories: a Fabric-shaped tree that cites commits, and bare sibling remotes
// reached over file://, so nothing depends on which commits GitHub happens to hold today.
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { siblingRepinProblem, siblingEntries, siblingDigest, isHistoricalRecord, sha256, SIBLING_PUBLICATION } from '../lib/public-history.mjs'
import { repinSiblingReceipt } from '../repin-sibling-receipts.mjs'
import { checkSiblingCommits, scanReferences, SIBLING_PRE_PUBLICATION_DIGEST } from '../check-sibling-commits.mjs'

const tmp = mkdtempSync(path.join(tmpdir(), 'fabric-sibling-commits-'))
test.after(() => rmSync(tmp, { recursive: true, force: true }))
const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.invalid', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.invalid' }
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const write = (dir, files) => {
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, name)), { recursive: true })
    writeFileSync(path.join(dir, name), text)
  }
}

// One sibling, `alpha`, re-created public: its earlier commit OLD exists only in a history the
// remote no longer carries. The remote is bare, as GitHub's is.
const SPEC_OLD = 'intro\nThe rule MUST hold.\nend\n'
const SPEC_NEW = 'intro\nnew line\nThe rule MUST hold.\nend\n'
const work = path.join(tmp, 'alpha-work')
mkdirSync(work)
git(work, 'init', '-q', '-b', 'old')
write(work, { 'spec.md': SPEC_OLD, 'same.md': 'unchanged\n', 'gone.md': 'soon gone\n' })
git(work, 'add', '-A'); git(work, 'commit', '-q', '-m', 'private history')
const OLD = git(work, 'rev-parse', 'HEAD')
git(work, 'checkout', '-q', '--orphan', 'main'); git(work, 'rm', '-q', '-rf', '.')
write(work, { 'spec.md': SPEC_NEW, 'same.md': 'unchanged\n' })
git(work, 'add', '-A'); git(work, 'commit', '-q', '-m', 'public root')
const PUB = git(work, 'rev-parse', 'HEAD')
const remotes = path.join(tmp, 'remotes')
mkdirSync(remotes)
git(tmp, 'clone', '-q', '--no-local', '--bare', '--single-branch', '--branch', 'main', work, path.join(remotes, 'alpha.git'))
git(path.join(remotes, 'alpha.git'), 'config', 'uploadpack.allowFilter', 'true')
const remote = (repo) => 'file://' + path.join(remotes, repo + '.git')
const DEAD = 'd'.repeat(40) // a commit no history has

const LIST = { alpha: { root: PUB, pre_publication: [OLD] } }
const DIGEST = siblingDigest(LIST)
const url = (repo, commit, file, line) => `https://github.com/passioncode-ai/${repo}/blob/${commit}/${file}#L${line}`
const receipt = (extra = {}) => ({ path: 'spec.md', line: 2, repository: 'alpha', commit: OLD, file_sha256: sha256(SPEC_OLD), excerpt: 'The rule MUST hold.', url: url('alpha', OLD, 'spec.md', 2), verification: 'retained-sibling-receipt', ...extra })

/** A Fabric-shaped repository whose tracked files are `files`; the model is docs/model.json. */
function fabric(files, model = { items: [] }) {
  const dir = mkdtempSync(path.join(tmp, 'fabric-'))
  git(dir, 'init', '-q', '-b', 'main')
  write(dir, { 'docs/model.json': JSON.stringify(model, null, 2) + '\n', ...files })
  git(dir, 'add', '-A'); git(dir, 'commit', '-q', '-m', 'fixture')
  return dir
}
const check = (root, extra = {}) => checkSiblingCommits({ root, list: LIST, digest: DIGEST, remote, documents: ['docs/model.json'], ...extra })
const repinned = () => { const r = receipt(); repinSiblingReceipt(r, { readTarget: (f) => git(work, 'show', PUB + ':' + f) + '\n', target: PUB }); return r }

test('history is a dated record or an ADR; everything else is a living document', () => {
  assert.equal(isHistoricalRecord('docs/audit/2026-09-09-final/packets/M194.md'), true)
  assert.equal(isHistoricalRecord('docs/evidence/plans/2026-09-07-engineering-contracts/source-receipts.json'), true)
  assert.equal(isHistoricalRecord('docs/adr/0012-agent-compatibility-is-an-external-versioned-contract.md'), true)
  assert.equal(isHistoricalRecord('docs/adr/README.md'), false, 'the ADR index is maintained, not a record')
  assert.equal(isHistoricalRecord('docs/architecture/engineering-specs.json'), false)
  assert.equal(isHistoricalRecord('docs/reports/system.html'), false)
})

test('the scan finds every sibling commit reference, with its file and line', () => {
  const root = fabric({ 'docs/a.md': `x\nsee ${url('alpha', PUB, 'spec.md', 3)} and https://github.com/passioncode-ai/fabric/blob/${'e'.repeat(40)}/x\nhttps://github.com/passioncode-ai/alpha/tree/${PUB.slice(0, 7)}\n` })
  const refs = scanReferences(root).filter((r) => r.file === 'docs/a.md')
  assert.deepEqual(refs.map((r) => [r.repository, r.commit, r.line]), [['alpha', PUB, 2], ['fabric', 'e'.repeat(40), 2], ['alpha', PUB.slice(0, 7), 3]])
})

test('a clean tree: public commits resolve, pre-publication history in records is NOT_CHECKED', () => {
  const root = fabric({
    'docs/guide.md': `live ${url('alpha', PUB, 'spec.md', 3)}\n`,
    'docs/audit/2026-09-09-x/a.md': `then ${url('alpha', OLD, 'spec.md', 2)}\n`,
    'docs/adr/0001-x.md': `accepted at ${url('alpha', OLD, 'spec.md', 2)}\n`,
    'docs/b.md': `private https://github.com/passioncode-ai/fabric-workspace/commit/${DEAD}\n`
  }, { items: [repinned()] })
  const r = check(root)
  assert.deepEqual(r.problems, [])
  assert.deepEqual(r.counts.alpha, { followed: 2, history: 2 }, 'the guide and the repinned receipt are followed; the record and the ADR are history')
  assert.deepEqual(r.counts['fabric-workspace'], { private: 1 })
  assert.equal(r.receipts.reread, 1)
})

test('a living document that cites pre-publication history is refused, URL or receipt', () => {
  const root = fabric({ 'docs/guide.md': `live ${url('alpha', OLD, 'spec.md', 2)}\n` }, { items: [{ ...receipt(), url: undefined }] })
  const problems = check(root).problems
  assert.equal(problems.length, 2)
  assert.match(problems[0], /docs\/guide\.md:1: alpha@.* is pre-publication history/)
  assert.match(problems[1], /docs\/model\.json .*spec\.md:2 still addresses pre-publication commit/)
})

test('an unknown dead commit is refused even in a dated record: the list is the only way past', () => {
  const root = fabric({ 'docs/audit/2026-09-09-x/a.md': `then ${url('alpha', DEAD, 'spec.md', 2)}\n` })
  assert.match(check(root).problems.join('\n'), /does not resolve in the public history of alpha/)
})

test('the list is closed: an entry added without moving the pinned digest is refused', () => {
  const root = fabric({})
  const grown = { alpha: { ...LIST.alpha, pre_publication: [OLD, DEAD] } }
  assert.match(check(root, { list: grown }).problems.join('\n'), /pre-publication list changed/)
  assert.deepEqual(siblingEntries(grown), ['alpha ' + DEAD, 'alpha ' + OLD].sort())
})

test('a listed commit that the public history has is refused: it can be checked', () => {
  const root = fabric({})
  const wrong = { alpha: { ...LIST.alpha, pre_publication: [PUB] } }
  assert.match(check(root, { list: wrong, digest: siblingDigest(wrong) }).problems.join('\n'), /listed as pre-publication .* but resolves/)
})

test('a repinned receipt is re-read at its public commit; a wrong excerpt or address is refused', () => {
  const r = repinned()
  const bad = (mutate) => { const x = structuredClone(r); mutate(x); return check(fabric({}, { items: [x] })).problems.join('\n') }
  assert.match(bad((x) => { x.excerpt = 'The rule MAY hold.' }), /does not say what it cites/)
  assert.match(bad((x) => { x.file_sha256 = sha256('other') }), /does not say what it cites/)
  assert.match(bad((x) => { x.url = url('alpha', PUB, 'spec.md', 2) }), /URL does not address/)
  assert.match(bad((x) => { x.repinned_from.rule = 'identical-bytes' }), /different content hash/)
})

test('offline, nothing is resolved and every unchecked reference is counted, never passed', () => {
  const root = fabric({ 'docs/guide.md': `live ${url('alpha', DEAD, 'spec.md', 3)}\n` })
  const r = check(root, { offline: true, remote: () => 'file:///nonexistent/x.git' })
  assert.deepEqual(r.problems, [])
  assert.deepEqual(r.counts.alpha, { offline: 1 })
})

test('an unreachable public history is a failure, not a pass', () => {
  const root = fabric({ 'docs/guide.md': `live ${url('alpha', PUB, 'spec.md', 3)}\n` })
  assert.match(check(root, { remote: () => 'file://' + path.join(tmp, 'missing.git') }).problems.join('\n'), /cannot read the public history of alpha/)
})

test('a sibling repin record names a listed commit, a new commit, and a consistent rule', () => {
  const r = repinned()
  assert.equal(siblingRepinProblem(r, LIST), null)
  assert.match(siblingRepinProblem({ ...r, repository: 'fabric' }, LIST), /needs the sibling repository/)
  assert.match(siblingRepinProblem({ ...r, repository: 'beta' }, LIST), /no publication record/)
  assert.match(siblingRepinProblem({ ...r, repinned_from: { ...r.repinned_from, commit: DEAD } }, LIST), /not a listed pre-publication commit/)
  assert.match(siblingRepinProblem({ ...r, commit: OLD }, LIST), /still addresses a pre-publication commit/)
  assert.match(siblingRepinProblem({ ...r, line: 2 }, LIST), /inconsistent line/)
})

test('repin: identical bytes are proved by the receipt\'s own hash; a moved claim moves; a changed one is refused', () => {
  const readTarget = (f) => { try { return git(work, 'show', PUB + ':' + f) + '\n' } catch { return null } }
  const same = receipt({ path: 'same.md', line: 1, file_sha256: sha256('unchanged\n'), excerpt: 'unchanged', url: url('alpha', OLD, 'same.md', 1) })
  assert.equal(repinSiblingReceipt(same, { readTarget, target: PUB }), 'repinned:identical-bytes')
  assert.deepEqual([same.commit, same.line, same.url], [PUB, 1, url('alpha', PUB, 'same.md', 1)])
  const moved = receipt()
  assert.equal(repinSiblingReceipt(moved, { readTarget, target: PUB }), 'repinned:cited-lines-moved')
  assert.deepEqual([moved.line, moved.file_sha256, moved.repinned_from.line], [3, sha256(SPEC_NEW), 2])
  for (const [r, why] of [[receipt({ excerpt: 'The rule MAY hold.' }), 'refused:claim-changed'], [receipt({ path: 'gone.md', excerpt: 'soon gone', line: 1 }), 'refused:file-gone'], [receipt({ excerpt: undefined }), 'refused:bytes-changed']]) {
    const before = structuredClone(r)
    assert.equal(repinSiblingReceipt(r, { readTarget, target: PUB }), why)
    assert.deepEqual(r, before, 'a refused receipt is left exactly as it was')
  }
})

test('the shipped list matches its pinned digest, and names only full or cited spellings', () => {
  assert.equal(siblingDigest(SIBLING_PUBLICATION), SIBLING_PRE_PUBLICATION_DIGEST)
  for (const e of siblingEntries(SIBLING_PUBLICATION)) assert.match(e, /^[a-z0-9.-]+ [0-9a-f]{7,40}$/)
})
