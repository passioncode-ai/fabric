#!/usr/bin/env node
// Move commit-addressed receipts from the pre-publication history onto this one — or
// say, per receipt, that the evidence no longer holds.
//
// WHY. The public history (scripts/lib/public-history.mjs) shares no object with the
// one the receipts were written against, so every gate that re-reads a receipt failed on
// a fresh clone. Swapping the hash would be the fast fix and the wrong one: a receipt is
// a claim about bytes, and the bytes at the new address are not always the ones that
// were read. So each receipt is RE-READ, against both histories, under three rules:
//
//   1. identical-bytes        the file at PUBLIC_ROOT equals the file at the old commit;
//                             the evidence is literally the same. Repinned.
//   2. cited-lines-unchanged  the bytes differ, and the cited lines (the excerpt, or the
//                             cited span when there is none) say the same thing at the
//                             same place. Repinned with the new content hash.
//      cited-lines-moved      the cited text occurs EXACTLY ONCE, elsewhere — the rule
//                             repin-mockup-receipts.mjs already applies to mockup
//                             receipts. Repinned with the new line.
//   otherwise                 stale: gone, changed, or ambiguous. The receipt keeps its
//                             original address as a record and says so; it is never
//                             passed off as current.
//
// A document pinned to ONE commit (the adoption bindings) is re-validated as a whole by
// its own checker at the new commit. The operator plan's baseline carries the line
// citations of a DATED audit, which records a moment and is not rewritten; it gets the
// documented pre-publication state instead (rule 3 of the cutover).
//
// The pre-publication objects are needed only to RUN this, never to check its result:
// pass a repository that holds them (a clone fetched from the archived bundle). Nothing
// is ever read from that repository into a document except what was already there.
//
// Usage: node scripts/repin-public-history.mjs --old-git-dir <dir> [--check]
//        node scripts/repin-public-history.mjs --summary
//   --check    report what would change and exit 1 if anything would; write nothing.
//   --summary  count each receipt state in the documents; needs no old objects.

import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PUBLIC_ROOT, STALE, history, locateClaim, claimOf, sha256 } from './lib/public-history.mjs'
import { validateBindings, committedReader } from './check-adoption-bindings.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const LINE_DOCUMENTS = ['docs/ux/product-model.json', 'docs/architecture/system-model.json', 'docs/architecture/engineering-specs.json']
export const PLAN = 'docs/launch/adoption/plan.json'
export const BINDINGS = 'docs/launch/adoption/contract-bindings.json'
export const OPERATOR_PLAN = 'docs/launch/operator-plan.json'
const HEX40 = /^[0-9a-f]{40}$/

/** Every line receipt of THIS repository inside a parsed document, wherever it sits. */
export function lineReceipts(doc) {
  const out = []
  const walk = (v) => {
    if (!v || typeof v !== 'object') return
    if (Array.isArray(v)) return v.forEach(walk)
    const file = v.file ?? v.path
    if (HEX40.test(v.commit || '') && typeof file === 'string' && Number.isInteger(v.line) && (v.repository ?? 'fabric') === 'fabric' && v.verification !== 'retained-sibling-receipt') out.push(v)
    for (const x of Object.values(v)) walk(x)
  }
  walk(doc)
  return out
}

export const repinUrl = (url, from, to, line) => {
  if (typeof url !== 'string') return url
  const next = url.replace('/blob/' + from + '/', '/blob/' + to + '/').replace(/#L\d+$/, '#L' + line)
  if (next === url && from !== to) throw new Error('URL does not address its receipt: ' + url)
  return next
}

/**
 * Re-read one line receipt. `oldBlob(commit, file)` reads the pre-publication history,
 * `now` is this repository's reader. Mutates the receipt; returns the state it ends in.
 */
export function repinLineReceipt(r, { oldBlob, now, target = PUBLIC_ROOT }) {
  const file = r.file ?? r.path
  const before = oldBlob(r.commit, file)
  if (before === null) throw new Error(file + ' is absent at ' + r.commit + ' — the receipt cannot be re-read')
  if (sha256(before) !== r.file_sha256) throw new Error(file + ' at ' + r.commit.slice(0, 12) + ' does not hash to its receipt — it was broken before the cutover')
  const claim = claimOf(r, before)
  const own = locateClaim(before.split('\n'), claim, r.line)
  if (own.line !== r.line || own.moved) throw new Error(file + ':' + r.line + ' — the excerpt is not at its cited line even at ' + r.commit.slice(0, 12))
  const after = now.readBlob(target, file)
  const stale = (reason) => {
    r.verification = STALE
    r.stale = { since: target, reason }
    return 'stale:' + reason
  }
  if (after === null) return stale('file-gone')
  let rule, line = r.line
  if (after === before) rule = 'identical-bytes'
  else {
    const found = locateClaim(after.split('\n'), claim, r.line)
    if (!found.line) return stale(found.hits === 0 ? 'claim-changed' : 'claim-ambiguous')
    rule = found.moved ? 'cited-lines-moved' : 'cited-lines-unchanged'
    line = found.line
  }
  const from = { commit: r.commit, line: r.line, ...(r.end_line !== undefined ? { end_line: r.end_line } : {}), file_sha256: r.file_sha256, rule }
  const delta = line - r.line
  r.url = repinUrl(r.url, r.commit, target, line)
  r.commit = target
  r.line = line
  if (r.end_line !== undefined) r.end_line += delta
  r.file_sha256 = sha256(after)
  r.repinned_from = from
  return 'repinned:' + rule
}

/** Re-read one whole-file pin {commit, path, sha256}. */
export function repinFilePin(s, { oldBlob, now, target = PUBLIC_ROOT }) {
  const before = oldBlob(s.commit, s.path)
  if (before === null) throw new Error(s.path + ' is absent at ' + s.commit + ' — the pin cannot be re-read')
  if (sha256(before) !== s.sha256) throw new Error(s.path + ' at ' + s.commit.slice(0, 12) + ' does not hash to its pin — it was broken before the cutover')
  const after = now.readBlob(target, s.path)
  if (after === before) {
    s.repinned_from = { commit: s.commit, file_sha256: s.sha256, rule: 'identical-bytes' }
    s.commit = target
    return 'repinned:identical-bytes'
  }
  s.verification = STALE
  s.stale = { since: target, reason: after === null ? 'file-gone' : 'bytes-changed' }
  return 'stale:' + s.stale.reason
}

/** The bindings are one claim about one commit: its own checker decides at the new one. */
export function repinBindings(doc, { root = ROOT, target = PUBLIC_ROOT } = {}) {
  const old = doc.sourceCommit
  try {
    validateBindings({ ...doc, sourceCommit: target }, { readBlob: committedReader(root, target) })
  } catch (error) {
    doc.sourceHistory = { state: STALE, since: target, reason: error.message }
    return 'stale:bindings'
  }
  doc.sourceCommit = target
  doc.sourceHistory = { state: 'repinned', from: old, rule: 'bindings-revalidated' }
  return 'repinned:bindings-revalidated'
}

/** Counts, per document, the state every receipt is in. Reads no git object. */
export function summary(root = ROOT) {
  const now = history(root)
  const json = (p) => JSON.parse(readFileSync(path.join(root, p), 'utf8'))
  const out = {}
  const tally = (doc, key) => { out[doc] ??= {}; out[doc][key] = (out[doc][key] ?? 0) + 1 }
  for (const doc of LINE_DOCUMENTS)
    for (const r of lineReceipts(json(doc))) tally(doc, r.verification === STALE ? 'stale:' + r.stale?.reason : r.repinned_from ? 'repinned:' + r.repinned_from.rule : now.inHistory(r.commit) ? 'in-history' : 'UNRESOLVED')
  for (const p of json(PLAN).packets) for (const s of p.baseline_sources) tally(PLAN, s.verification === STALE ? 'stale:' + s.stale?.reason : s.repinned_from ? 'repinned:' + s.repinned_from.rule : now.inHistory(s.commit) ? 'in-history' : 'UNRESOLVED')
  const b = json(BINDINGS)
  tally(BINDINGS, b.sourceHistory ? b.sourceHistory.state : now.inHistory(b.sourceCommit) ? 'in-history' : 'UNRESOLVED')
  const o = json(OPERATOR_PLAN)
  tally(OPERATOR_PLAN, o.baseline_history ? o.baseline_history.state : now.inHistory(o.baseline) ? 'in-history' : 'UNRESOLVED')
  return out
}

function main() {
  const args = process.argv.slice(2)
  if (args.includes('--summary')) {
    const s = summary()
    console.log(JSON.stringify(s, null, 2))
    const unresolved = Object.values(s).reduce((n, d) => n + (d.UNRESOLVED ?? 0), 0)
    if (unresolved) console.error(unresolved + ' receipt(s) address a commit outside this history and carry no state')
    process.exit(unresolved ? 1 : 0)
  }
  const checkOnly = args.includes('--check')
  const i = args.indexOf('--old-git-dir')
  if (i < 0 || !args[i + 1]) {
    console.error('usage: node scripts/repin-public-history.mjs --old-git-dir <dir> [--check] | --summary')
    process.exit(2)
  }
  const oldDir = path.resolve(args[i + 1])
  const oldCache = new Map()
  const oldBlob = (commit, file) => {
    const key = commit + ':' + file
    if (!oldCache.has(key)) {
      const c = spawnSync('git', ['-C', oldDir, 'cat-file', '-e', commit + '^{commit}'])
      if (c.status !== 0) throw new Error('The old repository ' + oldDir + ' does not hold ' + commit)
      const r = spawnSync('git', ['-C', oldDir, 'show', key], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
      oldCache.set(key, r.status === 0 ? r.stdout : null)
    }
    return oldCache.get(key)
  }
  const now = history(ROOT)
  const counts = {}
  const count = (doc, state) => { counts[doc] ??= {}; counts[doc][state] = (counts[doc][state] ?? 0) + 1 }
  const writes = []
  const load = (p) => { const raw = readFileSync(path.join(ROOT, p), 'utf8'); const doc = JSON.parse(raw); if (JSON.stringify(doc, null, 2) + '\n' !== raw) throw new Error(p + ' does not round-trip; refusing to rewrite it'); return doc }
  for (const p of LINE_DOCUMENTS) {
    const doc = load(p)
    let changed = 0
    for (const r of lineReceipts(doc)) {
      if (r.verification === STALE || r.repinned_from || now.inHistory(r.commit)) continue
      count(p, repinLineReceipt(r, { oldBlob, now }))
      changed++
    }
    if (changed) writes.push([p, doc])
  }
  const plan = load(PLAN)
  let planChanged = 0
  for (const packet of plan.packets)
    for (const s of packet.baseline_sources) {
      if (s.verification === STALE || s.repinned_from || now.inHistory(s.commit)) continue
      count(PLAN, repinFilePin(s, { oldBlob, now }))
      planChanged++
    }
  if (planChanged) writes.push([PLAN, plan])
  const bindings = load(BINDINGS)
  if (!bindings.sourceHistory && !now.inHistory(bindings.sourceCommit)) {
    // It must have held where it was written, or there is nothing to move.
    validateBindings(bindings, { readBlob: committedReader(oldDir, bindings.sourceCommit) })
    count(BINDINGS, repinBindings(bindings))
    writes.push([BINDINGS, bindings])
  }
  const operator = load(OPERATOR_PLAN)
  if (!operator.baseline_history && !now.inHistory(operator.baseline)) {
    operator.baseline_history = { state: 'pre-publication', reason: 'The baseline addresses the pre-publication history. Its line citations belong to the dated audit ' + operator.audit + ', which records a moment and is not rewritten; they are not resolved in this history.' }
    count(OPERATOR_PLAN, 'pre-publication')
    writes.push([OPERATOR_PLAN, operator])
  }
  console.log(JSON.stringify(counts, null, 2))
  if (checkOnly) process.exit(writes.length ? 1 : 0)
  for (const [p, doc] of writes) writeFileSync(path.join(ROOT, p), JSON.stringify(doc, null, 2) + '\n')
  console.log('wrote ' + writes.map(([p]) => p).join(', ') + (writes.length ? '' : 'nothing'))
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
