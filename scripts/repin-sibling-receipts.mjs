#!/usr/bin/env node
// Move receipts that address a SIBLING repository's pre-publication commit onto a commit of
// its public history — or refuse, per receipt, when the evidence no longer holds there.
//
// WHY. fabric-agent-contract, fabric-inbox and fabric-vr were re-created public with one new
// history (scripts/lib/public-history.mjs, "Sibling repositories"). A receipt in a living
// document that still addresses the old commit is a link that opens nothing, and a receipt
// is a claim about bytes, so its hash is not simply swapped. Each one is re-read at the
// public commit under the rules Fabric's own repin uses (REPIN_RULES):
//
//   identical-bytes        the file at the public commit hashes to the receipt's own
//                          file_sha256. That hash was taken from the bytes the research read,
//                          so equality proves identity without the old objects.
//   cited-lines-unchanged  the bytes differ and the excerpt still stands at its line.
//   cited-lines-moved      the excerpt occurs EXACTLY ONCE, at another line.
//   otherwise              refused: file gone, claim changed or ambiguous, or a changed file
//                          whose receipt carries no excerpt to look for. Nothing is written;
//                          a claim that moved under the evidence needs a person to read it
//                          again, which a tool cannot do.
//
// Dated records keep their addresses; this rewrites only the living documents
// (LINE_DOCUMENTS). scripts/check-sibling-commits.mjs re-reads every repinned receipt at its
// new commit on every run, so this tool's result is checked, not trusted.
//
// Usage: node scripts/repin-sibling-receipts.mjs --repository <repo> --git-dir <clone> --commit <sha> [--check]
//   <clone>   a clone of the sibling's PUBLIC repository (origin must be it)
//   <sha>     the full public commit to re-read at; it must be on one of the clone's refs
//   --check   report what would change, exit 1 if anything would; write nothing

import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SIBLING_PUBLICATION, locateClaim, sha256 } from './lib/public-history.mjs'
import { LINE_DOCUMENTS, repinUrl } from './repin-public-history.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const HEX40 = /^[0-9a-f]{40}$/
const HEX64 = /^[0-9a-f]{64}$/

/** Every line receipt of `repo` inside a parsed document, wherever it sits. */
export function siblingLineReceipts(doc, repo) {
  const out = []
  const walk = (v) => {
    if (!v || typeof v !== 'object') return
    if (Array.isArray(v)) return v.forEach(walk)
    if (v.repository === repo && HEX40.test(v.commit || '') && typeof (v.file ?? v.path) === 'string' && Number.isInteger(v.line)) out.push(v)
    for (const x of Object.values(v)) walk(x)
  }
  walk(doc)
  return out
}

/**
 * Re-read one sibling receipt at `target`. `readTarget(file)` returns the file's text at the
 * public commit, or null when it is absent there. Mutates the receipt only when it repins;
 * returns 'repinned:<rule>' or 'refused:<reason>'.
 */
export function repinSiblingReceipt(r, { readTarget, target }) {
  const file = r.file ?? r.path
  if (!HEX64.test(r.file_sha256 || '')) throw new Error(file + ':' + r.line + ' carries no content hash; there is nothing to re-read it against')
  const after = readTarget(file)
  if (after === null) return 'refused:file-gone'
  let rule, line = r.line
  if (sha256(after) === r.file_sha256) rule = 'identical-bytes'
  else {
    // Without the old bytes, only the excerpt says what the research read.
    if (typeof r.excerpt !== 'string') return 'refused:bytes-changed'
    const found = locateClaim(after.split('\n'), r.excerpt.split('\n'), r.line)
    if (!found.line) return 'refused:' + (found.hits === 0 ? 'claim-changed' : 'claim-ambiguous')
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

function main() {
  const args = process.argv.slice(2)
  const arg = (name) => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1] }
  const repo = arg('--repository'), dir = arg('--git-dir') && path.resolve(arg('--git-dir')), target = arg('--commit')
  const fail = (message) => { console.error(message); process.exit(2) }
  if (!repo || !dir || !target) fail('usage: node scripts/repin-sibling-receipts.mjs --repository <repo> --git-dir <clone> --commit <sha> [--check]')
  const record = SIBLING_PUBLICATION[repo]
  if (!record) fail(repo + ' has no publication record in scripts/lib/public-history.mjs; nothing of it is pre-publication')
  if (!HEX40.test(target)) fail('--commit must be a full commit')
  if (record.pre_publication.includes(target)) fail(target + ' is itself a listed pre-publication commit of ' + repo)
  const g = (...a) => spawnSync('git', ['-C', dir, ...a], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
  const origin = g('remote', 'get-url', 'origin')
  if (origin.status !== 0 || !new RegExp('[/:]passioncode-ai/' + repo.replace(/[.]/g, '\\.') + '(\\.git)?/?$').test(origin.stdout.trim())) fail(dir + ' is not a clone of passioncode-ai/' + repo + ' (origin: ' + (origin.stdout.trim() || origin.stderr.trim()) + ')')
  if (g('cat-file', '-e', target + '^{commit}').status !== 0) fail(dir + ' does not hold ' + target)
  if (!g('for-each-ref', '--contains', target, '--format=%(refname)').stdout.trim()) fail(target + ' is on no ref of ' + dir + '; it is not part of the public history')
  const readTarget = (file) => { const r = g('show', target + ':' + file); return r.status === 0 ? r.stdout : null }

  const counts = {}, refused = [], writes = []
  for (const p of LINE_DOCUMENTS) {
    const raw = readFileSync(path.join(ROOT, p), 'utf8')
    const doc = JSON.parse(raw)
    if (JSON.stringify(doc, null, 2) + '\n' !== raw) throw new Error(p + ' does not round-trip; refusing to rewrite it')
    let changed = 0
    for (const r of siblingLineReceipts(doc, repo)) {
      if (!record.pre_publication.includes(r.commit)) continue
      const where = p + ' ' + (r.file ?? r.path) + ':' + r.line
      const state = repinSiblingReceipt(r, { readTarget, target })
      counts[p] ??= {}
      counts[p][state] = (counts[p][state] ?? 0) + 1
      if (state.startsWith('refused:')) refused.push(where + ' — ' + state.slice(8))
      else changed++
    }
    if (changed) writes.push([p, doc])
  }
  console.log(JSON.stringify(counts, null, 2))
  if (refused.length) {
    console.error(refused.length + ' receipt(s) do not hold at ' + target.slice(0, 12) + '; nothing was written. Re-read each claim against the current file:')
    for (const x of refused) console.error('  ' + x)
    process.exit(1)
  }
  if (args.includes('--check')) process.exit(writes.length ? 1 : 0)
  for (const [p, doc] of writes) writeFileSync(path.join(ROOT, p), JSON.stringify(doc, null, 2) + '\n')
  console.log('wrote ' + (writes.length ? writes.map(([p]) => p).join(', ') : 'nothing'))
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
