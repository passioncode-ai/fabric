#!/usr/bin/env node
// Every link into a SIBLING repository's commit opens something — or is history, said so.
//
// MEASURED BEFORE THIS (2026-10-01, a fresh clone of main at cd4d8e0): 197 links in tracked
// files addressed a commit of a sibling under github.com/passioncode-ai, and 180 of them
// opened nothing — fabric-agent-contract, fabric-inbox and fabric-vr had been re-created
// public with one new history, and `gh api repos/passioncode-ai/<repo>/commits/<sha>`
// answered 422 for 1eeb5a3, 4897370 and fabric-vr's 161d621. 109 of the dead links sat in
// LIVING documents and generated reports, where a reader follows them. No gate looked: the
// receipts are "retained", never fetched, so a link could die and every check stayed green.
//
// WHAT IT CHECKS, per reference found by scanReferences:
//   - a commit on the closed pre-publication list (scripts/lib/public-history.mjs,
//     SIBLING_PUBLICATION) is accepted only in a dated record or an ADR, and is printed
//     NOT_CHECKED with its count — never folded into "followed";
//   - in a living document such a commit is refused: re-read the evidence at a public commit
//     and re-point it (scripts/repin-sibling-receipts.mjs);
//   - any other commit of a public sibling must resolve in that sibling's public history,
//     read here from a fresh partial clone. A dead link is refused even in a dated record:
//     the list is the only way past, and the list is closed — its digest is pinned below;
//   - a listed commit that the public history HAS is refused: it can be checked;
//   - every sibling receipt in the living documents is re-read at its commit: file hash and
//     cited line. A repinned one must also carry a consistent `repinned_from`.
// Private siblings cannot be read from a public clone; their links are counted NOT_CHECKED.
//
// It needs the network, as the links it checks do. Unreachable is a failure, not a pass;
// `--offline` runs the structural half alone and counts everything else as NOT_CHECKED.
//
// Usage: node scripts/check-sibling-commits.mjs [--offline]

import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SIBLING_PUBLICATION, siblingDigest, siblingEntries, isSiblingPrePublication, isHistoricalRecord, siblingRepinProblem, sha256 } from './lib/public-history.mjs'
import { LINE_DOCUMENTS } from './repin-public-history.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
/** The digest of SIBLING_PUBLICATION's entries. It moves only with a reviewed change to the list. */
export const SIBLING_PRE_PUBLICATION_DIGEST = 'ef97324fb03a61cea05cb77286d19012383d2cf3431ccd3da8d1fa401f354d99'
/** Repositories a public clone cannot read (ADR-0048: the workspace is a private publication). */
export const PRIVATE_SIBLINGS = Object.freeze(['fabric-workspace', 'org-index'])
const URL_RE = /github\.com\/passioncode-ai\/([A-Za-z0-9._-]+)\/(blob|tree|commit)\/([0-9a-f]{7,40})(?![0-9a-zA-Z])/g
const HEX40 = /^[0-9a-f]{40}$/
const HEX64 = /^[0-9a-f]{64}$/
const defaultRemote = (repo) => 'https://github.com/passioncode-ai/' + repo + '.git'

/** Every commit link into a passioncode-ai repository, in the tracked files of `root`. */
export function scanReferences(root) {
  const ls = spawnSync('git', ['ls-files', '-s', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  if (ls.status !== 0) throw new Error('git ls-files failed in ' + root + ': ' + ls.stderr)
  const out = []
  for (const entry of ls.stdout.split('\0')) {
    const m = entry.match(/^(\d{6}) [0-9a-f]+ \d\t(.+)$/)
    if (!m || m[1] === '160000' || m[1] === '120000') continue // a submodule or a link is not a file of this tree
    let text
    try { text = readFileSync(path.join(root, m[2]), 'utf8') } catch { continue } // deleted in the work tree
    if (!text.includes('github.com/passioncode-ai/') || text.includes('\0')) continue
    text.split('\n').forEach((line, i) => {
      for (const u of line.matchAll(URL_RE)) out.push({ file: m[2], line: i + 1, repository: u[1], kind: u[2], commit: u[3] })
    })
  }
  return out
}

/** Every sibling line receipt inside a parsed document. */
function siblingReceipts(doc) {
  const out = []
  const walk = (v) => {
    if (!v || typeof v !== 'object') return
    if (Array.isArray(v)) return v.forEach(walk)
    if (typeof v.repository === 'string' && v.repository !== 'fabric' && typeof v.commit === 'string' && typeof (v.file ?? v.path) === 'string' && Number.isInteger(v.line)) out.push(v)
    for (const x of Object.values(v)) walk(x)
  }
  walk(doc)
  return out
}

/**
 * Runs the check. Every input is injectable so the tests can use fixture histories.
 * Returns {problems, counts: {repo: {followed?, history?, private?, offline?}}, receipts: {reread}}.
 */
export function checkSiblingCommits({ root = ROOT, list = SIBLING_PUBLICATION, digest = SIBLING_PRE_PUBLICATION_DIGEST, remote = defaultRemote, documents = LINE_DOCUMENTS, offline = false, privateRepos = PRIVATE_SIBLINGS } = {}) {
  const problems = [], counts = {}, receipts = { reread: 0 }
  const tally = (repo, key, n = 1) => { counts[repo] ??= {}; counts[repo][key] = (counts[repo][key] ?? 0) + n }

  // The list itself: well formed, and exactly the reviewed one.
  for (const [repo, s] of Object.entries(list)) {
    if (!HEX40.test(s.root || '')) problems.push('SIBLING_PUBLICATION.' + repo + '.root must be the full public root commit')
    for (const c of s.pre_publication) if (!/^[0-9a-f]{7,40}$/.test(c)) problems.push('SIBLING_PUBLICATION.' + repo + ': ' + c + ' is not a commit id')
  }
  const got = siblingDigest(list)
  if (got !== digest)
    problems.push('the sibling pre-publication list changed: ' + siblingEntries(list).length + ' entries with digest ' + got + ', and this gate pins ' + digest + '. The list is closed (scripts/lib/public-history.mjs): an entry added there is a dead link let through. Changing it is a reviewed decision, and SIBLING_PRE_PUBLICATION_DIGEST moves in the same change.')

  // Links, wherever they are.
  const wanted = new Map() // repo -> Map(commit -> [where])
  const want = (repo, commit, where) => {
    if (!wanted.has(repo)) wanted.set(repo, new Map())
    const m = wanted.get(repo)
    if (!m.has(commit)) m.set(commit, [])
    m.get(commit).push(where)
  }
  for (const ref of scanReferences(root)) {
    if (ref.repository === 'fabric') continue // Fabric's own history: scripts/lib/public-history.mjs
    const where = ref.file + ':' + ref.line
    if (isSiblingPrePublication(ref.repository, ref.commit, list)) {
      if (isHistoricalRecord(ref.file)) tally(ref.repository, 'history')
      else problems.push(where + ': ' + ref.repository + '@' + ref.commit.slice(0, 12) + ' is pre-publication history, and this is a living document. Re-read what it cites at a public commit and re-point it there (a receipt: scripts/repin-sibling-receipts.mjs).')
    } else if (privateRepos.includes(ref.repository)) tally(ref.repository, 'private')
    else if (offline) tally(ref.repository, 'offline')
    else want(ref.repository, ref.commit, where)
  }

  // Receipts in the living documents: addressed coherently, and re-read below.
  const rereads = []
  for (const doc of documents) {
    for (const r of siblingReceipts(JSON.parse(readFileSync(path.join(root, doc), 'utf8')))) {
      const file = r.file ?? r.path, repo = r.repository
      const where = doc + ' ' + repo + ' ' + file + ':' + r.line
      if (isSiblingPrePublication(repo, r.commit, list)) { problems.push(where + ' still addresses pre-publication commit ' + r.commit.slice(0, 12) + '; repin it (scripts/repin-sibling-receipts.mjs)'); continue }
      if (!HEX40.test(r.commit)) { problems.push(where + ': a receipt names its commit in full'); continue }
      const base = 'https://github.com/passioncode-ai/' + repo + '/blob/' + r.commit + '/' + file + '#L' + r.line
      if (r.url !== undefined && r.url !== base && r.url !== base + '-L' + r.end_line) problems.push(where + ': its URL does not address the receipt (' + r.url + ')')
      if (r.repinned_from !== undefined) { const p = siblingRepinProblem(r, list); if (p) problems.push(where + ': ' + p) }
      if (privateRepos.includes(repo) || offline) continue
      if (!HEX64.test(r.file_sha256 || '')) { problems.push(where + ': a receipt without its content hash cannot be re-read'); continue }
      rereads.push({ where, repo, commit: r.commit, file, line: r.line, sha: r.file_sha256, excerpt: r.excerpt })
    }
  }
  if (offline) return { problems, counts, receipts }

  // The network half: each sibling's public history, read once into a partial clone.
  const repos = new Set([...wanted.keys(), ...rereads.map((x) => x.repo), ...Object.entries(list).filter(([, s]) => s.pre_publication.length).map(([r]) => r)])
  const tmp = mkdtempSync(path.join(tmpdir(), 'fabric-sibling-history-'))
  try {
    for (const repo of repos) {
      if (privateRepos.includes(repo)) continue
      const dir = path.join(tmp, repo + '.git')
      const env = { ...process.env, GIT_TERMINAL_PROMPT: '0' }
      const clone = spawnSync('git', ['clone', '--quiet', '--bare', '--filter=blob:none', remote(repo), dir], { encoding: 'utf8', env })
      if (clone.status !== 0) { problems.push('cannot read the public history of ' + repo + ' (' + (clone.stderr || clone.error?.message || 'git clone failed').trim().split('\n').pop() + '); its references are not checked. --offline runs the structural half alone.'); continue }
      const g = (...a) => spawnSync('git', ['-C', dir, ...a], { encoding: 'utf8', env, maxBuffer: 32 * 1024 * 1024 })
      const resolves = (c) => g('rev-parse', '--verify', '--quiet', c + '^{commit}').status === 0
      for (const [commit, wheres] of wanted.get(repo) ?? []) {
        if (resolves(commit)) tally(repo, 'followed', wheres.length)
        else problems.push(repo + '@' + commit + ' does not resolve in the public history of ' + repo + ' — a dead link, at ' + wheres.slice(0, 3).join(', ') + (wheres.length > 3 ? ' and ' + (wheres.length - 3) + ' more' : '') + '. In a living document, re-point it after re-reading what it cites; pre-publication history in a dated record is a reviewed addition to the closed list.')
      }
      for (const c of list[repo]?.pre_publication ?? [])
        if (resolves(c)) problems.push(repo + ' ' + c + ' is listed as pre-publication history, but resolves in the public history of ' + repo + '; it can be checked — remove it from the list')
      for (const x of rereads.filter((x) => x.repo === repo)) {
        const shown = g('show', x.commit + ':' + x.file)
        const lines = shown.status === 0 ? shown.stdout.split('\n') : null
        const claim = typeof x.excerpt === 'string' ? x.excerpt.split('\n') : null
        const holds = lines && sha256(shown.stdout) === x.sha && (!claim || claim.every((c, i) => lines[x.line - 1 + i] === c))
        if (holds) receipts.reread++
        else problems.push(x.where + ' does not say what it cites at ' + x.commit.slice(0, 12) + (lines ? ' (content hash or cited line differs)' : ' (the file or the commit is not there)'))
      }
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
  return { problems, counts, receipts }
}

function main() {
  const offline = process.argv.includes('--offline')
  const { problems, counts, receipts } = checkSiblingCommits({ offline })
  for (const [repo, c] of Object.entries(counts).sort()) {
    if (c.followed) console.log('ok: ' + c.followed + ' link(s) into ' + repo + ' resolve in its public history')
    if (c.history) console.log('NOT_CHECKED: ' + c.history + ' link(s) into ' + repo + ' name pre-publication commits, in dated records and ADRs (closed list, scripts/lib/public-history.mjs). That history is gone; nothing here followed them.')
    if (c.private) console.log('NOT_CHECKED: ' + c.private + ' link(s) into ' + repo + ', which is private; a public clone cannot read it')
    if (c.offline) console.log('NOT_CHECKED: ' + c.offline + ' link(s) into ' + repo + ' — --offline, nothing was resolved')
  }
  if (!offline) console.log('ok: ' + receipts.reread + ' sibling receipt(s) re-read at their commit (content hash and cited line)')
  if (problems.length) {
    console.error('sibling commits: ' + problems.length + ' problem(s)')
    for (const p of problems) console.error('  ' + p)
    process.exit(1)
  }
  console.log('PASS: sibling commit links' + (offline ? ' (structural half only — offline)' : ''))
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
