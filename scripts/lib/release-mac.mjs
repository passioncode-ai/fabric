// #region release-mac-inputs — docs: docs/launch/release-mac.md#how-a-release-is-made
// What `scripts/release-mac.mjs` takes from outside: the signing identity, the tag, the commit, and
// what the signature on the built app says. A release is signed only in CI (the `release` environment
// of .github/workflows/release.yml, ADR-0111); CI hands the identity in from
// passioncode-ai/.github/actions/apple-signing, and nothing here names a team or a certificate.
// A person may run the same script with their own identity to debug the build; that build is never
// published.

import { validatedReviewArtifactPaths } from './release-gate.mjs'

const PREFIX = 'Developer ID Application:'
// Every certificate-type prefix electron-builder knows (app-builder-lib macCodeSign.js
// `appleCertificatePrefixes`), plus the two current Apple names it does not: only the first can sign
// a download that Gatekeeper opens outside the App Store.
const OTHER_TYPES = ['Developer ID Installer:', '3rd Party Mac Developer Application:', '3rd Party Mac Developer Installer:',
  'Apple Distribution:', 'Apple Development:', 'Mac Developer:', 'Mac Installer Distribution:']

/**
 * `node scripts/release-mac.mjs [--check-only] [--identity <name>] [--tag <tag>]`.
 * The identity falls back to FABRIC_SIGN_IDENTITY (how CI passes it); there is no default.
 */
export function parseReleaseArgs(argv, env) {
  const out = { checkOnly: false, identity: null, tag: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--check-only') { out.checkOnly = true; continue }
    const m = /^--(identity|tag)(?:=(.*))?$/.exec(a)
    if (!m) throw new Error(`unknown argument ${a}`)
    let value = m[2]
    if (value === undefined) {
      value = argv[i + 1]
      if (value === undefined || value.startsWith('--')) throw new Error(`--${m[1]} needs a value`)
      i++
    }
    out[m[1]] = value.trim() || null
  }
  if (out.identity === null) out.identity = env.FABRIC_SIGN_IDENTITY?.trim() || null
  return out
}

/**
 * The name electron-builder is given. It refuses a name that keeps its certificate-type prefix
 * ("Please remove prefix …"), and matches the rest as a substring of its Developer ID identities —
 * so a full name, a holder with its team, or a bare team id all select one certificate.
 */
export function builderIdentity(name) {
  const n = (name ?? '').trim()
  if (!n) throw new Error('no signing identity: pass --identity <name> or set FABRIC_SIGN_IDENTITY')
  if (OTHER_TYPES.some((p) => n.startsWith(p))) throw new Error(`"${n}" is not a Developer ID Application identity`)
  return n.startsWith(PREFIX) ? n.slice(PREFIX.length).trim() : n
}

/**
 * The config the release build is run with: the release config (which names no identity, so on its
 * own the base config's `identity: null` leaves the app unsigned) with the given identity on top.
 * A file, not `-c.mac.identity=`: electron-builder merges a dot-notation override over the DEFAULT
 * config file and would let its `target: dir` replace the release's DMG target.
 */
export function builderConfig({ releaseConfig, identity }) {
  return { extends: releaseConfig, mac: { identity: builderIdentity(identity) } }
}

/** A tag names the version the commit carries (`v0.3.0`), or a rehearsal of it (`v0.3.0-rc.2`). */
export function tagProblem({ tag, version }) {
  if (!tag) return null
  const v = version.replace(/[.]/g, '\\.')
  return new RegExp(`^v${v}(?:-rc\\.\\d+)?$`).test(tag) ? null : `the tag ${tag} does not name version ${version} (v${version}, or v${version}-rc.N for a rehearsal)`
}

/** A published version has one finalized, nonempty changelog entry, never an unreleased heading. */
export function changelogProblem({ version, text }) {
  const lines = String(text ?? '').split('\n')
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const heading = new RegExp(`^## ${escaped}$`)
  const starts = lines.flatMap((line, i) => heading.test(line.trim()) ? [i] : [])
  if (starts.length !== 1) return `the changelog must have exactly one finalized "## ${version}" entry (found ${starts.length})`
  const from = starts[0] + 1
  const next = lines.findIndex((line, i) => i >= from && /^## /.test(line))
  const body = lines.slice(from, next < 0 ? lines.length : next)
  if (!body.some(line => line.trim()))
    return `the changelog entry for ${version} is empty`
  // Renaming the heading is not finalizing the notes (I3 P-2): a leftover "(unreleased)" heading for this
  // version, or a section that still says it is not released, would be published as the release notes.
  if (lines.some(line => new RegExp(`^## ${escaped}\\b.*\\bunreleased\\b`, 'i').test(line.trim())))
    return `the changelog still has an unreleased heading for ${version} beside the finalized one`
  if (body.some(line => /\bnot (?:been )?released\b|\bunreleased\b/i.test(line)))
    return `the changelog entry for ${version} still says it is not released; finalize the notes before tagging`
  // Process wording is for the file's header, not the notes a release publishes (I3 N-3).
  if (body.some(line => /release pull request|renames? this heading|follow(?:s)? the (?:third )?verification iteration/i.test(line)))
    return `the changelog entry for ${version} still carries release-process wording; finalize the notes before tagging`
  return null
}

/**
 * A release is built from `main` as it is on the remote (plan row P-03): HEAD must be reachable from
 * origin/main. Its tip passes, and so does a release tag on main that CI checks out after main moved on.
 * `git(args)` returns stdout and throws on a non-zero exit (execFileSync).
 */
export function releaseCommitProblem(git) {
  try { git(['rev-parse', '--verify', '--quiet', 'refs/remotes/origin/main^{commit}']) } catch {
    return 'cannot read origin/main to check the release commit; fetch it first'
  }
  try { git(['merge-base', '--is-ancestor', 'HEAD', 'refs/remotes/origin/main']); return null } catch {
    return 'HEAD is not on origin/main; land the change on main first, then release from it (or from a tag on main)'
  }
}

// The scheduled workspace publication (`node scripts/workspace.mjs publish`, every 2 h) commits a new
// pin of the private `workspace` submodule and its receipt straight to main. Neither is built into the app —
// no workflow checks the submodule out — so a pin landing between the verified commit and the release commit
// is not a change to what was reviewed (CO-208). Exempt only that exact shape: the submodule stays a gitlink
// on both sides, and the receipt is still a schema-1 receipt naming the pinned commit.
const PUBLICATION_PIN = ['workspace', 'docs/workspace-receipt.json']

function publicationPinProblem(changed, verifiedCommit, git) {
  const gitlink = (commit) => {
    try { return /^160000 commit ([0-9a-f]{40})\t/.exec(String(git(['ls-tree', commit, '--', 'workspace'])))?.[1] ?? null } catch { return null }
  }
  if (changed.includes('workspace') && (!gitlink(verifiedCommit) || !gitlink('HEAD')))
    return 'the workspace path changed after verification and is no longer only a submodule pin'
  if (changed.includes('docs/workspace-receipt.json')) {
    let receipt = null
    try { receipt = JSON.parse(git(['show', 'HEAD:docs/workspace-receipt.json'])) } catch { receipt = null }
    if (receipt?.schema !== 1 || !/^[0-9a-f]{40}$/.test(receipt?.workspace_commit ?? '') || receipt.workspace_commit !== gitlink('HEAD'))
      return 'the workspace receipt changed after verification and does not describe the pinned workspace commit'
  }
  return null
}

/** Bind the verification ledger to a reviewed ancestor; later runtime/build changes require review again. */
export function verifiedCandidateProblem({ version, gateText, readCommitted }, git) {
  let gate
  try { gate = JSON.parse(gateText) } catch { return 'the release gate has no readable verified commit' }
  if (gate.version !== version || !/^[0-9a-f]{40}$/.test(gate.verifiedCommit ?? ''))
    return 'the release gate must name the exact verified commit for this version'
  try { git(['merge-base', '--is-ancestor', gate.verifiedCommit, 'HEAD']) } catch {
    return 'the verified commit is not an ancestor of the release candidate'
  }
  const metadata = new Set(['CHANGELOG.md', 'docs/launch/release-gate.json', gate.ledger,
    'docs/MERGES.md', 'docs/reports/map.html'])
  // Other release-only documents are declared per release in the gate, never hard-coded for every future
  // release (I3 P-10): Markdown under docs/handoffs/ or docs/reports/, nothing executable.
  for (const p of Array.isArray(gate.releaseMetadata) ? gate.releaseMetadata : [])
    if (typeof p === 'string' && /^docs\/(?:handoffs|reports)\/[\w./-]+\.md$/.test(p) && !p.split('/').includes('..')) metadata.add(p)
  if (gate.reviewReceipts) for (const p of validatedReviewArtifactPaths(gate, version, readCommitted)) metadata.add(p)
  let changed
  try { changed = git(['diff', '--name-only', gate.verifiedCommit, 'HEAD']).trim().split('\n').filter(Boolean) } catch {
    return 'the verified commit difference could not be inspected'
  }
  const unverified = changed.filter(p => p !== 'apps/desktop/package.json' && !PUBLICATION_PIN.includes(p) && !metadata.has(p))
  if (unverified.length) return `unverified changes follow the verified commit: ${unverified.slice(0, 10).join(', ')}`
  const pinProblem = publicationPinProblem(changed, gate.verifiedCommit, git)
  if (pinProblem) return pinProblem
  if (changed.includes('apps/desktop/package.json')) {
    try {
      const before = JSON.parse(git(['show', `${gate.verifiedCommit}:apps/desktop/package.json`]))
      const after = JSON.parse(git(['show', 'HEAD:apps/desktop/package.json']))
      delete before.version; delete after.version
      if (JSON.stringify(before) !== JSON.stringify(after)) return 'the desktop package changed beyond version after verification'
    } catch { return 'the verified desktop package comparison failed' }
  }
  // The three review iterations are three successive candidates in this history: each exists, and each is an
  // ancestor of the next (I3 P-1). The gate's pure check only sees that they are distinct hex strings.
  const chain = (gate.reviewReceipts?.iterations ?? []).slice().sort((a, b) => a.iteration - b.iteration)
  for (const it of chain) {
    let kind = ''
    try { kind = String(git(['cat-file', '-t', it.candidateCommit])).trim() } catch { kind = '' }
    if (kind !== 'commit') return `review iteration ${it.iteration} candidate ${it.candidateCommit} does not exist in this repository`
  }
  for (let i = 1; i < chain.length; i++) {
    try { git(['merge-base', '--is-ancestor', chain[i - 1].candidateCommit, chain[i].candidateCommit]) } catch {
      return `review iteration ${chain[i - 1].iteration} candidate is not an ancestor of iteration ${chain[i].iteration}'s`
    }
  }
  return null
}

/** What `codesign -dvv <app>` printed (it writes to stderr): the leaf authority, the team, the runtime flag. */
export function signatureOf(text) {
  const authority = /^Authority=(.+)$/m.exec(text)?.[1]?.trim()
  if (!authority?.startsWith(PREFIX)) throw new Error(`the app is not signed with a Developer ID Application identity (${authority ?? 'no authority'})`)
  const team = /^TeamIdentifier=(\S+)$/m.exec(text)?.[1]
  if (!team || !authority.endsWith(`(${team})`)) throw new Error(`the team ${team ?? '(none)'} does not match the authority ${authority}`)
  const flags = /^CodeDirectory .*flags=\S*\(([^)]*)\)/m.exec(text)?.[1] ?? ''
  return { authority, team, hardenedRuntime: flags.split(',').includes('runtime') }
}
// #endregion release-mac-inputs
