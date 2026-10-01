// Commit-addressed receipts across the public re-creation of this repository's history.
//
// WHAT HAPPENED. On 2026-09-30 passioncode-ai/fabric was re-created as a public
// repository with ONE history. Its root commit PUBLIC_ROOT has a tree identical to
// the last commit of the earlier, private history (PRE_PUBLICATION_TIP, tree
// 94d00b2c88a46aab00833a04de437fb5da7946a6 on both). A fresh clone carries no object
// of the earlier history, so every receipt that addressed a commit of it — a
// 40-hex commit plus a file, a line and a content hash — stopped resolving, and the
// gates that read them failed on the first `git show`.
//
// A receipt from that history is therefore in exactly one of three states, and this
// module is the one place that says what each state has to prove:
//
//   verified here  the commit is an ancestor of HEAD and the owning gate re-reads
//                  its bytes, exactly as before.
//   repinned       the evidence was re-read at a commit of THIS history and still
//                  holds. `repinned_from` keeps the address it was first verified at
//                  and the rule that moved it (REPIN_RULES). The owning gate verifies
//                  the new address like any other.
//   stale          the evidence does not hold at `stale.since`, a commit of this
//                  history. The receipt keeps its original address and content hash
//                  as a record, is marked `verification: "stale-pre-publication"`,
//                  and counts as NOTHING verified. `staleProblem` re-proves the
//                  staleness mechanically, so evidence that still holds cannot be
//                  parked here to avoid the work of repinning it.
//
// "In this history" means "an ancestor of HEAD", not "an object this clone has":
// the operator's older checkouts still hold the pre-publication objects, and a gate
// must answer the same way there as on a fresh clone. It needs the full history —
// a shallow clone cannot answer and the gate says so rather than guessing.
//
// scripts/repin-public-history.mjs applies these states to the documents; the
// owning gates (check-product-model, check-system-model, check-adoption-plan,
// check-adoption-bindings, check-operator-plan) verify them. Commits of SIBLING
// repositories follow the same three states by a closed list instead of ancestry
// (SIBLING_PUBLICATION below; scripts/check-sibling-commits.mjs).

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'

export const PUBLIC_ROOT = '03311c856b7771e5e4cfff967b138e89e292c67f'
export const PRE_PUBLICATION_TIP = '33667dfd2da948e6ff55d0ddc61f6e669b74b403'
export const STALE = 'stale-pre-publication'
/** identical-bytes: the file's bytes at the new commit equal those at the old one.
 *  cited-lines-unchanged: the bytes differ, the cited lines still say the same thing.
 *  cited-lines-moved: the cited text occurs exactly once, at another line. */
export const REPIN_RULES = ['identical-bytes', 'cited-lines-unchanged', 'cited-lines-moved']
/** file-gone: the file does not exist at `since`. claim-changed: the cited text occurs
 *  nowhere in it. claim-ambiguous: it occurs more than once, and two matches cannot say
 *  which one the reviewer read. bytes-changed: a whole-file pin whose bytes differ. */
export const STALE_REASONS = ['file-gone', 'claim-changed', 'claim-ambiguous', 'bytes-changed']

const HEX40 = /^[0-9a-f]{40}$/
const HEX64 = /^[0-9a-f]{64}$/
export const sha256 = (text) => createHash('sha256').update(text).digest('hex')

/** A reader over one repository: ancestry and committed blobs, both cached. */
export function history(root) {
  const ancestry = new Map()
  const blobs = new Map()
  const inHistory = (commit) => {
    if (!HEX40.test(commit || '')) return false
    if (!ancestry.has(commit)) {
      const r = spawnSync('git', ['merge-base', '--is-ancestor', commit, 'HEAD'], { cwd: root, encoding: 'utf8' })
      // 0: ancestor. 1: a known commit that is not one. 128: an object this clone lacks.
      if (r.status !== 0 && r.status !== 1 && r.status !== 128) throw new Error('git merge-base could not answer for ' + commit + ': ' + (r.stderr || r.error?.message || r.status))
      if (r.status === 128 && commit === PUBLIC_ROOT) throw new Error('The public root ' + PUBLIC_ROOT + ' is missing: this clone is shallow or not of passioncode-ai/fabric. Fetch the full history (git fetch --unshallow).')
      ancestry.set(commit, r.status === 0)
    }
    return ancestry.get(commit)
  }
  /** Committed text of `file` at `commit`, or null when the path is absent there. The commit
   *  itself must be in this history — an absent commit is an error, never an absent file. */
  const readBlob = (commit, file) => {
    const key = commit + ':' + file
    if (!blobs.has(key)) {
      if (!inHistory(commit)) throw new Error('Commit ' + commit + ' is not in this history; it cannot be read for ' + file)
      const r = spawnSync('git', ['show', key], { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
      blobs.set(key, r.status === 0 ? r.stdout : null)
    }
    return blobs.get(key)
  }
  return { inHistory, readBlob }
}

/**
 * Where does a claim — one or more consecutive lines — stand in `lines`?
 * {line}             at the cited line (1-based), unchanged.
 * {line, moved:true} exactly once, somewhere else.
 * {hits}             0 (gone) or more than one (ambiguous) — never a guess.
 */
export function locateClaim(lines, claim, line) {
  const k = claim.length
  if (!k) return { hits: 0 }
  const at = (i) => i >= 0 && i + k <= lines.length && claim.every((c, j) => lines[i + j] === c)
  if (at(line - 1)) return { line }
  const hits = []
  for (let i = 0; i + k <= lines.length; i++) if (at(i)) hits.push(i + 1)
  return hits.length === 1 ? { line: hits[0], moved: true } : { hits: hits.length }
}

/** The receipt's own claim: its excerpt when it carries one, else the cited span of `text`. */
export function claimOf({ excerpt, line, end_line }, text) {
  if (typeof excerpt === 'string') return excerpt.split('\n')
  return text.split('\n').slice(line - 1, end_line || line)
}

/**
 * Checks one `repinned_from` record against the receipt that carries it. `sha` is the
 * receipt's current content hash. Returns a problem string, or null.
 */
export function repinProblem(receipt, { sha, inHistory }) {
  const from = receipt.repinned_from
  if (!from || typeof from !== 'object') return 'repinned_from must be an object'
  if (!HEX40.test(from.commit || '')) return 'repinned_from.commit must be a full commit'
  if (inHistory(from.commit)) return 'repinned_from.commit ' + from.commit + ' is in this history; the receipt needs no repin'
  return ruleProblem(receipt, from, sha)
}

/** The rule half of a repin record, shared by Fabric's own receipts and its siblings'. */
function ruleProblem(receipt, from, sha) {
  if (!REPIN_RULES.includes(from.rule)) return 'unknown repin rule ' + from.rule
  if (!HEX64.test(from.file_sha256 || '')) return 'repinned_from.file_sha256 must be a sha256'
  if (from.rule === 'identical-bytes' && from.file_sha256 !== sha) return 'identical-bytes repin with a different content hash'
  if (from.rule !== 'identical-bytes' && from.file_sha256 === sha) return from.rule + ' repin whose bytes did not change'
  if (receipt.line !== undefined || from.line !== undefined) {
    if (!Number.isInteger(from.line) || from.line < 1) return 'repinned_from.line must be a line'
    if (from.rule === 'cited-lines-moved' ? from.line === receipt.line : from.line !== receipt.line) return from.rule + ' repin with an inconsistent line'
  }
  return null
}

/**
 * Re-proves that a receipt marked stale really is stale at `stale.since`. Normalised input:
 * {commit, file, sha, line?, end_line?, excerpt?, stale:{since, reason}}. Returns a problem
 * string, or null. A receipt without an excerpt can be shown only to have CHANGED BYTES; the
 * text it cited lived in the earlier history, which this repository does not carry.
 */
export function staleProblem(r, { inHistory, readBlob }) {
  if (!HEX40.test(r.commit || '')) return 'stale receipt without a full commit'
  if (inHistory(r.commit)) return 'commit ' + r.commit + ' is in this history; verify the receipt instead of marking it stale'
  if (!HEX64.test(r.sha || '')) return 'stale receipt without its original content hash'
  const s = r.stale
  if (!s || typeof s !== 'object' || !HEX40.test(s.since || '') || !inHistory(s.since)) return 'stale.since must be a commit of this history'
  if (!STALE_REASONS.includes(s.reason)) return 'unknown stale reason ' + s.reason
  const text = readBlob(s.since, r.file)
  if (s.reason === 'file-gone') return text === null ? null : r.file + ' exists at ' + s.since.slice(0, 12) + '; it is not gone'
  if (text === null) return r.file + ' is absent at ' + s.since.slice(0, 12) + '; the reason is file-gone'
  if (sha256(text) === r.sha) return r.file + ' is byte-identical at ' + s.since.slice(0, 12) + '; repin it (identical-bytes) instead'
  const lineReceipt = r.line !== undefined
  if (s.reason === 'bytes-changed') return lineReceipt ? 'bytes-changed is for whole-file pins; a line receipt names what its line says' : null
  if (!lineReceipt) return s.reason + ' needs a cited line'
  if (typeof r.excerpt !== 'string') return null
  const found = locateClaim(text.split('\n'), r.excerpt.split('\n'), r.line)
  if (found.line) return 'the cited text still occurs exactly once in ' + r.file + ' at ' + s.since.slice(0, 12) + ' (line ' + found.line + '); repin it instead'
  if (s.reason === 'claim-changed' && found.hits !== 0) return 'claim-changed, but the cited text occurs ' + found.hits + ' times'
  if (s.reason === 'claim-ambiguous' && found.hits < 2) return 'claim-ambiguous, but the cited text occurs ' + found.hits + ' times'
  return null
}

/** A dated record — an audit, a dated plan or report — records a moment and is never rewritten
 *  to match a later tree (CLAUDE.md, "Dated documents"). Its path carries the date. */
export const isDatedRecord = (file) => typeof file === 'string' && /(^|\/)\d{4}-\d{2}-\d{2}(?=[-./]|$)/.test(file)

/** History, in the sense the cutover rules use it: a dated record, or an ADR — append-only,
 *  never edited (AGENTS.md, rule 2). The ADR index beside them is maintained, so it is not. */
export const isHistoricalRecord = (file) => isDatedRecord(file) || /^docs\/adr\/\d{4}-[^/]+\.md$/.test(file)

// SIBLING REPOSITORIES. On 2026-09-30 and 2026-10-01 three sibling repositories were re-created
// public the same way Fabric was: ONE orphan root whose tree equals a commit of the earlier,
// private main (measured 2026-10-01 against a checkout that still holds the old objects:
// fabric-agent-contract ebcf11f = e3449f7, fabric-vr 2536a3d = a930f59). Their earlier commits
// are gone from GitHub — `gh api repos/passioncode-ai/<repo>/commits/<sha>` answers 422 "No
// commit found" — and, unlike Fabric's own, this repository never held their objects, so
// "an ancestor of HEAD" cannot answer for them. Their third state is therefore a CLOSED LIST,
// the shape fabric-vr gave its own dead references (its DEC-0101):
//
//   pre-publication  a commit listed below, spelled as the documents cite it. A reference to it
//                    is history: accepted in a dated record or an ADR (isHistoricalRecord),
//                    printed NOT_CHECKED, never counted as followed. In a living document it is
//                    refused: the evidence is re-read at a public commit and repinned
//                    (scripts/repin-sibling-receipts.mjs), or the link is re-pointed by hand
//                    after the same reading.
//   repinned         a sibling receipt re-read at a public commit; `repinned_from` keeps the
//                    listed address and the rule (REPIN_RULES), checked by siblingRepinProblem.
//   public           any other commit. scripts/check-sibling-commits.mjs resolves it against
//                    the sibling's public history and refuses one that does not resolve.
//
// The list is CLOSED: check-sibling-commits.mjs pins the digest of its entries (siblingDigest),
// so an entry cannot be added in the same breath as the dead link it would let through. Adding
// one is a reviewed change to two files, and the gate refuses an entry the public history has.
// `root` is the public root, recorded for the reader; nothing is decided by it.
export const SIBLING_PUBLICATION = Object.freeze({
  'fabric-agent-contract': Object.freeze({
    root: 'ebcf11fe8749a4d1218e7671571d4140e3961229',
    pre_publication: Object.freeze(['1eeb5a302518a25af4c3ef82f1942aa3288bc9b9', '489737051828fafec92463df04b6a6fd3280c7b7'])
  }),
  'fabric-inbox': Object.freeze({ root: 'a9f9516e344a8f700084a1a4aaef86214e062f66', pre_publication: Object.freeze([]) }),
  'fabric-vr': Object.freeze({ root: '2536a3d1d184bcf38c559c7d16fe3dd00531d3fa', pre_publication: Object.freeze(['161d621']) })
})

/** "<repository> <commit>" per listed entry, sorted: what the pinned digest is taken over. */
export const siblingEntries = (list = SIBLING_PUBLICATION) =>
  Object.entries(list).flatMap(([repo, s]) => s.pre_publication.map((c) => repo + ' ' + c)).sort()
export const siblingDigest = (list = SIBLING_PUBLICATION) => sha256(siblingEntries(list).join('\n') + '\n')
export const isSiblingPrePublication = (repo, commit, list = SIBLING_PUBLICATION) => !!list[repo]?.pre_publication.includes(commit)

/**
 * Checks the `repinned_from` record of a SIBLING receipt: it moved off a listed pre-publication
 * commit, onto a full commit that is not listed, under a rule consistent with its hash and line.
 * Whether the new commit resolves, and still says what the receipt quotes, is the gate's network
 * half (scripts/check-sibling-commits.mjs). Returns a problem string, or null.
 */
export function siblingRepinProblem(receipt, list = SIBLING_PUBLICATION) {
  const repo = receipt.repository
  if (!repo || repo === 'fabric') return 'a sibling repin needs the sibling repository it addresses'
  const record = list[repo]
  if (!record) return repo + ' has no publication record; its commits cannot be repinned'
  const from = receipt.repinned_from
  if (!from || typeof from !== 'object') return 'repinned_from must be an object'
  if (!record.pre_publication.includes(from.commit)) return 'repinned_from.commit ' + from.commit + ' is not a listed pre-publication commit of ' + repo
  if (!HEX40.test(receipt.commit || '')) return 'a repinned sibling receipt names its new commit in full'
  if (record.pre_publication.includes(receipt.commit)) return 'the receipt still addresses a pre-publication commit of ' + repo
  return ruleProblem(receipt, from, receipt.file_sha256)
}

/**
 * The baseline of a plan whose line citations live in a dated record. 'verify' when the baseline is
 * in this history; 'pre-publication' when it is not AND the plan says so AND the citations belong
 * to a dated record — rule 3 of the cutover: such a record keeps its historical addresses, and the
 * gate says they were not resolved rather than rewriting the record. Anything else throws.
 */
export function historicalBaseline({ baseline, baseline_history, audit }, inHistory) {
  if (!HEX40.test(baseline || '')) throw new Error('Missing immutable source baseline')
  if (inHistory(baseline)) {
    if (baseline_history !== undefined) throw new Error('baseline_history is set, but the baseline ' + baseline + ' is in this history; resolve it instead')
    return 'verify'
  }
  if (baseline_history?.state !== 'pre-publication' || typeof baseline_history.reason !== 'string' || !baseline_history.reason.trim())
    throw new Error('The baseline ' + baseline + ' is not in this history and the plan does not record it as pre-publication')
  if (!isDatedRecord(audit)) throw new Error('A pre-publication baseline is accepted only for citations in a dated record; ' + audit + ' is a living document — repin its citations')
  return 'pre-publication'
}
